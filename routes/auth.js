const express = require("express");
const { and, eq, ne, or } = require("drizzle-orm");
const { db } = require("../db");
const { roles, sessions, users } = require("../schema");
const { hashPassword, hashToken } = require("../auth");
const {
  verifyPassword,
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  requireLogin,
} = require("../auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await db.select().from(users).where(eq(users.username, username)).get();

  // Same message for unknown user, wrong password, and disabled account.
  const valid = user && user.is_active && (await verifyPassword(password, user.password_hash));
  if (!valid) return res.status(401).json({ error: "Invalid username or password" });

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ username: user.username, email: user.email });
});

router.post("/logout", async (req, res) => {
  if (req.sessionToken) await deleteSession(req.sessionToken);
  clearSessionCookie(res);
  res.status(204).end();
});

router.post("/change-password", requireLogin, async (req, res) => {
  const { current_password, new_password } = req.body ?? {};
  if (typeof current_password !== "string" || typeof new_password !== "string") {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const user = await db.select().from(users).where(eq(users.id, req.auth.user.id)).get();
  if (!(await verifyPassword(current_password, user.password_hash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  await db
    .update(users)
    .set({ password_hash: await hashPassword(new_password) })
    .where(eq(users.id, user.id));

  // Sign out every other session for this account; keep the one making the change.
  await db
    .delete(sessions)
    .where(and(eq(sessions.user_id, user.id), ne(sessions.id, hashToken(req.sessionToken))));

  res.status(204).end();
});

router.get("/me", requireLogin, (req, res) => {
  res.json({
    username: req.auth.user.username,
    email: req.auth.user.email,
    role: req.auth.role.name,
    server_access: req.auth.role.server_access,
  });
});

// Roles a visitor may pick. Anyone can see roles without server access;
// only a logged-in user with server access sees (and can assign) the rest.
router.get("/roles", async (req, res) => {
  const all = await db
    .select({ name: roles.name, description: roles.description, server_access: roles.server_access })
    .from(roles)
    .all();

  const canAssignAny = Boolean(req.auth?.role.server_access);
  res.json(canAssignAny ? all : all.filter((role) => !role.server_access));
});

router.post("/register", async (req, res) => {
  const { username, email, password, role } = req.body ?? {};

  if (typeof username !== "string" || !/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3-32 letters, numbers or underscores" });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email address is required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (typeof role !== "string") {
    return res.status(400).json({ error: "Role is required" });
  }

  const selected = await db.select().from(roles).where(eq(roles.name, role)).get();
  if (!selected) return res.status(400).json({ error: "Unknown role" });
  if (selected.server_access && !req.auth?.role.server_access) {
    return res.status(403).json({ error: "Only users with server access can create this role" });
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)))
    .get();
  if (existing) return res.status(409).json({ error: "Username or email already exists" });

  await db.insert(users).values({
    username,
    email,
    password_hash: await hashPassword(password),
    role_id: selected.id,
  });

  res.status(201).json({ username, email, role: selected.name });
});

module.exports = router;
