const fs = require("fs");
const path = require("path");
const express = require("express");

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, "server.log");

function log(level, message) {
  fs.appendFile(LOG_FILE, `${new Date().toISOString()} [${level}] ${message}\n`, () => {});
}

const app = express();

app.use((req, res, next) => {
  log("DEBUG", `${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  log("ERROR", err.stack || String(err));
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT);
