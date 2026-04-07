import express from "express";
import crypto from "crypto";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== LOAD KEYS =====
const PRIVATE_KEY = fs.readFileSync("private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("public.pem", "utf8");

// ===== PUBLIC KEY ENDPOINT =====
app.get("/.well-known/public-key", (_, res) => {
  res.type("text/plain");
  res.send(PUBLIC_KEY.trim());
});

// ===== WEBHOOK VERIFICATION =====
app.get("/flow", (req, res) => {
  const VERIFY_TOKEN = "mytoken999";

  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
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

    // ===== 1. Decrypt AES key =====
    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    console.log("🔑 AES KEY LENGTH:", aesKey.length); // must be 16

    // ===== 2. Decrypt payload =====
    const iv = Buffer.from(initial_vector, "base64");
    const encryptedData = Buffer.from(encrypted_flow_data, "base64");

    const authTag = encryptedData.slice(-16);
    const cipherText = encryptedData.slice(0, -16);

    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, null, "utf8");
    decrypted += decipher.final("utf8");

    const requestJSON = JSON.parse(decrypted);
    console.log("📥 DECRYPTED:", requestJSON);

    // ===== 3. HANDLE PING (MANDATORY) =====
    let responsePayload;

    if (requestJSON.action === "ping") {
      responsePayload = {
        version: "3.0",
        data: {
          status: "active"
        }
      };
    } else {
      // fallback (not used in health check)
      responsePayload = {
        version: "3.0",
        data: {}
      };
    }

    const responseString = JSON.stringify(responsePayload);

    // ===== 4. ENCRYPT RESPONSE (IMPORTANT RULES) =====
    const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, iv);

    let encrypted = cipher.update(responseString, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    const finalBuffer = Buffer.concat([encrypted, tag]);
    const base64Response = finalBuffer.toString("base64");

    console.log("📤 RESPONSE:", base64Response);

    // ===== 5. RETURN EXACT FORMAT (THIS IS CRITICAL) =====
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
