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
    console.log("📏 IV LENGTH:", iv.length);

    // ===== STEP 3: SELECT AES MODE =====
    const algorithm = aesKey.length === 16 ? "aes-128-cbc" : "aes-256-cbc";
    console.log("🔐 Using:", algorithm);

    // ===== STEP 4: DECRYPT DATA =====
    const decipher = crypto.createDecipheriv(algorithm, aesKey, iv);

    let decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted_flow_data, "base64")),
      decipher.final(),
    ]);

    const request = JSON.parse(decrypted.toString());
    console.log("📥 DECRYPTED:", request);

    // ===== STEP 5: BUILD RESPONSE =====
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

    // ===== STEP 6: ENCRYPT RESPONSE =====
    const cipher = crypto.createCipheriv(algorithm, aesKey, iv);

    let encrypted = Buffer.concat([
      cipher.update(JSON.stringify(response)),
      cipher.final(),
    ]);

    const base64Response = encrypted.toString("base64");

    console.log("📤 RESPONSE (base64):", base64Response);

    // ===== STEP 7: SEND =====
    return res.status(200).json({
      data: base64Response,
    });

  } catch (err) {
    console.error("🔥 ERROR:", err.message);

    // VERY IMPORTANT for Meta
    return res.status(421).send("Decryption failed");
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
