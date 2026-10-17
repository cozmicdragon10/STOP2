// STOP2 web server: serves the static pages in public/ and the JSON API over HTTPS.
//
// Start with `npm start` (or `npm run dev` to restart on changes). Listens on
// PORT from the environment, defaulting to 3443. Needs a TLS key and certificate:
// TLS_KEY and TLS_CERT (file paths), defaulting to certs/key.pem and certs/cert.pem.
// Create a self-signed pair for local use with `npm run cert`.
const fs = require("fs");
const https = require("https");
const path = require("path");
const express = require("express");
const { db } = require("./db");
const { initDb } = require("./init-db");
const { loadSession, requireServerAccess } = require("./auth");
const authRouter = require("./routes/auth");

const PORT = process.env.PORT || 3443;
const TLS_KEY = process.env.TLS_KEY || path.join(__dirname, "certs", "key.pem");
const TLS_CERT = process.env.TLS_CERT || path.join(__dirname, "certs", "cert.pem");
const LOG_FILE = path.join(__dirname, "server.log");

if (!fs.existsSync(TLS_KEY) || !fs.existsSync(TLS_CERT)) {
  console.error(`TLS key or certificate not found (${TLS_KEY}, ${TLS_CERT}). Run "npm run cert" or set TLS_KEY and TLS_CERT.`);
  process.exit(1);
}

// Start each run with an empty log file.
fs.writeFileSync(LOG_FILE, "");

// Create tables and default roles before serving any request.
initDb();

// Appends to server.log without blocking the request.
function log(level, message) {
  fs.appendFile(LOG_FILE, `${new Date().toISOString()} [${level}] ${message}\n`, () => {});
}

const app = express();

// Log every request.
app.use((req, res, next) => {
  log("DEBUG", `${req.method} ${req.originalUrl}`);
  next();
});

// Static pages (index.html, register.html, telerik-license.js) are served before the
// API middleware, so they skip session lookup.
app.use(express.static(path.join(__dirname, "public")));

// Parse JSON request bodies, then look up the logged-in user (sets req.auth).
app.use(express.json());
app.use(loadSession);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/auth", authRouter);

// Protected: requires a logged-in user whose role has server_access.
app.get("/api/server/status", requireServerAccess, (req, res) => {
  res.json({ status: "ok", user: req.auth.user.username, uptime: process.uptime() });
});

// Unknown routes get a JSON 404.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Catches errors thrown by handlers. Details go to server.log, not to the client.
app.use((err, req, res, next) => {
  log("ERROR", err.stack || String(err));
  res.status(500).json({ error: "Internal server error" });
});

const server = https.createServer(
  { key: fs.readFileSync(TLS_KEY), cert: fs.readFileSync(TLS_CERT) },
  app,
);

server.listen(PORT, () => {
  console.log(`Server running at https://localhost:${PORT}`);
});
