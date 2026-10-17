# STOP2

This repository contains the STOP2 project.

## Description

Initial README added by GitHub Copilot. Replace this text with project overview, setup instructions, and contribution guidelines.

## Database (PostgreSQL)

The app connects to PostgreSQL through `DATABASE_URL` (see `db.js`). The default is `postgres://stop2:stop2@localhost:5432/stop2`.

1. Start the database: `docker compose up -d`
2. Copy `.env.example` to `.env` and adjust the values if needed.
3. Install dependencies: `npm install`
4. Start the server: `npm start`

`GET /api/health` reports database status and returns 503 when PostgreSQL is unreachable.

## License

Specify a license for this project (e.g., MIT).

some addeed info
this seems to save directly to github