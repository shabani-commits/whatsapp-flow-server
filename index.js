const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ✅ DEBUG (see requests in logs)
app.use((req, res, next) => {
  console.log("Incoming:", req.method, req.url);
  next();
});

// ✅ LOAD KEYS (SAFE)
let PRIVATE_KEY = "";
let PUBLIC_KEY = "";

try {
  PRIVATE_KEY = fs.readFileSync(path.join(__dirname, "private.pem"), "utf8");
} catch (e) {
  console.log("private.pem missing");
}

try {
  PUBLIC_KEY = fs.readFileSync(path.join(__dirname, "public.pem"), "utf8");
} catch (e) {
  console.log("public.pem missing");
}

// ✅ HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// ✅ PUBLIC KEY (THIS IS THE IMPORTANT ONE)
app.get("/.well-known/public-key", (req, res) => {
  if (!PUBLIC_KEY) {
    return res.status(500).send("public.pem not found");
  }

  res.setHeader("Content-Type", "text/plain");
  res.send(PUBLIC_KEY);
});

// ✅ SIMPLE TEST ENDPOINT
app.get("/test", (req, res) => {
  res.send("Test OK");
});

// ❌ REMOVE STATIC / FOLDER STUFF (DO NOT ADD AGAIN)

// ✅ START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
}); 
