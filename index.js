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

// ✅ ROOT POST (🔥 IMPORTANT FIX)
app.post("/", (req, res) => {
  console.log("📩 ROOT Flow request:", req.body);

  if (req.body?.action === "ping") {
    return res.status(200).json({
      version: "1.0",
      data: { status: "active" }
    });
  }

  return res.status(200).json({
    version: "1.0",
    screen: "SUCCESS",
    data: {}
  });
});

// ✅ TEST
app.get("/test", (req, res) => {
  res.send("Test OK");
});

// ✅ PUBLIC KEY
app.get("/.well-known/public-key", (req, res) => {
  console.log("👉 Meta requesting public key");

  if (!PUBLIC_KEY) {
    return res.status(500).send("public.pem not found");
  }

  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(PUBLIC_KEY.trim());
});

// ✅ OPTIONAL /flow (safe to keep)
app.post("/flow", (req, res) => {
  console.log("📩 /flow request:", req.body);

  if (req.body?.action === "ping") {
    return res.json({ status: "ok" });
  }

  return res.json({
    screen: "SUCCESS",
    data: {}
  });
});

app.get("/flow", (req, res) => {
  res.send("Flow endpoint ready ✅");
});

// 🚀 START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
