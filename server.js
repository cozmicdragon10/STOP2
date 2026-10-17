const fs = require("fs");
const path = require("path");
const express = require("express");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, "server.log");

fs.writeFileSync(LOG_FILE, "");

function log(level, message) {
  fs.appendFile(LOG_FILE, `${new Date().toISOString()} [${level}] ${message}\n`, () => {});
}

const app = express();

app.use((req, res, next) => {
  log("DEBUG", `${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async (req, res) => {
  let database = "ok";
  try {
    await db.checkConnection();
  } catch (err) {
    database = "unavailable";
    log("ERROR", `Database health check failed: ${err.message}`);
  }
  res.status(database === "ok" ? 200 : 503).json({
    status: database === "ok" ? "ok" : "degraded",
    database,
    uptime: process.uptime(),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  log("ERROR", err.stack || String(err));
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

async function shutdown() {
  server.close();
  await db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
