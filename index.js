const express = require("express");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔐 Load private key
const PRIVATE_KEY = fs.readFileSync("private.pem", "utf8");

// 🟢 Health check (Meta requirement)
app.get("/", (req, res) => {
  res.send("WhatsApp Flow Server Running ✅");
});

// 🔐 Decrypt function
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

// 🔐 Encrypt response (Meta expects this)
function encryptResponse(data, aesKey, iv) {
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);

  let encrypted = cipher.update(JSON.stringify(data), "utf8", "base64");
  encrypted += cipher.final("base64");

  return encrypted;
}

// 📩 Flow endpoint
app.post("/", (req, res) => {
  try {
    const { encrypted_data, encrypted_key, iv } = req.body;

    const decrypted = decryptRequest(encrypted_data, encrypted_key, iv);

    console.log("✅ RECEIVED DATA:", decrypted);

    // 🟢 Prepare response
    const responsePayload = {
      success: true,
      message: "Request received successfully",
    };

    const aesKey = crypto.randomBytes(32);
    const responseIV = crypto.randomBytes(16);

    const encryptedResponse = encryptResponse(
      responsePayload,
      aesKey,
      responseIV
    );

    const encryptedKey = crypto.publicEncrypt(
      decrypted.public_key,
      aesKey
    );

    res.json({
      encrypted_data: encryptedResponse,
      encrypted_key: encryptedKey.toString("base64"),
      iv: responseIV.toString("base64"),
    });

  } catch (error) {
    console.error("❌ ERROR:", error);
    res.status(500).send("Error processing request");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
