const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// 🔍 DEBUG LOGS
app.use((req, res, next) => {
  console.log("Incoming:", req.method, req.url);
  next();
});

// 🔑 LOAD PUBLIC KEY
let PUBLIC_KEY = "";

try {
  PUBLIC_KEY = fs.readFileSync(path.join(__dirname, "public.pem"), "utf8");
} catch (e) {
  console.log("❌ public.pem missing");
}

// ✅ ROOT (optional)
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// ✅ PUBLIC KEY ENDPOINT (REQUIRED)
app.get("/.well-known/public-key", (req, res) => {
  console.log("👉 Meta requesting public key");

  if (!PUBLIC_KEY) {
    return res.status(500).send("public.pem not found");
  }

  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(PUBLIC_KEY.trim());
});

// ✅ HEALTH CHECK (CRITICAL)
app.get("/flow", (req, res) => {
  const VERIFY_TOKEN = "my_verify_token";

  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ✅ FLOW HANDLER (CRITICAL)
app.post("/flow", (req, res) => {
  console.log("📩 Flow request:", req.body);

  // Meta ping check
  if (req.body?.action === "ping") {
    return res.status(200).json({
      version: "1.0",
      data: { status: "active" }
    });
  }

  // Default success response
  return res.status(200).json({
    version: "1.0",
    screen: "SUCCESS",
    data: {}
  });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
