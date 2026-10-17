# STOP2 Documentation

## 1. Intent

STOP2 is a small Express web server with a built-in user account system. It has three goals:

1. **Accounts.** Visitors can create an account and log in. Users can change their own password.
2. **Roles.** Each user has one role. A role decides whether the user may use the server's protected endpoints (`server_access`).
3. **Simple to run.** One Node.js process, one SQLite file, no external services. It runs on Node 24, which includes the built-in `node:sqlite` module.

Out of scope for now: email verification, password reset by email, rate limiting, HTTPS termination, and a user admin UI.

## 2. Quick start

```bash
npm install
node create-user.js <username> <email> <password> <role>   # first admin, see section 6
npm start                                                  # http://localhost:3000
```

Environment variables:

| Name   | Default | Purpose              |
| ------ | ------- | -------------------- |
| `PORT` | `3000`  | HTTP port to listen on |

Open `http://localhost:3000/` to log in, and `http://localhost:3000/register.html` to create an account.

## 3. Project layout

| File | Purpose |
| ---- | ------- |
| `server.js` | Entry point. Sets up Express, middleware, static files, API routes and error handling. |
| `db.js` | Opens `data/app.db`. Exports the Drizzle instance `db` and the raw handle `sqlite`. |
| `schema.js` | Drizzle table definitions for `roles`, `users` and `sessions`. |
| `init-db.js` | Creates the tables and seeds the default roles. Runs on every start. |
| `auth.js` | Password hashing, sessions, cookies, and the `loadSession` / `requireLogin` / `requireServerAccess` middleware. |
| `routes/auth.js` | The `/api/auth/*` endpoints. |
| `create-user.js` | Command-line tool for creating accounts. |
| `public/index.html` | Home page: login, logout, change password. |
| `public/register.html` | Account sign-up page with a role dropdown. |
| `public/telerik-license.js` | Kendo UI license script, loaded by both pages. |
| `data/app.db` | SQLite database (created automatically). Git-ignored. |
| `server.log` | Request and error log, rewritten on each start. Git-ignored. |

Dependencies: `express` (web server), `drizzle-orm` (typed queries). Front end: jQuery and Kendo UI (Telerik), loaded from CDNs.

## 4. Data model

```
roles                         users                            sessions
-----                         -----                            --------
id             PK             id              PK               id          PK   (SHA-256 of token)
name           UNIQUE         username        UNIQUE           user_id     FK -> users.id  ON DELETE CASCADE
description                   email           UNIQUE           expires_at  ISO timestamp
server_access  boolean        password_hash                    created_at
                              role_id         FK -> roles.id   ON DELETE RESTRICT
                              is_active       boolean
                              created_at
```

Default roles, seeded by `init-db.js`:

| Name    | server_access | Description |
| ------- | ------------- | ----------- |
| `admin` | yes           | Full access, including server administration |
| `user`  | no            | Standard user with no server access |

Foreign keys are enforced (`PRAGMA foreign_keys = ON`). The database runs in WAL mode.

Schema changes: `schema.js` and the `CREATE TABLE` statements in `init-db.js` must be changed together. `drizzle-kit` is not used here, because it does not install on the target device.

## 5. API reference

All API responses are JSON. Errors have the form `{ "error": "message" }`.

Sessions use an HttpOnly cookie named `sid`, valid for 8 hours. Sign-in is required where noted.

### `GET /api/health`

Returns `{ "status": "ok", "uptime": <seconds> }`. Public.

### `POST /api/auth/login`

Body: `{ "username", "password" }`.

- `200`: `{ "username", "email" }` and sets the `sid` cookie.
- `400`: username or password missing.
- `401`: wrong credentials, unknown user, or disabled account. The message is the same in all three cases.

### `POST /api/auth/logout`

Deletes the current session and clears the cookie. Returns `204`. Works without a login.

### `GET /api/auth/me`

Requires login. Returns `{ "username", "email", "role", "server_access" }`. `401` if not logged in.

### `POST /api/auth/change-password`

Requires login. Body: `{ "current_password", "new_password" }`.

- `204`: password changed. All other sessions for the account are signed out; the current session stays active.
- `400`: missing fields, or new password shorter than 8 characters.
- `401`: not logged in, or the current password is wrong.

### `GET /api/auth/roles`

Public. Returns the roles the caller may assign: `[{ "name", "description", "server_access" }]`.

- Anonymous visitors and users without server access see only roles without `server_access`.
- Users with server access see all roles.

### `POST /api/auth/register`

Body: `{ "username", "email", "password", "role" }`.

Rules:

