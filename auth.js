// Authentication helpers: password hashing, sessions, cookies and route guards.
//
// Used by routes/auth.js (login, register, etc.), server.js (guards the
// protected routes) and create-user.js (hashes new passwords).
const crypto = require("crypto");
const { promisify } = require("util");
const { eq } = require("drizzle-orm");
const { db } = require("./db");
const { roles, users, sessions } = require("./schema");

// scrypt is callback-based; promisify lets us use await.
const scrypt = promisify(crypto.scrypt);

// Name of the cookie that holds the session token.
const COOKIE_NAME = "sid";
// How long a login lasts. After this the user must log in again.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Sessions are stored by the hash of their token, so the database never holds a usable token.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Produces "scrypt$<salt>$<hash>". A random salt per password means identical
// passwords get different hashes. The scheme name lets us change algorithms later.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

// Recomputes the hash with the stored salt and compares in constant time,
// so the comparison does not leak how many characters matched.
async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;

  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Creates a session for a user. Returns the raw token (to send to the browser)
// and its expiry. Only the hash of the token is stored.
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id: hashToken(token),
    user_id: userId,
    expires_at: expiresAt.toISOString(),
  });

  return { token, expiresAt };
}

// Removes a session, which logs that browser out.
async function deleteSession(token) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

// Returns { user, role } for a valid, unexpired session, or null.
// Expired sessions are deleted when they are found.
async function findSession(token) {
  const row = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .innerJoin(roles, eq(users.role_id, roles.id))
    .where(eq(sessions.id, hashToken(token)))
    .get();

  if (!row) return null;
  // ISO timestamps compare correctly as strings.
  if (row.sessions.expires_at <= new Date().toISOString()) {
    await deleteSession(token);
    return null;
  }
  // A disabled account loses access even while its session is still valid.
  if (!row.users.is_active) return null;

  return { user: row.users, role: row.roles };
}

// Parses a Cookie header ("a=1; b=2") into an object. Malformed parts are skipped.
function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

// HttpOnly keeps the token away from page JavaScript; SameSite=Lax limits cross-site sending.
// Secure means the browser only sends the cookie over HTTPS.
function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
}

// Middleware: attaches req.auth = { user, role } when a valid session cookie is present.
// Does not block the request; use requireLogin or requireServerAccess to enforce access.
async function loadSession(req, res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  req.auth = token ? await findSession(token) : null;
  req.sessionToken = token;
  next();
}

// Middleware: rejects requests without a logged-in user (401).
function requireLogin(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: "Login required" });
  next();
}

// Middleware: rejects requests unless the user is logged in and their role has server access.
// 401 means not logged in; 403 means logged in but not allowed.
function requireServerAccess(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: "Login required" });
  if (!req.auth.role.server_access) return res.status(403).json({ error: "Server access denied" });
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  hashToken,
  setSessionCookie,
  clearSessionCookie,
  loadSession,
  requireLogin,
  requireServerAccess,
  SESSION_TTL_MS,
};
