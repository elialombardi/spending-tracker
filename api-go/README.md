This is a minimal Go replacement API for the Spending Tracker frontend using Fiber.

Run locally:

1. Install Go (1.20+)
2. From this folder, run:

```bash
go run .
```

Defaults:
- Listens on port 7004 (to match the existing frontend default API_BASE in dev)
- Development user: username `admin`, password `dev-password-change-me` (read from `VITE_AUTH_USERNAME`/`VITE_AUTH_PASSWORD` env if set)
- JWT signing key: read from `JWT_SIGNING_KEY` or defaults to a development key (change for production)

Implemented endpoints (under `/api`):
- POST `/api/auth/token` — body `{ username, password }` → returns `{ accessToken, tokenType, expiresAt, username, role }`
- GET `/api/locations`
- GET `/api/locations/:id`
- POST `/api/locations` (requires Writer/Admin role)
- PUT `/api/locations/:id` (requires Writer/Admin role)
- DELETE `/api/locations/:id` (requires Writer/Admin role)
- POST `/api/locations/:id/tags` (requires Writer/Admin role)
- GET `/api/tags`
- POST `/api/tags` (requires Writer/Admin role)
- PATCH `/api/tags/:name` (requires Writer/Admin role)
- DELETE `/api/tags/:name` (requires Writer/Admin role)

Notes:
- This implementation uses an in-memory store for simplicity — data is not persisted between runs.
- JWT tokens are signed with the `JWT_SIGNING_KEY` env var (set to a secure random value for production).

If you want I can wire this into the Docker build or provide a persistent storage (SQLite) implementation.
