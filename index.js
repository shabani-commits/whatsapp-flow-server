import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

// ===== CONFIG =====
const VERIFY_TOKEN = "mytoken123";

// 🔑 PRIVATE KEY (paste EXACT content of private.pem)
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
PASTE_YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----`;

// 🔑 PUBLIC KEY (must match Meta)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
PASTE_YOUR_PUBLIC_KEY_HERE
-----END PUBLIC KEY-----`;

// ===== PUBLIC KEY ENDPOINT =====
app.get("/.well-known/public-key", (req, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

app.post("/.well-known/public-key", (req, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ===== WEBHOOK VERIFY =====
app.get("/flow", (req, res) => {
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
      initial_vector
    } = req.body;

    // ===== 1. DECRYPT AES KEY =====
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    console.log("🔑 AES KEY LENGTH:", aesKey.length);

    // ===== 2. DECRYPT FLOW DATA =====
    const flowBuffer = Buffer.from(encrypted_flow_data, "base64");

    const iv = Buffer.from(initial_vector, "base64");
    const tag = flowBuffer.slice(-16);
    const encrypted = flowBuffer.slice(0, -16);

    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, null, "utf8");
    decrypted += decipher.final("utf8");

    const parsed = JSON.parse(decrypted);
    console.log("📥 DECRYPTED:", parsed);

    // ===== 3. RESPONSE PAYLOAD =====
    const responsePayload = JSON.stringify({
      version: "3.0",
      data: {
        status: "active"
      }
    });

    // ===== 4. ENCRYPT RESPONSE (CORRECT METHOD) =====

    // 🔥 CRITICAL: invert IV (NOT random, NOT same)
    const invertedIv = Buffer.from(initial_vector, "base64").map(b => ~b);

    const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, invertedIv);

    let encryptedResponse = cipher.update(responsePayload, "utf8");
    encryptedResponse = Buffer.concat([encryptedResponse, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // 🔥 FINAL FORMAT: ciphertext + tag (NO IV PREFIX)
    const finalBuffer = Buffer.concat([encryptedResponse, authTag]);

    const base64Response = finalBuffer.toString("base64");

    console.log("📤 RESPONSE:", base64Response);

    return res.json({
      encrypted_response: base64Response
    });

  } catch (err) {
    console.error("❌ ERROR:", err);
    return res.sendStatus(500);
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
