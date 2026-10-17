const fs = require("fs");
const path = require("path");
const express = require("express");
const { db } = require("./db");
const { initDb } = require("./init-db");
const { loadSession, requireServerAccess } = require("./auth");
const authRouter = require("./routes/auth");

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, "server.log");

fs.writeFileSync(LOG_FILE, "");

initDb();

function log(level, message) {
  fs.appendFile(LOG_FILE, `${new Date().toISOString()} [${level}] ${message}\n`, () => {});
}

const app = express();

app.use((req, res, next) => {
  log("DEBUG", `${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

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

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  log("ERROR", err.stack || String(err));
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
