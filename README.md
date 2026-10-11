# Crime Hotspot Analysis & Prediction Portal (v2)

Spring Boot (Java 17) backend + Vite frontend. Looks and behaves like `crime-portal-prototype.html`.

```
crime-portal-v2/
├─ backend/    Spring Boot + Maven (REST API, login, roles, data in data/db.json)
├─ frontend/   Vite app (src/main.js, src/styles.css, index.html)
├─ sample/     sample-crimes.csv for the CSV upload feature
├─ docker-compose.yml, render.yaml
```

## Run locally (two terminals)
Requirements: JDK 17+, Maven 3.9+, Node 18+.

    # terminal 1 - backend  (http://localhost:8080)
    cd backend
    mvn spring-boot:run

    # terminal 2 - frontend (http://localhost:5173)
    cd frontend
    npm install
    npm run dev

Open http://localhost:5173

## Run with Docker
    docker compose up --build
Open http://localhost:3000

## Logins
- Admin: `admin` / `admin123`
- Police access code: `POL-2026` (env `POLICE_CODE`)
- Citizens: use the Register tab.

## Configuration
Backend env vars: `PORT` (8080), `DATA_FILE` (./data/db.json), `POLICE_CODE`, `CORS_ORIGINS`.
Frontend env (`.env`, see `.env.example`): `VITE_API_URL` (only when hosted separately), `VITE_PROXY_TARGET`.
Delete `backend/data/db.json` to reset to the demo data.

## API (under /api, Bearer token except login/register)
POST auth/register | auth/login | auth/logout | auth/police-code · GET state · POST audit
POST complaints · PATCH complaints/{id} (police) · DELETE complaints/{id} (admin)
POST crimes (police) · POST crimes/upload (police) · DELETE crimes/{id} (admin)
POST sos · PATCH sos/{id} (police) · PUT patrols (police)
PATCH/DELETE users/{name} (admin) · POST reset (admin)

Map tiles come from OpenStreetMap, so the map background needs internet.
