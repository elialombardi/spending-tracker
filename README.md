# Spending Tracker: AI Section Implementation Prompt

## Biometric device authentication

The implementation uses the repository's existing **Fiber v3 / Go 1.26**
stack (rather than a separate Fiber v2 / Go 1.22 service).

Enable the endpoints in the full API with `BIOMETRIC_AUTH_ENABLED=true`.
It defaults to false to preserve existing deployments. Set `JWT_SIGNING_KEY`
to a securely generated secret of at least 32 bytes; enabling biometric auth
without it fails startup. Password and biometric tokens share this key and
the existing `JWT_ISSUER` / `JWT_AUDIENCE` settings. Device public keys and
ownership are persisted in the database; startup migrates the `devices` table.

Alternatively, `cd api-go && go run ./cmd/api` runs an auth-only entry point
with password login and biometric endpoints always enabled. It uses
`SPENDING_TRACKER_CONNECTION_STRING` and `PORT` (default 7004), and expects
existing user accounts. The root `go run .` remains the full application.

| POST endpoint | Request JSON | Success |
| --- | --- | --- |
| `/api/v1/auth/register-device` | `{"device_id":"phone-uuid","public_key_pem":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n","device_name":"Android"}` | 201 created, 200 updated; `{"device_id":"phone-uuid"}` |
| `/api/v1/auth/challenge` | `{"device_id":"phone-uuid"}` | `{"challenge":"base64url-nonce","expires_at":"RFC3339 timestamp"}` |
| `/api/v1/auth/verify-challenge` | `{"device_id":"phone-uuid","signature_b64":"standard-base64-DER-signature"}` | `{"access_token":"JWT","expires_in":900,"role":"Writer"}` |

Registration requires `Authorization: Bearer <password-login-token>` from the
existing `/api/auth/login` endpoint. Biometric-issued tokens cannot enroll or
replace keys. Device IDs are 1-128 ASCII letters, digits, hyphens, or underscores;
device names are nonblank and at most 200 bytes. A device ID cannot be taken
over by another account. Re-registering the same account/device updates its key
and name; a key change invalidates outstanding challenges.

Verification returns the account's current database role alongside the token.
The role is informational for clients; API authorization remains server-enforced.

### Android signing and security model

1. Generate an ECDSA P-256 key in Android Keystore with
   `setUserAuthenticationRequired(true)` and biometric authentication required
   for each signing operation. Use `BiometricPrompt` with a signing `CryptoObject`.
   Register the X.509 SubjectPublicKeyInfo public key as `PUBLIC KEY` PEM.
2. Base64url-decode the returned challenge (no padding) into **32 raw bytes**.
   Sign those bytes using Android `SHA256withECDSA`; encode the resulting ASN.1
   DER signature with standard padded base64, without line breaks. Do not sign
   the base64url text or hash twice.
3. Keep the returned 15-minute JWT **only in memory** and send it as a Bearer
   token to existing protected API routes. Never persist password-login or
   biometric JWTs in preferences, files, or a token store. After process death
   or token expiry, perform a new biometric challenge flow; there is no refresh
   token. The private key never leaves Keystore.

Challenges expire after 60 seconds. A new challenge replaces the previous one
for that device. Verification atomically deletes the challenge before decoding
or checking the signature, including failed/malformed signatures; replay or
expiry returns 410. Invalid signatures and ownership conflicts return generic
401 errors. Unknown devices receive indistinguishable challenge responses but
cannot authenticate. Backend errors return 503. Each public endpoint has separate
limits of five requests/minute per device ID **and** per IP (429).

Set `REDIS_URL` (including credentials/TLS if needed) to use Redis 6.2+ atomic
`GETDEL`. If Redis is unset or unavailable at startup, a mutex-protected memory
store provides the same TTL/single-use behavior and emits a warning. A running
process never switches backends: runtime Redis failures fail closed, preventing
replay through inconsistent stores. Memory challenges are lost on restart and
are suitable only for a single API instance. Rate limits are process-local even
with Redis; enforce distributed limits at the gateway for multiple replicas.
Use direct peer IPs, or explicitly configure trusted proxies before relying on
forwarded IP headers; the API does not blindly trust them.

