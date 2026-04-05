const express = require("express");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
app.use(express.json());

// ✅ DEBUG LOGGER (VERY IMPORTANT)
app.use((req, res, next) => {
  console.log("Incoming:", req.method, req.url);
  next();
});

// 🔐 Load keys
const PRIVATE_KEY = fs.readFileSync("private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("public.pem", "utf8");

// ✅ HEALTH CHECK (Meta uses this)
app.get("/", (req, res) => {
  res.send("WhatsApp Flow Server Running ✅");
});

// ✅ PUBLIC KEY ENDPOINT (CRITICAL FOR META)
app.get("/.well-known/public-key", (req, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY);
});

// 🔐 Decrypt request (Meta Flow)
function decryptRequest(encryptedData, encryptedKey, iv) {
  const decryptedKey = crypto.privateDecrypt(
    {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(encryptedKey, "base64")
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    decryptedKey,
    Buffer.from(iv, "base64")
  );

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

// 🔐 Encrypt response (Meta Flow)
function encryptResponse(data, aesKey, iv) {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    aesKey,
    Buffer.from(iv, "base64")
  );

  let encrypted = cipher.update(JSON.stringify(data), "utf8", "base64");
  encrypted += cipher.final("base64");

  return encrypted;
}

// ✅ MAIN FLOW ENDPOINT
app.post("/", (req, res) => {
  try {
    const { encrypted_data, encrypted_key, iv } = req.body;

    const decrypted = decryptRequest(encrypted_data, encrypted_key, iv);

    console.log("Decrypted request:", decrypted);

    // 👉 Respond back to Meta Flow
    const responsePayload = {
      screen: "SUCCESS",
      data: {
        message: "Request received successfully",
      },
    };

    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(encrypted_key, "base64")
    );

    const encryptedResponse = encryptResponse(responsePayload, aesKey, iv);

    res.json({
      encrypted_data: encryptedResponse,
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Error processing request");
  }
});

// ✅ FALLBACK ROUTE (DEBUG)
app.get("*", (req, res) => {
  res.status(404).send("Route not found: " + req.url);
});

// ✅ START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
