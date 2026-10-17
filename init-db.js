// Creates the auth tables and seeds the default roles.
//
// Runs on every server start (and from create-user.js). Every statement is
// idempotent, so running it repeatedly does not duplicate data.
const { sqlite } = require("./db");

// Matches schema.js; keep the two in sync.
function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      server_access INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Default roles. INSERT OR IGNORE keeps existing rows (and any later edits) untouched.
  // "admin" can use the server and assign any role; "user" cannot use the server.
  const insertRole = sqlite.prepare(
    "INSERT OR IGNORE INTO roles (name, description, server_access) VALUES (?, ?, ?)"
  );
  insertRole.run("admin", "Full access, including server administration", 1);
  insertRole.run("user", "Standard user with no server access", 0);
}

module.exports = { initDb };
