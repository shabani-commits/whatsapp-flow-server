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

// ===== PUBLIC KEY (IMPORTANT) =====
app.get("/.well-known/public-key", (req, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ===== FLOW ENDPOINT =====
app.post("/flow", (req, res) => {
  try {
    console.log("📩 Incoming request");

    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    // ===== STEP 1: DECRYPT AES KEY (RSA OAEP SHA256) =====
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    console.log("🔑 AES KEY LENGTH:", aesKey.length);

    // ===== STEP 2: PREPARE IV =====
    const iv = Buffer.from(initial_vector, "base64");
    console.log("📏 IV LENGTH:", iv.length); // MUST be 12 for GCM

    // ===== STEP 3: SELECT AES-GCM MODE =====
    const algorithm =
      aesKey.length === 16 ? "aes-128-gcm" : "aes-256-gcm";

    console.log("🔐 Using:", algorithm);

    // ===== STEP 4: SPLIT DATA + AUTH TAG =====
    const encryptedBuffer = Buffer.from(encrypted_flow_data, "base64");

    const authTag = encryptedBuffer.slice(-16); // last 16 bytes
    const ciphertext = encryptedBuffer.slice(0, -16);

    // ===== STEP 5: DECRYPT DATA =====
    const decipher = crypto.createDecipheriv(algorithm, aesKey, iv);
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

    // ===== STEP 7: ENCRYPT RESPONSE (GCM) =====
    const cipher = crypto.createCipheriv(algorithm, aesKey, iv);

    const encryptedResponse = Buffer.concat([
      cipher.update(JSON.stringify(response), "utf8"),
      cipher.final(),
    ]);

    const responseAuthTag = cipher.getAuthTag();

    // IMPORTANT: append auth tag
    const finalPayload = Buffer.concat([
      encryptedResponse,
      responseAuthTag,
    ]);

    const base64Response = finalPayload.toString("base64");

    console.log("📤 ENCRYPTED RESPONSE:", base64Response);

    // ===== STEP 8: SEND RESPONSE =====
    return res.status(200).json({
  encrypted_response: base64Response,
});

  } catch (err) {
    console.error("🔥 ERROR:", err);

    // Meta expects 421 on failure
    return res.status(421).send("Decryption failed");
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
