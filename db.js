// Database connection for the app.
//
// Opens the SQLite file at data/app.db and exports:
//   db      - a Drizzle ORM instance used for typed queries
//   sqlite  - the raw node:sqlite handle, used for schema setup and raw SQL
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { drizzle } = require("drizzle-orm/sqlite-proxy");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "app.db");

// Create the data folder on first run so the database file can be written.
fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new DatabaseSync(DB_FILE);

// WAL lets readers and a writer work at the same time.
// Foreign keys are off by default in SQLite, so turn them on explicitly.
sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// Drizzle has no built-in node:sqlite driver, so run queries through the
// sqlite-proxy driver. Rows come back as arrays so Drizzle can map columns by position.
const db = drizzle(async (sql, params, method) => {
  const stmt = sqlite.prepare(sql);

  // "run" is used for INSERT/UPDATE/DELETE; there are no rows to return.
  if (method === "run") {
    stmt.run(...params);
    return { rows: [] };
  }

  stmt.setReturnArrays(true);

  // "get" returns one row (or undefined); anything else returns all rows.
  if (method === "get") {
    return { rows: stmt.get(...params) };
  }

  return { rows: stmt.all(...params) };
});

module.exports = { db, sqlite };