Use HTTPS throughout. Logs include device IDs and outcomes, never raw nonces,
signatures, or tokens. Verification logs include the submitted base64 signature
length and a server-only failure reason: missing/expired/consumed challenge,
invalid standard base64, unknown device, changed ownership/key, or failed ECDSA
verification (with decoded signature length). Client error responses remain
generic. For missing challenges, also check whether requests reach different API
instances while using the process-local memory store. The server verifies possession of the registered key,
not the biometric itself; enforcing biometric-only use is the client's Keystore
responsibility (no Android key attestation is implemented). Existing password
token lifetime settings are unchanged. Hardware attestation is outside this
implementation.

### Managing registered devices

Open **Registered devices** from the user menu to list, rename, or revoke your
own devices. These endpoints require a password-login Bearer token and
`BIOMETRIC_AUTH_ENABLED=true`, just like enrollment:

| Method | Endpoint | Success |
| --- | --- | --- |
| GET | `/api/v1/auth/devices` | Array of `{"device_id":"...","device_name":"..."}` |
| PATCH | `/api/v1/auth/devices/:deviceID` | Send `{"device_name":"New name"}`; returns the renamed device |
| DELETE | `/api/v1/auth/devices/:deviceID` | 204; removes the device and consumes any outstanding challenge |

Other accounts' devices and unknown IDs both return 404 on changes. Public
keys and account IDs are not included in list responses. Names must be nonblank
and at most 200 UTF-8 bytes. Revocation prevents future biometric sign-ins;
already-issued access tokens remain valid until expiry (up to 15 minutes).
Renaming does not change the key or invalidate challenges. Deploy both the API
and frontend updates to enable this page.

Run focused tests with `cd api-go && go test -race ./internal/auth ./internal/middleware ./user`.
Redis store tests use an in-process Redis test server, not a local Redis service.
The race detector requires cgo and a C compiler; without them, omit `-race`.

For manual testing in VS Code REST Client, use [auth.http](api-go/requests/auth.http).
Set the API origin and credentials, then run password login, device registration,
challenge, and verification in order. The file includes a valid registration-only
sample public key and instructions for generating your own key and signing a
challenge. Registration must use `POST /api/v1/auth/register-device`, not the
unversioned login prefix. If it returns 405, check the method and API origin, and
ensure biometric auth is enabled and the full API has been restarted.

## Mobile app handoffs

- [Notes & Lists](MOBILE_NOTES_HANDOFF.md): folder types, typed editors,
  folder-only navigation, modern UI direction, API contracts, and QA checklist.
- [Tasks](MOBILE_TASKS_HANDOFF.md): project/work tasks and the Not sent / Sent
  workflow; distinct from a Notes folder of type `tasks_list`.
- [Fuel Manager](MOBILE_FUEL_HANDOFF.md): fill-cycle rules, statistics, and history.

## Correctness regression checks

Run `cd api-go && go test ./notes ./reports ./locations` to check nested note
folders, transaction summaries, and location update persistence.

### Note and folder ordering

Notes and folders have a non-negative integer `position`, editable in the note
editor and the folder's Edit dialog. Lower positions appear first: folders among
siblings (including roots), and notes within their folder. Notes and child
folders remain separate groups. Equal folder positions sort by name then ID;
equal note positions sort by last update descending then ID.

Create and update requests for `/api/notes` and `/api/note-folders` accept
`position`, and their responses and `/api/note-folders/tree` include it. Omitted
create positions default to 0; omitted update positions preserve the stored
value, and explicit 0 resets it. Negative or fractional positions are rejected.
Startup AutoMigrate adds the columns with default 0 to existing records,
preserving their previous ordering except for deterministic ID tie-breaks.

The transaction summary's category counts represent individual expense
transactions, not category groups. Empty, whitespace-only, and null categories
are combined as `Uncategorized`; date bounds and calculation exclusions apply
to both totals and counts. Database failures return an error rather than an
empty successful summary.

## Refactoring and performance checks

Frontend quality gates are `cd frontend && npm run typecheck && npm run lint &&
npm test && npm run build`. Lint currently passes with existing warnings; its
rules and TypeScript checks have not been disabled.

Run backend regression tests with `cd api-go && go test ./... && go vet ./...`.
Run the measured workloads with:

