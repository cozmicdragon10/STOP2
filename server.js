// STOP2 web server: serves the static pages in public/ and the JSON API.
//
// Start with `npm start` (or `npm run dev` to restart on changes). Listens on
// PORT from the environment, defaulting to 3000.
const fs = require("fs");
const path = require("path");
const express = require("express");
const { db } = require("./db");
const { initDb } = require("./init-db");
const { loadSession, requireServerAccess } = require("./auth");
const authRouter = require("./routes/auth");

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, "server.log");

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
