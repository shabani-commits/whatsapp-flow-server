const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ✅ DEBUG (logs every request)
app.use((req, res, next) => {
  console.log("Incoming:", req.method, req.url);
  next();
});

// ✅ LOAD KEYS
let PRIVATE_KEY = "";
let PUBLIC_KEY = "";

try {
  PRIVATE_KEY = fs.readFileSync(path.join(__dirname, "private.pem"), "utf8");
} catch (e) {
  console.log("❌ private.pem missing");
}

try {
  PUBLIC_KEY = fs.readFileSync(path.join(__dirname, "public.pem"), "utf8");
} catch (e) {
  console.log("❌ public.pem missing");
}

// ✅ ROOT CHECK
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// ✅ TEST ROUTE (for debugging)
app.get("/test", (req, res) => {
  res.send("Test OK");
});

// ✅ PUBLIC KEY (MAIN - META USES THIS)
app.get("/.well-known/public-key", (req, res) => {
  res.sendFile(path.join(__dirname, ".well-known", "public-key"));
});

// ✅ BACKUP ROUTE (FOR YOU TO TEST)
app.get("/public-key", (req, res) => {
  console.log("👉 Backup public key route");

  if (!PUBLIC_KEY) {
    return res.status(500).send("public.pem not found");
  }

  res.setHeader("Content-Type", "text/plain");
  res.send(PUBLIC_KEY);
});

// ❌ DO NOT ADD STATIC OR .well-known FOLDER SERVING

// ✅ START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
