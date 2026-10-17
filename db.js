const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://stop2:stop2@localhost:5432/stop2",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function checkConnection() {
  const result = await pool.query("SELECT 1 AS ok");
  return result.rows[0].ok === 1;
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, checkConnection, close };
