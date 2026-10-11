# Crime Hotspot Analysis & Prediction Portal

Full-stack version of `crime-portal-prototype.html` — same UI and features, now with a real backend.

## Run
Requires Node.js 16+ (no `npm install` needed, zero dependencies).

    cd crime-portal
    npm start          # or: node backend/server.js

Open http://localhost:3000

- Demo admin: `admin` / `admin123`
- Police access code: `POL-2026` (override with env `POLICE_CODE`; port with `PORT`)
- Citizens can register from the Register tab.

## Structure
    backend/server.js   REST API, auth (scrypt-hashed passwords, bearer tokens), role checks, static hosting
    backend/seed.js     demo data (120 incidents, 3 complaints) + password helpers
    backend/data/       db.json is created here on first run (delete it to reset)
    frontend/           index.html, styles.css, app.js (UI, maps, charts, hotspot/prediction analytics)

## API (all under /api, Bearer token except login/register)
POST auth/register | auth/login | auth/logout | auth/police-code · GET state · POST audit
POST complaints · PATCH complaints/:id (police) · DELETE complaints/:id (admin)
POST crimes (police) · POST crimes/upload (police, CSV) · DELETE crimes/:id (admin)
POST sos · PATCH sos/:id (police) · PUT patrols (police)
PATCH/DELETE users/:name (admin) · POST reset (admin)

Map tiles load from OpenStreetMap, so they need an internet connection.
