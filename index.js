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

// ✅ ROOT
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// ✅ TEST
app.get("/test", (req, res) => {
  res.send("Test OK");
});

// ✅ PUBLIC KEY (META USES THIS)
app.get("/.well-known/public-key", (req, res) => {
  console.log("👉 Meta requesting public key");

  if (!PUBLIC_KEY) {
    return res.status(500).send("public.pem not found");
  }

  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(PUBLIC_KEY.trim());
});

// ✅ FLOW ENDPOINT (CRITICAL — META HANDSHAKE)
app.post("/flow", (req, res) => {
  console.log("📩 Flow request:", req.body);

  // ✅ HANDLE META HEALTH CHECK
  if (req.body?.action === "ping") {
    return res.status(200).json({
      version: "1.0",
      data: {
        status: "active"
      }
    });
  }

  // ✅ NORMAL FLOW RESPONSE
  return res.status(200).json({
    version: "1.0",
    screen: "SUCCESS",
    data: {}
  });
});

// ✅ ALSO HANDLE GET /flow (Meta sometimes checks this)
app.get("/flow", (req, res) => {
  res.status(200).send("Flow endpoint ready ✅");
});

// 🚀 START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