```sh
cd api-go
go test ./reports ./youtube -run '^$' \
  -bench 'BenchmarkCategoryMappings|BenchmarkImportTransactions|BenchmarkChannelStatistics' \
  -benchmem -benchtime=300ms
```

Representative local SQLite/in-process HTTP measurements (not production
PostgreSQL or Google network latency):

| Workload | Before | After |
| --- | --- | --- |
| 100 mapping rules / 1,000 transactions | 101 queries, 8.37 ms | 1 query, 2.65 ms |
| 1,000-row import | 27.77 ms, 10.21 MB allocated | 13.97 ms, 2.68 MB allocated |
| Statistics for 100 channels | 100 requests | 2 requests, at most 50 IDs each |
| Dashboard with three comparison cycles | overlapping request graph | 11 requests with no repeated URLs in the regression fixture |

Imports iterate workbook rows, query fingerprints in groups of 500, fetch rules
once, cache merchant matches for the import, and insert batches of 200 in one
transaction. Existing duplicate, review, categorization, and amount behavior is
covered by tests, including rollback when a later batch fails.

### Optional transaction pagination

`GET /api/transactions` still returns the existing JSON array when neither
`page` nor `limit` is present. Supplying either parameter opts into:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 50, "total": 0, "totalPages": 0 }
}
```

The default page is 1 and default limit is 50. Limits must be 1-200; invalid,
empty, negative, or overflowing values return HTTP 400. Existing filters apply
to both rows and totals. Ordering is booking date, import time, then ID,
descending, for deterministic page boundaries.

Startup AutoMigrate adds non-unique date/import/ID, fingerprint, merchant expense,
category-rule merchant, and YouTube job owner/status/time indexes. Existing
duplicate fingerprints or rules are not deleted or made unique. Plan a
maintenance window for large PostgreSQL tables: startup index creation is not
concurrent. SQLite regression tests check additive/idempotent migrations;
PostgreSQL execution plans and multi-instance locking need integration validation
against the deployment database.

### Background jobs

| Setting | Default in development | Default otherwise |
| --- | --- | --- |
| `BOXING_SYNC_ENABLED` | `false` | `true` |
| `YOUTUBE_SYNC_ENABLED` | `true` | `false` |
| `SEARCH_SYNC_ENABLED` | `false` | `true` |

Set any variable to `true` or `false` to override it; malformed or empty
overrides fail startup. Boxing and YouTube schedules run immediately and every
six hours. Marketplace searches run at startup and every 24 hours, checking
only enabled searches due that UTC day. Disabling a schedule does not disable
manual sync endpoints.

SIGINT/SIGTERM cancels schedules and in-flight requests, drains Fiber, and waits
for workers before closing the database. YouTube syncs allow one pending/running
job per user, with at most four active workers per service and a ten-minute
deadline including queue time. PostgreSQL user-row locks serialize claims across
instances; expired jobs are marked failed on status lookup or the next claim.
Cancellation and partial failures persist failed status rather than claiming
success. Individual channel sync now returns its queued job's `syncId` with
HTTP 202, matching subscription/tag sync. Poll the existing status endpoint for
completion.

## Telegram client

Configure both `TELEGRAM_BOT_TOKEN` (from Telegram's BotFather) and
`TELEGRAM_CHAT_ID` to make the reusable client available in the app container.
With neither variable set the client is nil; partial or malformed configuration
fails startup. Never commit tokens or log token-bearing URLs. Task reminders
have been removed; marketplace searches can send scheduled Telegram alerts. Any existing
`task_reminders` table is left untouched but is no longer used or migrated.

## Marketplace search

Open **Shopping > Marketplace search** (`/search`) to create, edit, pause, or
delete personal saved searches. Select marketplaces, enter keywords and a
maximum item price in EUR. This first release supports **eBay only**; Facebook
Marketplace and Subito.it are visible but disabled until a suitable provider
is integrated. They are not silently scraped or treated as empty results.

Configure these server environment variables (never commit credentials):

- `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`: production eBay application
  credentials with access to the
  [Browse API](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search).
  Production Buy API access is subject to eBay's approval and usage limits.
  Missing credentials leave saved-search management available; a partial
  configuration fails startup.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`: the existing application-wide
  Telegram destination. Search keywords and listing details go to this shared
  chat, not a private per-user chat.
- `SEARCH_SYNC_ENABLED=true`: enable the worker (default true outside
  development, false in development). The UI reports missing configuration.

