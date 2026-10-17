const { sqliteTable, integer, text } = require("drizzle-orm/sqlite-core");
const { sql } = require("drizzle-orm");

// Roles control what a user may do. `server_access` decides whether a role may
// use the server's protected endpoints.
const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  server_access: integer("server_access", { mode: "boolean" }).notNull().default(false),
});

// Passwords are stored only as a hash (see hashPassword in auth.js), never in plain text.
const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role_id: integer("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "restrict" }),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// A session row is keyed by the SHA-256 of the token sent to the browser,
// so a leaked database does not expose live session tokens.
const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires_at: text("expires_at").notNull(),
  created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
});

module.exports = { roles, users, sessions };
