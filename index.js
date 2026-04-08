import express from "express";
import crypto from "crypto";
import fs from "fs";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "mytoken123";

// Load keys
const PRIVATE_KEY = fs.readFileSync("private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("public.pem", "utf8");


// ==============================
// PUBLIC KEY ENDPOINT
// ==============================
app.get("/.well-known/public-key", (_, res) => {
  res.type("text/plain").send(PUBLIC_KEY.trim());
});


// ==============================
// WEBHOOK VERIFICATION
// ==============================
app.get("/flow", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});


// ==============================
// MAIN FLOW ENDPOINT
// ==============================
app.post("/flow", (req, res) => {
  try {
    console.log("📩 Incoming request");

    const {
      encrypted_flow_data,
      encrypted_aes_key,
      initial_vector
    } = req.body;

    // ==========================
    // 1. Decrypt AES key
    // ==========================
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    const iv = Buffer.from(initial_vector, "base64");
    const encryptedBuffer = Buffer.from(encrypted_flow_data, "base64");

    // split ciphertext + tag
    const authTag = encryptedBuffer.slice(-16);
    const cipherText = encryptedBuffer.slice(0, -16);

    // ==========================
    // 2. Decrypt request
    // ==========================
    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, null, "utf8");
    decrypted += decipher.final("utf8");

    const request = JSON.parse(decrypted);
    console.log("📥 DECRYPTED:", request);


    // ==========================
    // 3. Build response
    // ==========================
    let payload;

    if (request.action === "ping") {
      payload = {
        version: "3.0",
        data: { status: "active" }
      };
    } else {
      payload = {
        version: "3.0",
        screen: "SUCCESS",
        data: {}
      };
    }

    const payloadStr = JSON.stringify(payload);


    // ==========================
    // 4. Encrypt response
    // ==========================

    // 🔥 REQUIRED: invert IV
    const flippedIV = Buffer.from(iv.map(b => b ^ 0xff));

    const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIV);

    let encrypted = cipher.update(payloadStr, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    // final buffer = ciphertext + tag
    const finalBuffer = Buffer.concat([encrypted, tag]);

    const base64Response = finalBuffer.toString("base64");

    console.log("📤 RESPONSE:", base64Response);


    // ==========================
    // 5. ✅ FIXED RESPONSE
    // ==========================
    res
      .status(200)
      .type("text/plain")   // VERY IMPORTANT
      .send(base64Response); // RAW base64 ONLY

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.sendStatus(500);
  }
});


// ==============================
// START SERVER
// ==============================
app.listen(10000, () => {
  console.log("🚀 Server running on port 10000");
});
