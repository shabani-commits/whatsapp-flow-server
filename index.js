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

// 🔐 ENCRYPT FUNCTION (REQUIRED BY META)
function encryptResponse(data) {
  const buffer = Buffer.from(JSON.stringify(data));

  const encrypted = crypto.privateEncrypt(
    {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    buffer
  );

  return encrypted.toString("base64");
}

// ✅ ROOT GET
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// ✅ ROOT POST (FLOW ENDPOINT)
app.post("/", (req, res) => {
  console.log("📩 Flow request:", req.body);

  let response;

  // 🔹 Health check (ping)
  if (req.body?.action === "ping") {
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

  const encrypted = encryptResponse(response);

  return res.status(200).json({
    data: encrypted
  });
});

// ✅ /flow POST (same logic)
app.post("/flow", (req, res) => {
  console.log("📩 /flow request:", req.body);

  let response;

  if (req.body?.action === "ping") {
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

  const base64 = Buffer.from(JSON.stringify(response)).toString("base64");

  return res.json({
    data: base64
  });
});

// ✅ PUBLIC KEY ENDPOINT (VERY IMPORTANT)
app.get("/.well-known/public-key", (req, res) => {
  console.log("👉 Meta requesting public key");

  if (!PUBLIC_KEY) {
    return res.status(500).send("public.pem not found");
  }

  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(PUBLIC_KEY.trim());
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