Searches use `EBAY_IT`, EUR, and fixed-price listings deliverable to Italy.
Shipping is **not** included. Integer-cent comparisons enforce **strictly below**:
a EUR 100 maximum alerts for EUR 99.99, not EUR 100.00. Results are paginated;
searches exceeding eBay's 10,000-result window fail explicitly and need more
specific keywords. There is no live marketplace preview or manual check endpoint.

The worker checks due searches at startup and every 24 hours, with persisted
next-check dates preventing repeated checks within the same UTC day after
restart. New searches wait until the next worker pass. Each check has a
two-minute deadline and a database lease to prevent concurrent instances
checking the same search. Edits/deletes during a check return HTTP 409.
Failures are logged and shown on the search card, and are retried on the next
daily check. Matches are persisted before sending; a failed Telegram send
remains pending and is retried only if that listing still qualifies.
Listings already notified are not sent again, including after restarts.
Changing keywords or the price threshold resets match history; pausing does not.
Delivery is at-least-once: a process crash after Telegram accepts a message but
before its receipt is saved can cause a duplicate, since Telegram has no
idempotency key.

Authenticated API (all records are scoped to the current user):

- `GET /api/marketplace-searches/configuration`: integration/worker readiness.
- `GET /api/marketplace-searches`: saved searches (empty result is `[]`).
- `POST /api/marketplace-searches`: create.
- `PUT /api/marketplace-searches/:id`: replace criteria; omitted `enabled`
  preserves it (creates default to enabled).
- `DELETE /api/marketplace-searches/:id`: delete search and match history.
- `GET /api/marketplace-searches/:id/matches`: latest 50 matching listings,
  including `notifiedAt` (null when delivery is pending).

Create/update body:

```json
{
  "keywords": "folding bicycle",
  "marketplaces": ["ebay"],
  "maxPriceCents": 10000,
  "enabled": true
}
```

Keywords must contain 1-100 characters. `maxPriceCents` must be a positive
integer within JavaScript's safe integer range; decimals and unsupported
marketplaces are rejected. Startup AutoMigrate adds `marketplace_searches`
and `marketplace_matches` without changing existing tables.
Regression checks: `cd api-go && go test ./marketplace` and
`cd frontend && node --test tests/marketplace-search.test.mjs`.

## Notes folder types

Folders expose `type`: `buy_list`, `tasks_list`, or `diary` (the default).
Create/edit it in the folder dialog. Nested folders have independent types.
Existing folders migrate to diary without changing notes, ordering, or styles.

- **Buy list:** item title and purchased checkbox.
- **Tasks list:** title, description, optional end date, and done checkbox.
- **Diary:** the existing content editor, styling, and preview.

The existing folder create/update endpoints accept `type`; omitted update
values preserve the current type. Invalid types are rejected. Notes expose
nullable `description`, nullable `endDate` (`YYYY-MM-DD`), and `completed` alongside their
existing fields. Note create/update accepts these fields; omitted update fields
are preserved, `completed: false` reopens an item, and `endDate: ""` clears the
date. A missing or null description on create is stored/returned as null.
On update, omitted `description` preserves its value; `description: null`
clears it. Empty strings remain supported for existing clients. Startup
migration makes the description column nullable without rewriting existing text
or empty strings. The web editor treats null as blank and saves a blank
description as null. Invalid dates are rejected. Switching folder types only changes which
fields are shown; hidden content, description, date, completion, and styles
are preserved. No reminder is attached to a note's end date.

## YouTube configuration

The YouTube service reads `YOUTUBE_API_KEY` for API-key requests. OAuth
requests use `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and
`YOUTUBE_REDIRECT_URL`, supplied to the service through dependency injection.
The redirect URL must match the URI registered for the Google OAuth client.

Subscription sync requires a saved Google OAuth token for each user in
`o_auth_tokens`; an API key or application OAuth credentials alone are not
sufficient. Scheduled and bulk subscription sync select only users with saved
tokens. A manual sync without a token returns a YouTube-not-connected error.
The Google authorization/callback flow for creating these tokens is not yet
implemented.

Use the following prompt when asking an AI service to implement a new client-requested section. Complete the first section before submitting it.

## New Section Specifics

```text
Implement a new section for this spending-tracker application.

