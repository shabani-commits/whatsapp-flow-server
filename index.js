const express = require("express");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ===== LOAD KEYS =====
const PRIVATE_KEY = fs.readFileSync("./private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("./public.pem", "utf8");

// ===== HEALTH =====
app.get("/", (_, res) => res.send("OK"));

// ===== PUBLIC KEY (Meta fetches this) =====
app.get("/.well-known/public-key", (_, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

app.post("/.well-known/public-key", (req, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ===== FLOW ENDPOINT =====
app.post("/flow", (req, res) => {
  try {
    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    // 1) Decrypt AES key (RSA OAEP SHA-256)
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    // 2) IV (use EXACT bytes from request; do NOT slice)
    const iv = Buffer.from(initial_vector, "base64");

    // 3) AES-GCM (key size decides variant)
    const algorithm = aesKey.length === 16 ? "aes-128-gcm" : "aes-256-gcm";

    // 4) Split incoming payload: [ciphertext | authTag(16)]
    const incoming = Buffer.from(encrypted_flow_data, "base64");
    const authTag = incoming.slice(-16);
    const ciphertext = incoming.slice(0, -16);

    // 5) Decrypt request
    const decipher = crypto.createDecipheriv(algorithm, aesKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const request = JSON.parse(decrypted.toString());

    // 6) Build response
    const response =
      request?.action === "ping"
        ? { version: "1.0", data: { status: "active" } }
        : { version: "1.0", screen: "SUCCESS", data: {} };

    // 7) Encrypt response (CRITICAL: Buffer, append tag)
    const cipher = crypto.createCipheriv(algorithm, aesKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(response))), // DO NOT pass "utf8" here
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    const finalBuffer = Buffer.concat([encrypted, tag]);
    const base64 = finalBuffer.toString("base64");

    // 8) Return RAW base64 (NOT JSON)
    res.set("Content-Type", "text/plain");
    return res.status(200).send(base64);

  } catch (e) {
    console.error("ERROR:", e.message);
    return res.status(421).send("Decryption failed");
  }
});

// ===== START =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
