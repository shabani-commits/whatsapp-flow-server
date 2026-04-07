import express from "express";
import crypto from "crypto";
import fs from "fs";

const app = express();
app.use(express.json());

// ===== CONFIG =====
const VERIFY_TOKEN = "mytoken123";

// ===== LOAD KEYS FROM FILES =====
const PRIVATE_KEY = fs.readFileSync("private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("public.pem", "utf8");

// ===== PUBLIC KEY ENDPOINT =====
app.get("/.well-known/public-key", (req, res) => {
  res.type("text/plain").send(PUBLIC_KEY.trim());
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

    // ===== STEP 1: Decrypt AES key =====
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256"
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    console.log("🔑 AES KEY LENGTH:", aesKey.length);

    // ===== STEP 2: Prepare IV & data =====
    const iv = Buffer.from(initial_vector, "base64");
    const encryptedData = Buffer.from(encrypted_flow_data, "base64");

    const authTag = encryptedData.slice(-16);
    const cipherText = encryptedData.slice(0, -16);

    // ===== STEP 3: Decrypt request =====
    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, null, "utf8");
    decrypted += decipher.final("utf8");

    const request = JSON.parse(decrypted);
    console.log("📥 DECRYPTED:", request);

    // ===== STEP 4: Prepare response =====
    let responsePayload;

    if (request.action === "ping") {
      responsePayload = {
        version: "3.0",
        data: {
          status: "active"
        }
      };
    } else {
      responsePayload = {
        version: "3.0",
        screen: "SUCCESS",
        data: {}
      };
    }

    const responseString = JSON.stringify(responsePayload);

    // ===== STEP 5: Encrypt response (CRITICAL) =====
    const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, iv);

    let encrypted = cipher.update(responseString, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    const finalBuffer = Buffer.concat([encrypted, tag]);

    const base64Response = finalBuffer.toString("base64");

    console.log("📤 RESPONSE:", base64Response);

    // ===== STEP 6: SEND =====
    return res.status(200).json({
      encrypted_response: base64Response
    });

  } catch (err) {
    console.error("❌ ERROR:", err);
    return res.status(500).send("Error");
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
