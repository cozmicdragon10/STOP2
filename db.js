const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { drizzle } = require("drizzle-orm/sqlite-proxy");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "app.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new DatabaseSync(DB_FILE);

sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// Drizzle has no built-in node:sqlite driver, so run queries through the
// sqlite-proxy driver. Rows come back as arrays so Drizzle can map columns by position.
const db = drizzle(async (sql, params, method) => {
  const stmt = sqlite.prepare(sql);

  if (method === "run") {
    stmt.run(...params);
    return { rows: [] };
  }

  stmt.setReturnArrays(true);

  if (method === "get") {
    return { rows: stmt.get(...params) };
  }

  return { rows: stmt.all(...params) };
});

module.exports = { db, sqlite };
