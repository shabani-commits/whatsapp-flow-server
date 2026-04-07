import express from "express";
import crypto from "crypto";
import fs from "fs";

const app = express();
app.use(express.json());

// ===== LOAD KEYS =====
const PRIVATE_KEY = fs.readFileSync("private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("public.pem", "utf8");

// ===== PUBLIC KEY ENDPOINT (Meta fetches this) =====
app.get("/.well-known/public-key", (_, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

app.post("/.well-known/public-key", (_, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ===== WEBHOOK VERIFICATION (REQUIRED) =====
app.get("/flow", (req, res) => {
  const VERIFY_TOKEN = "mytoken999";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ===== FLOW ENDPOINT =====
app.post("/flow", (req, res) => {
  try {
    console.log("📩 Incoming request");

    const {
      encrypted_flow_data,
      encrypted_aes_key,
      initial_vector,
    } = req.body;

    // 1️⃣ Decrypt AES key
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    // 2️⃣ Decrypt payload
    const iv = Buffer.from(initial_vector, "base64");
    const encryptedData = Buffer.from(encrypted_flow_data, "base64");

    const authTag = encryptedData.slice(-16);
    const cipherText = encryptedData.slice(0, -16);

    const decipher = crypto.createDecipheriv(
      "aes-128-gcm",
      aesKey,
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, null, "utf8");
    decrypted += decipher.final("utf8");

    const requestJSON = JSON.parse(decrypted);
    console.log("📥 DECRYPTED REQUEST:", requestJSON);

    // 3️⃣ Prepare response
    const responsePayload = JSON.stringify({
      version: "3.0",
      data: {
        status: "ok"
      }
    });

    const responseIv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
      "aes-128-gcm",
      aesKey,
      responseIv
    );

    let encrypted = cipher.update(responsePayload, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    const finalBuffer = Buffer.concat([encrypted, tag]);

    const base64Response = finalBuffer.toString("base64");

    console.log("📤 RESPONSE:", base64Response);

    res.json({
      encrypted_response: base64Response,
      initial_vector: responseIv.toString("base64"),
    });

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).send("Error");
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
