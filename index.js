import express from "express";
import crypto from "crypto";
import fs from "fs";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "mytoken123";

// keys from files (keep your existing pem files)
const PRIVATE_KEY = fs.readFileSync("private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("public.pem", "utf8");

// expose public key
app.get("/.well-known/public-key", (_, res) => {
  res.type("text/plain").send(PUBLIC_KEY.trim());
});

// webhook verification
app.get("/flow", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// main flow endpoint
app.post("/flow", (req, res) => {
  try {
    console.log("📩 Incoming request");

    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    // 1. decrypt AES key (RSA-OAEP SHA256)
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

    // 2. decrypt request
    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, null, "utf8");
    decrypted += decipher.final("utf8");

    const request = JSON.parse(decrypted);
    console.log("📥 DECRYPTED:", request);

    // 3. response payload
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

    // 4. encrypt response (CRITICAL — DO NOT CHANGE)
    const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, iv);

    let encrypted = cipher.update(payloadStr, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    // FINAL FORMAT: ciphertext + tag
    const finalBuffer = Buffer.concat([encrypted, tag]);
    const base64Response = finalBuffer.toString("base64");

    console.log("📤 RESPONSE:", base64Response);

    // 5. return JSON
    res.json({
      encrypted_response: base64Response
    });

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.sendStatus(500);
  }
});

app.listen(10000, () => {
  console.log("🚀 running on port 10000");
});
