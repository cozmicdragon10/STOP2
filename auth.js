const crypto = require("crypto");
const { promisify } = require("util");
const { eq } = require("drizzle-orm");
const { db } = require("./db");
const { roles, users, sessions } = require("./schema");

const scrypt = promisify(crypto.scrypt);

const COOKIE_NAME = "sid";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;

  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

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

async function deleteSession(token) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

// Returns { user, role } for a valid, unexpired session, or null.
async function findSession(token) {
  const row = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .innerJoin(roles, eq(users.role_id, roles.id))
    .where(eq(sessions.id, hashToken(token)))
    .get();

  if (!row) return null;
  if (row.sessions.expires_at <= new Date().toISOString()) {
    await deleteSession(token);
    return null;
  }
  if (!row.users.is_active) return null;

  return { user: row.users, role: row.roles };
}

function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/" });
}

// Attaches req.auth = { user, role } when a valid session cookie is present.
async function loadSession(req, res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  req.auth = token ? await findSession(token) : null;
  req.sessionToken = token;
  next();
}

function requireLogin(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: "Login required" });
  next();
}

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
