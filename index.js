import express from "express";
import crypto from "crypto";
import fs from "fs";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "mytoken123";

// ✅ READ FROM FILES (BEST PRACTICE)
const PRIVATE_KEY = fs.readFileSync("private.pem", "utf8");
const PUBLIC_KEY = fs.readFileSync("public.pem", "utf8");

// ===== PUBLIC KEY =====
app.get("/.well-known/public-key", (_, res) => {
  res.type("text/plain").send(PUBLIC_KEY.trim());
});

// ===== VERIFY =====
app.get("/flow", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// ===== FLOW =====
app.post("/flow", (req, res) => {
  try {
    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    const aesKey = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    const iv = Buffer.from(initial_vector, "base64");
    const data = Buffer.from(encrypted_flow_data, "base64");

    const tag = data.slice(-16);
    const text = data.slice(0, -16);

    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(text, null, "utf8");
    decrypted += decipher.final("utf8");

    console.log("📥", decrypted);

    // ✅ REQUIRED RESPONSE
    const payload = JSON.stringify({
      version: "3.0",
      data: { status: "active" }
    });

    // 🔥 CRITICAL FIX (FINAL)
    const invertedIv = iv.map(b => ~b);

    const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, invertedIv);

    let enc = cipher.update(payload, "utf8");
    enc = Buffer.concat([enc, cipher.final()]);

    const authTag = cipher.getAuthTag();

    const result = Buffer.concat([enc, authTag]).toString("base64");

    res.json({ encrypted_response: result });

  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

app.listen(10000, () => console.log("🚀 running"));