Section name:
[NAME]

Client request:
[DESCRIBE THE USER-FACING GOAL, WORKFLOW, AND ACCEPTANCE CRITERIA]

Users and access:
[WHO CAN USE IT AND WHICH ROLES ARE ALLOWED]

Data to display or store:
[ENTITIES, FIELDS, RELATIONSHIPS, DEFAULTS, AND VALIDATION RULES]

Required actions:
[LIST, VIEW, CREATE, EDIT, DELETE, FILTER, EXPORT, OR OTHER ACTIONS]

Business rules and edge cases:
[RULES, ERROR CASES, EMPTY STATES, AND PERMISSIONS]

API contract:
[ENDPOINTS, METHODS, REQUEST/RESPONSE SHAPES, OR SAY "DESIGN IT"]

UI location:
[NAVIGATION ENTRY, ROUTE, PAGE, OR EXISTING SCREEN TO EXTEND]

Design requirements:
[LAYOUT, FORM FIELDS, TABLE COLUMNS, MOBILE EXPECTATIONS, AND STATES]

Out of scope:
[EXPLICITLY EXCLUDED WORK]
```

## Generic Prompt

```text
You are implementing the section described above in the existing Spending Tracker repository. Work directly in the established architecture and preserve unrelated behavior.

First, inspect the nearest comparable backend feature and frontend page. Then implement the smallest complete vertical slice required by the client request.

Deliver:
- A concise summary of the files changed and the API contract.
- Backend implementation for the new section, including concrete code changes for models, service logic, handler methods, DI wiring, and route registration when the feature persists or retrieves data.
- Frontend implementation for the new section, including concrete code changes for API client integration, route wiring, page/components, and loading, empty, error, validation, and unauthorized states as applicable.
- A code example in the response for the new section's DI registration and route registration, aligned with the repository's current patterns.
- Focused automated tests for new business logic, handlers, or non-trivial UI behavior.
- Validation by running the relevant Go tests and frontend typecheck, lint, or build commands.

Do not stop at describing the solution. Implement the new section in code and report the exact implementation points that were added or changed.

Do not replace existing tooling, bypass the installed Redux Toolkit and RTK Query setup, refactor unrelated code, or add dependencies unless the feature cannot be implemented with the installed stack. Before adding a dependency, explain why an existing library cannot meet the need.

Follow all repository guidelines below.
```

## Backend Guidelines

- Language: Go, as declared in `api-go/go.mod` (currently Go 1.26).
- HTTP framework: Fiber v3. Use `fiber.Ctx` (not a pointer) for handlers, `c.Bind().Body(...)` / `c.Bind().Query(...)` for request binding, and the static middleware for file serving. Database access: GORM, using SQLite or PostgreSQL drivers already configured by the application.
- Dependency injection: use `samber/do/v2` and register new dependencies through the existing DI setup when required.
- DI example, following `api-go/di/di.go`:

```go
do.Provide(injector, func(i do.Injector) (*myfeature.Service, error) {
  dbConn := do.MustInvoke[*gorm.DB](i)
  return myfeature.NewService(dbConn), nil
})

do.Provide(injector, func(i do.Injector) (*myfeature.Handler, error) {
  service := do.MustInvoke[*myfeature.Service](i)
  return myfeature.NewHandler(service), nil
})

