# AGENTS.md

## Project Overview

BetterProxy is a single-file Node.js HTTP proxy server (`server.js`). It uses only Node.js built-in modules (`http`, `dns`, `net`, `fetch`) — no npm dependencies, no `node_modules`.

## Running

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- App listens on port 3000 (set via `PORT` env var in compose).
- No external credentials or secrets required.
- No database, no migrations, no seeds.

## Key Endpoints

- `GET /` — health check ("BetterProxy backend is running!")
- `GET /test` — HTML test page for HTTP method testing
- `ANY /method-test` — echoes back method, path, and body
- `ANY /proxy/<base64url-encoded-url>` — proxies the target URL

## Notes

- `server.js` had a stray `];` syntax error after `isBlockedHost()` that was fixed during setup.
- The app blocks private/internal IP destinations (SSRF protection) via DNS resolution checks.
- `BACKEND_URL` is hardcoded to `https://betterproxy-backend.onrender.com` and is used to rewrite redirect Location headers in proxied responses.
- Node 22 is required (uses global `fetch`).
