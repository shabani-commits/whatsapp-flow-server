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

// ✅ ROOT GET
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// ✅ ROOT POST (🔥 FIXED FOR BASE64)
app.post("/", (req, res) => {
  console.log("📩 Flow request:", req.body);

  // ✅ Health check (ping)
  if (req.body?.action === "ping") {
    const response = {
      version: "1.0",
      data: { status: "active" }
    };

    return res.status(200).json({
      data: Buffer.from(JSON.stringify(response)).toString("base64")
    });
  }

  // ✅ Normal Flow response
  const response = {
    version: "1.0",
    screen: "SUCCESS",
    data: {}
  };

  return res.status(200).json({
    data: Buffer.from(JSON.stringify(response)).toString("base64")
  });
});

// ✅ TEST
app.get("/test", (req, res) => {
  res.send("Test OK");
});

// ✅ PUBLIC KEY (VERY IMPORTANT)
app.get("/.well-known/public-key", (req, res) => {
  console.log("👉 Meta requesting public key");

  if (!PUBLIC_KEY) {
    return res.status(500).send("public.pem not found");
  }

  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(PUBLIC_KEY.trim());
});

// ✅ OPTIONAL /flow (same logic)
app.post("/flow", (req, res) => {
  console.log("📩 /flow request:", req.body);

  if (req.body?.action === "ping") {
    const response = {
      version: "1.0",
      data: { status: "active" }
    };

    return res.json({
      data: Buffer.from(JSON.stringify(response)).toString("base64")
    });
  }

  const response = {
    version: "1.0",
    screen: "SUCCESS",
    data: {}
  };

  return res.json({
    data: Buffer.from(JSON.stringify(response)).toString("base64")
  });
});

// ✅ VERIFY WEBHOOK
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
