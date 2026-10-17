# STOP2

This repository contains the STOP2 project.

## Description

STOP2 is an Express web server that serves HTTPS pages and a JSON API, backed by a local SQLite database.

## Quick start

From a fresh clone, run these in the project folder:

```bash
npm install                                                # 1. install dependencies
npm run cert                                               # 2. create the local HTTPS certificate (once)
node create-user.js <username> <email> <password> admin    # 3. create the first admin account (once)
npm start                                                  # 4. start the server
```

Then open https://localhost:3443/ and accept the self-signed certificate warning. Each later start only needs `npm start`. For development, `npm run dev` restarts the server when files change.

The steps are explained in detail under [Setup](#setup).

## Setup

### Requirements

- Node.js 24 or later (uses the built-in `node:sqlite` module).
- npm, to install dependencies.
- Internet access in the browser: the pages load jQuery and Kendo UI from CDNs.

No database server is needed. The SQLite file `data/app.db` is created on first start.

### Steps

```bash
npm install
npm run cert                                               # create a self-signed HTTPS certificate (first run only)
node create-user.js <username> <email> <password> <role>   # create the first admin account
npm start                                                  # https://localhost:3443
```

Then open https://localhost:3443/ to log in, or https://localhost:3443/register.html to sign up.

### Create the initial admin user

The register page cannot create admin accounts, so create the first admin from the command line with `create-user.js`:

```bash
node create-user.js <username> <email> <password> admin
```

- `<password>` must be at least 8 characters.
- The roles are `admin` (full access, including server administration) and `user` (no server access). Use `admin` for the first account.
- The script creates the database tables and default roles if they do not exist, so it works before the server has ever started.
- The password is passed as a command argument, so it may be saved in your shell history. Remove that line from your history afterward, or change the password later through `POST /api/auth/change-password`.
- Each username and email must be unique. Running the command again with the same values fails.

Example:

```bash
node create-user.js chris chris@example.com "a long passphrase" admin
```

Then log in at https://localhost:3443/ with that username and password.

## HTTPS

The server only serves HTTPS. There is no plain HTTP listener, so `http://localhost:3443` gets no response.

### How it works

- `server.js` creates an HTTPS server with `https.createServer` and passes it the Express app.
- It reads the private key and certificate from PEM files at startup. If either file is missing, the server prints an error and exits.
- Session cookies are marked `Secure`, so browsers only send them over HTTPS.

### Settings

| Variable   | Default          | Purpose                                      |
| ---------- | ---------------- | -------------------------------------------- |
| `PORT`     | `3443`           | Port the HTTPS server listens on             |
| `TLS_KEY`  | `certs/key.pem`  | Path to the PEM-encoded private key          |
| `TLS_CERT` | `certs/cert.pem` | Path to the PEM-encoded certificate          |

Set these in the shell that runs `npm start`. The server does not read a `.env` file, so values written there have no effect.

Example, using other files and port:

```bash
TLS_KEY=/etc/ssl/private/stop2.key TLS_CERT=/etc/ssl/certs/stop2.crt PORT=8443 npm start
```

### Local certificate

`npm run cert` runs `make-cert.js`, which creates a self-signed certificate for `localhost` and `127.0.0.1`, valid for 365 days. It writes `certs/key.pem` and `certs/cert.pem`. The `certs/` folder is git-ignored, so each machine makes its own certificate.

Browsers show a warning for self-signed certificates. Accept it for local use. Do not use a self-signed certificate for a public site.

To renew, delete `certs/` and run `npm run cert` again, then restart the server.

### Public site

Use a certificate from a trusted certificate authority (for example Let's Encrypt). Point `TLS_KEY` and `TLS_CERT` at its files, and set `PORT` if the server should listen on a port other than 3443.

The server does not redirect HTTP to HTTPS and does not listen on port 80. Requests to plain `http://` addresses get no response.

### Troubleshooting

- **`TLS key or certificate not found`**: run `npm run cert`, or set `TLS_KEY` and `TLS_CERT` to existing files.
- **Browser says "Not secure" or "Your connection is not private"**: expected with a self-signed certificate. Use a CA-issued certificate for a public site.
- **Login works but you are not kept logged in**: the session cookie is `Secure`, so the page must be opened with `https://`.

## Maintenance

- **Back up** `data/app.db`. The database uses WAL mode, so copy `data/app.db-wal` and `data/app.db-shm` too, or stop the server before copying.
- **Logs** are written to `server.log`. The file is cleared each time the server starts, so copy it first if you need the history.
- **Kendo UI license:** `public/telerik-license.js` sets the Kendo UI license key and is loaded by both pages. Keep it as is, or replace it with your own Telerik license.

## License

Specify a license for this project (e.g., MIT).

some addeed info
this seems to save directly to github