- Username: 3–32 characters, letters, digits and underscores only.
- Email: basic format check (`x@y.z`).
- Password: at least 8 characters.
- Role: must exist. A role with `server_access` can only be assigned by a logged-in user who has server access.

Responses:

- `201`: `{ "username", "email", "role" }`. The account is created, but the caller is not logged in.
- `400`: validation failed or unknown role.
- `403`: a role with server access was requested without server access.
- `409`: username or email already exists.

### `GET /api/server/status`

Protected example of server access. Returns `{ "status": "ok", "user", "uptime" }`.

- `401`: not logged in.
- `403`: logged in, but the role has no server access.

### Unknown routes

Any other path returns `404` with `{ "error": "Not found" }`.

## 6. Creating accounts from the command line

The register page cannot create an admin account without an admin already logged in. Use the CLI for the first admin:

```bash
node create-user.js <username> <email> <password> <role>
```

- Password must be at least 8 characters.
- The role must be `admin` or `user`.
- The password is visible in shell history and in the process list while the command runs. Clear the history entry afterwards if this matters.

## 7. Security design

| Concern | How it is handled |
| ------- | ----------------- |
| Password storage | scrypt with a random 16-byte salt per password, 64-byte key. Stored as `scrypt$<salt>$<hash>`. |
| Password comparison | Constant-time comparison (`crypto.timingSafeEqual`). |
| Session tokens | 32 random bytes. Only the SHA-256 hash is stored, so a copied database does not contain usable tokens. |
| Session cookie | `HttpOnly` (not readable by page scripts) and `SameSite=Lax`. |
| Session lifetime | 8 hours. Expired sessions are deleted when next seen. |
| Disabled accounts | Cannot log in, and their existing sessions stop working. |
| Login error messages | Identical for unknown user, wrong password and disabled account, so usernames are not revealed. |
| Privilege escalation | Anonymous sign-up cannot create roles with server access. |
| Password change | Requires the current password, so a stolen session alone is not enough. Other sessions are signed out. |
| Error details | Stack traces go to `server.log`, not to the client. |

### Known gaps

- **No rate limiting** on login or registration, so brute-force guessing is possible.
- **Cookie is not `Secure`.** Add it when the site is served over HTTPS.
- **No email verification** or password reset.
- **Minimum password length is 8**, with no other complexity rules.
- **Sign-up is public.** Anyone who can reach the server can create a `user` account.
- **Admins cannot change other users' passwords or roles** from the UI. There are no admin endpoints for this yet.

## 8. Front-end pages

Both pages load jQuery 3.7.1 and Kendo UI 2026.3.811 from CDNs, plus the Kendo default theme.

- **`index.html`** shows the login form. After login it shows the signed-in user and role, a Log out button, and a change-password form. On load it calls `/api/auth/me` to restore the view if a session exists.
- **`register.html`** shows the sign-up form. The role dropdown is filled from `/api/auth/roles`, and selecting a role shows its description. The client checks that the two password fields match; the server does the other validation.

Both pages show messages in a `role="alert"` element.

## 9. Design decisions and history

- **Drizzle with `node:sqlite`.** Drizzle 0.45 has no built-in driver for Node's `node:sqlite`. `db.js` uses Drizzle's `sqlite-proxy` driver and forwards each query to `node:sqlite`. Raw `db.all(sql\`…\`)` returns arrays, not objects. Typed queries return objects as usual.
- **`drizzle-kit` is not installed.** Its dependency tree includes an esbuild version that cannot install on the target device (arm64 Android). Tables are created by `init-db.js` instead.
- **Kendo UI** is used for the front-end widgets, as the project already did.
- **Sessions are stored in the database** rather than in memory, so they survive restarts.
- **`server.log` is cleared on start**, so the file only shows the current run.

## 10. Testing

These were checked against a running server:

- Login success and failure, and logout.
- Server-access guard: `401` without login, `403` without access, `200` with access.
- Registration: success, duplicate (`409`), invalid input (`400`), and the admin-role rule (`403`).
- Change password: wrong current password, short password, other sessions signed out, current session kept.
- Role list filtering for anonymous visitors.

Not yet tested: session expiry after 8 hours, and disabled accounts. There is no automated test suite. Adding one (for example with Node's built-in `node:test`) is a sensible next step.

## 11. Maintenance

- **Back up** `data/app.db`. With WAL mode, copy the `-wal` and `-shm` files too, or stop the server first.
- **Logs** are in `server.log`. They are rewritten on each start, so save them first if you need history.
- **Changing defaults:** role names and descriptions can be edited in the database. `init-db.js` inserts defaults only when they are missing.