return &AppContainer{
  MyFeatureService: do.MustInvoke[*myfeature.Service](injector),
  MyFeatureHandler: do.MustInvoke[*myfeature.Handler](injector),
}, nil
```

- If the feature needs another dependency, register that provider first, then resolve it inside the service provider with `do.MustInvoke[...]`.
- Organize domain work under `api-go/<feature>/`. Follow the nearby pattern of `<feature>_models.go`, `<feature>_service.go`, and `<feature>_handler.go` (or the existing domain naming convention).
- Keep handlers thin: parse and validate HTTP input, authorize, call services, and map HTTP responses. Keep queries, transactions, and business rules in services.
- Define request/response DTOs and database models explicitly. Use JSON tags and validate incoming data. Do not expose database-only fields accidentally.
- Register API routes through the domain handler using the existing `/api` grouping. Apply the established authentication and role middleware; do not create unauthenticated endpoints unless the request explicitly requires it.
- Route registration example, following `api-go/main.go` and feature route files:

```go
// main.go
container.MyFeatureHandler.RegisterRoutes(app, container.AuthMiddleware)
```

```go
// api-go/myfeature/routes.go
func (h *Handler) RegisterRoutes(app *fiber.App, authMiddleware *user.AuthMiddleware) {
  group := app.Group("/api/my-feature", authMiddleware.Authenticate)
  group.Get("/items", h.ListItems)
  group.Post("/items", authMiddleware.Authorize(user.AdminRole), h.CreateItem)
}
```

- Match the existing convention: the handler owns its `RegisterRoutes` method, while `main.go` wires that handler into the app during startup.
- Return appropriate status codes: `400` for invalid input, `401`/`403` for access failures, `404` for absent resources, and `500` only for unexpected server failures.
- Use parameterized GORM queries. Make multi-record mutations transactional with `db.Transaction`.
- Prefer existing helper functions and types in the relevant domain before creating duplicates.
- Add focused Go tests alongside the affected backend package, especially for business rules, authorization-sensitive behavior, and import/export parsing.

**Database migrations**: When you add new persistent models for a feature, include the corresponding model types in the GORM `AutoMigrate` call so migrations are applied at startup. Edit [api-go/internal/db/gorm_db.go](api-go/internal/db/gorm_db.go#L1) and add your model struct pointers to the `db.AutoMigrate(...)` list. Only include structs that map to real database tables (structs with `gorm` tags); do not add DTOs or in-memory types.

Example snippet:

```go
// inside NewDatabase() after opening the DB connection
if err := db.AutoMigrate(
  &user.User{},
  &reports.Transaction{},
  &myfeature.MyModel{}, // add new models here
); err != nil {
  return nil, err
}
```

If you prefer automated migrations or versioned migrations, add a note here and wire the migration tooling consistently across the app.

## Frontend Guidelines

- Language: TypeScript. Framework/build tool: React 19 with Vite.
- UI system: MUI with Emotion. Use MUI components and `@mui/icons-material` for controls; retain the existing theme and visual language.
- Use the latest Material UI documentation for the installed major version before implementing UI work: `@mui/material`, `@mui/icons-material`, and `@mui/x-date-pickers` are already in the repo. Prefer the current docs for component APIs, theming, accessibility, and migration notes instead of older MUI v5-era examples.
- Routing: React Router. Add the new route and navigation entry through the existing application routing/navigation pattern.
- Place reusable UI in `frontend/src/components/`; place feature screens in the nearest existing page or feature directory. Do not put all implementation code in `App.tsx`.
- Use the existing Redux Toolkit and RTK Query setup under `frontend/src/api/`. Extend `baseApi` with `injectEndpoints`, add any shared endpoint metadata or types in the existing API structure, and consume the generated hooks in components instead of ad hoc `fetch` calls.
- Keep request/response schemas and types in the existing API schema/domain structure. Preserve global ambient types in `src/types/` unless all consumers are intentionally migrated.
- The Redux store and React Redux provider are already wired into the app. Use functional React components and typed props, follow the repository's existing RTK Query plus local UI state patterns, and do not introduce a second client-side data fetching or state-management library.
- Implement request loading, errors, empty data, form validation, mutation progress, and success refresh/feedback where relevant.
- Build responsive layouts with stable dimensions for tables, controls, and dialogs. Use accessible labels, semantic form controls, keyboard support, and tooltips for icon-only buttons.
- Do not use raw SVG icons, a new CSS framework, or new visual conventions when an installed MUI component or icon covers the need.

## Repository Structure

```text
api-go/
  di/                    dependency registration
  internal/db/           shared database setup
  internal/dto/          shared DTOs
  <feature>/             domain handlers, models, and services
  main.go                application setup

frontend/
  src/api/               client, endpoint definitions, schemas, API domains
  src/components/        reusable components and feature components
  src/dashboard/         dashboard-specific UI
  src/helpers/           shared utility functions
  src/pages/             page-level screens
  src/types/             shared type declarations
  src/theme.ts           MUI theme
```

## Quality Gate

```text
Backend:  cd api-go && go test ./...
Frontend: cd frontend && npm run typecheck && npm run lint && npm run build
```

Run the narrowest relevant checks during implementation, then report any pre-existing failures separately from failures caused by the new section.