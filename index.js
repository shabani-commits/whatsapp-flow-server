const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// 🔍 DEBUG LOGS
app.use((req, res, next) => {
  console.log("Incoming:", req.method, req.url);
  next();
});

// 🔑 LOAD KEYS
let PUBLIC_KEY = "";
let PRIVATE_KEY = "";

try {
  PUBLIC_KEY = fs.readFileSync(path.join(__dirname, "public.pem"), "utf8");
  PRIVATE_KEY = fs.readFileSync(path.join(__dirname, "private.pem"), "utf8");
} catch (e) {
  console.log("❌ Key files missing");
}

// ✅ ROOT
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// ✅ PUBLIC KEY ENDPOINT
app.get("/.well-known/public-key", (req, res) => {
  console.log("👉 Meta requesting public key");

  if (!PUBLIC_KEY) {
    return res.status(500).send("public.pem not found");
  }

  res.setHeader("Content-Type", "text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ✅ FLOW ENDPOINT
app.post("/flow", (req, res) => {
  try {
    console.log("📩 /flow request:", req.body);

    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
      return res.status(400).send("Missing fields");
    }

    // 🔓 1. Decrypt AES key
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    console.log("✅ AES KEY LENGTH:", aesKey.length);

    // 🔓 2. Decrypt request
    const decipher = crypto.createDecipheriv(
      "aes-128-cbc",
      aesKey,
      Buffer.from(initial_vector, "base64")
    );

    decipher.setAutoPadding(true);

    let decrypted = decipher.update(Buffer.from(encrypted_flow_data, "base64"));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const decryptedText = decrypted.toString();
    console.log("✅ Decrypted:", decryptedText);

    let requestData;
    try {
      requestData = JSON.parse(decryptedText);
    } catch (e) {
      console.log("❌ JSON parse error");
      return res.status(500).send("Invalid JSON");
    }

    // ⚙️ 3. Build response
    let response;

    if (requestData?.action === "ping") {
      response = {
        version: "1.0",
        data: { status: "active" }
      };
    } else {
      response = {
        version: "1.0",
        screen: "SUCCESS",
        data: {}
      };
    }

    // 🔐 4. Encrypt response
    const cipher = crypto.createCipheriv(
      "aes-128-cbc",
      aesKey,
      Buffer.from(initial_vector, "base64")
    );

    cipher.setAutoPadding(true);

    let encrypted = cipher.update(JSON.stringify(response), "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const base64Response = encrypted.toString("base64");

    console.log("✅ Sending encrypted response");

    return res.json({
      data: base64Response
    });

  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    return res.status(500).send("Error processing flow");
  }
});

// ✅ WEBHOOK VERIFY
app.get("/flow", (req, res) => {
  const VERIFY_TOKEN = "my_verify_token";

  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// 🚀 START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
