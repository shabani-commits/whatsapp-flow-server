const express = require("express");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// ===== LOAD KEYS =====
const PRIVATE_KEY = fs.readFileSync("./private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("./public.pem", "utf8");

// ===== HEALTH =====
app.get("/", (req, res) => {
  res.send("OK");
});

// ===== PUBLIC KEY =====
app.get("/.well-known/public-key", (req, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ===== FLOW ENDPOINT =====
app.post("/flow", (req, res) => {
  try {
    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    // ===== 1. DECRYPT AES KEY =====
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    // ===== 2. IV (USE FULL 16 BYTES) =====
    const iv = Buffer.from(initial_vector, "base64");

    // ===== 3. ALGORITHM =====
    const algorithm =
      aesKey.length === 16 ? "aes-128-gcm" : "aes-256-gcm";

    // ===== 4. SPLIT DATA =====
    const encryptedBuffer = Buffer.from(encrypted_flow_data, "base64");
    const authTag = encryptedBuffer.slice(-16);
    const ciphertext = encryptedBuffer.slice(0, -16);

    // ===== 5. DECRYPT =====
    const decipher = crypto.createDecipheriv(algorithm, aesKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const request = JSON.parse(decrypted.toString());

    // ===== 6. RESPONSE =====
    const response =
      request?.action === "ping"
        ? { version: "1.0", data: { status: "active" } }
        : { version: "1.0", screen: "SUCCESS", data: {} };

    // ===== 7. ENCRYPT RESPONSE =====
    const cipher = crypto.createCipheriv(algorithm, aesKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(response)),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    const finalBuffer = Buffer.concat([encrypted, tag]);
    const base64 = finalBuffer.toString("base64");

    // ===== 8. SEND (RAW BASE64) =====
    res.set("Content-Type", "text/plain");
    return res.status(200).send(base64);

  } catch (err) {
    console.error("ERROR:", err.message);
    return res.status(421).send("Decryption failed");
  }
});

// ===== START =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on", PORT));
