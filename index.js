const express = require("express");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// ===== LOAD KEYS =====
const PRIVATE_KEY = fs.readFileSync("./private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("./public.pem", "utf8");

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("✅ Server running");
});

// ===== PUBLIC KEY =====
app.get("/.well-known/public-key", (req, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ===== FLOW ENDPOINT =====
app.post("/flow", (req, res) => {
  try {
    console.log("📩 Incoming request");

    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    // ===== STEP 1: DECRYPT AES KEY =====
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    console.log("🔑 AES KEY LENGTH:", aesKey.length);

    // ===== STEP 2: IV HANDLING (CRITICAL FIX) =====
    const fullIV = Buffer.from(initial_vector, "base64");

    const ivDecrypt = fullIV;              // 16 bytes
    const ivEncrypt = fullIV.subarray(0, 12); // 12 bytes

    console.log("📏 IV decrypt:", ivDecrypt.length);
    console.log("📏 IV encrypt:", ivEncrypt.length);

    // ===== STEP 3: AES-GCM =====
    const algorithm =
      aesKey.length === 16 ? "aes-128-gcm" : "aes-256-gcm";

    console.log("🔐 Using:", algorithm);

    // ===== STEP 4: SPLIT DATA =====
    const encryptedBuffer = Buffer.from(encrypted_flow_data, "base64");

    const authTag = encryptedBuffer.slice(-16);
    const ciphertext = encryptedBuffer.slice(0, -16);

    console.log("📏 Auth tag length:", authTag.length);

    // ===== STEP 5: DECRYPT =====
    const decipher = crypto.createDecipheriv(algorithm, aesKey, ivDecrypt);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const request = JSON.parse(decryptedBuffer.toString());

    console.log("📥 DECRYPTED REQUEST:", request);

    // ===== STEP 6: BUILD RESPONSE =====
    let response;

    if (request?.action === "ping") {
      response = {
        version: "1.0",
        data: { status: "active" },
      };
    } else {
      response = {
        version: "1.0",
        screen: "SUCCESS",
        data: {},
      };
    }

    // ===== STEP 7: ENCRYPT RESPONSE =====
    const cipher = crypto.createCipheriv(algorithm, aesKey, ivEncrypt);

    const encryptedResponse = Buffer.concat([
      cipher.update(JSON.stringify(response)),
      cipher.final(),
    ]);

    const responseAuthTag = cipher.getAuthTag();

    console.log("📏 Response auth tag:", responseAuthTag.length);

    // FINAL PAYLOAD = ciphertext + auth tag
    const finalBuffer = Buffer.concat([
      encryptedResponse,
      responseAuthTag,
    ]);

    const base64Response = finalBuffer.toString("base64");

    console.log("✅ Base64 valid:", /^[A-Za-z0-9+/=]+$/.test(base64Response));
    console.log("📤 FINAL RESPONSE:", base64Response);

    // ===== SEND RAW BASE64 (REQUIRED) =====
    res.set("Content-Type", "text/plain");
    return res.status(200).send(base64Response);

  } catch (err) {
    console.error("🔥 ERROR:", err);

    return res.status(421).send("Decryption failed");
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
