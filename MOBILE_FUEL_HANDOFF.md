# Mobile Fuel Management: developer handoff

Prepared: 10 November 2026  
Application: Spending Tracker  
Audience: mobile developer and QA

## 1. Objective and existing behavior

Add **Fuel Manager** to the mobile app, following the same integration approach
used for Tasks. Reuse the existing backend, authentication, navigation, network
layer, design system, and localization conventions.

Users must be able to:

- Record a GPL or Benzina fill when allowed by the current cycle.
- See which fuel type can be recorded next and how many GPL fills remain.
- Review their fuel history and lifetime counts.
- If an Admin, delete an individual record or reset their own history.

This feature is a **fuel-type cycle tracker**, not a fuel-expense or vehicle
consumption manager. The existing model has no vehicle, litres, amount paid,
odometer, station, notes, or manually chosen fill date.

This document describes repository-verified API/web behavior and the required
mobile implementation. No mobile code or device testing was performed for this
handoff.

## 2. Business rules: four GPL fills, then one Benzina fill

API fuel codes are exactly:

| API value | Existing display label | Meaning |
| --- | --- | --- |
| `gpl` | GPL | LPG / liquefied petroleum gas |
| `benzina` | Benzina | Petrol / gasoline |

Keep the API codes lowercase even if labels are translated. Do not send `GPL`,
`petrol`, `diesel`, or other display labels.

The sequence starts with **four GPL fills**, followed by **one Benzina fill**,
then repeats. This is a five-record cycle, **not** Benzina on every fourth
record. The cycle is application behavior, not a general vehicle-maintenance
recommendation.

| State | `fillsUntilBenzina` | `nextFillType` | Enabled create action |
| --- | --- | --- | --- |
| No records, or immediately after Benzina | 4 | `gpl` | Add GPL fill |
| 1 GPL since latest Benzina | 3 | `gpl` | Add GPL fill |
| 2 GPL since latest Benzina | 2 | `gpl` | Add GPL fill |
| 3 GPL since latest Benzina | 1 | `gpl` | Add GPL fill |
| 4 or more GPL since latest Benzina | 0 | `benzina` | Add Benzina fill |

Important semantics:

- Benzina is **blocked**, not merely discouraged, while
  `fillsUntilBenzina > 0`.
- GPL is blocked when `fillsUntilBenzina == 0`.
- Adding Benzina resets the number of GPL fills remaining to four.
- Lifetime counts do not reset after Benzina.
- The backend counts GPL records since the most recent Benzina by creation
  time. It does not calculate the cycle using `totalFills % 5`.
- Remaining fills are clamped at zero for existing histories with more than
  four consecutive GPL records.
- Deletion recalculates statistics from surviving history. It can change the
  next allowed fuel type, especially if the latest Benzina is removed.
- Treat `/stats` as authoritative; do not independently advance the cycle on
  the device and assume the write succeeded.

## 3. Delivery scope

### Required: existing feature parity

1. Fuel Manager navigation entry and overview.
2. Current user's server-provided statistics and next-fill guidance.
3. Add GPL / Add Benzina actions with correct availability.
4. Current user's history, newest first.
5. Pull-to-refresh and refresh on return to the section.
6. Loading, empty, stale, saving, error, and authentication states.
7. Admin-only single-record deletion and reset of the signed-in Admin's history,
   with explicit confirmation and refresh after success.
8. Automated coverage and device validation against section 10.

### Optional, separately estimable

- Date-range history filtering. The existing endpoint has end-date limitations
  described in section 7; do not ship misleading inclusive-day behavior.
- A separate "Last fill" card. Its endpoint is documented, but the normal
  overview can use the first record in the fetched history.

### Out of scope

New backend models/endpoints; importing or moving existing server data;
multi-vehicle support; costs; litres; consumption calculations; editing records;
backdating; custom cycle length; notifications; offline queued writes; automatic
background polling; ordinary-user deletion; and administering another user's
history through a user picker.

Using the same backend and account exposes the existing history automatically.
Do not copy or recreate records as part of the mobile rollout.

## 4. Screens and interactions

### 4.1 Fuel Manager overview

Suggested mobile layout:

1. Header: Fuel Manager and refresh; Admin-only reset in an overflow menu.
2. Next-fill guidance, visible without scrolling:
   - Positive remaining count: "Record N more GPL fills before Benzina."
   - Zero remaining: "Benzina is required before recording more GPL fills."
3. Statistics: Total fills, GPL fills, Benzina fills, GPL fills until Benzina.
4. Add GPL fill and Add Benzina fill actions.
5. History list.

Use native cards/list rows rather than copying the desktop table.
Pluralize counts and translate labels through the app's localization system.
Status must include text, not color alone.

### 4.2 Recording a fill

- No multi-field form is needed. The only writable field is `fillType`.
- With fresh valid stats, enable only the fuel type allowed by section 2.
- Disable **both** actions while stats are unavailable, initially loading,
  stale after a failed refresh, or any create/delete/reset operation is in flight.
- Make each tap record exactly one fill; prevent duplicate in-flight requests.
- On HTTP 201, show a success message and refresh history and stats.
- Re-enable actions only after refreshed stats are available. If refresh fails
  after a confirmed create, say the fill was saved but the overview could not
  refresh; offer Retry refresh rather than submitting the fill again.
- On a cycle-rule rejection, show the backend reason and refresh stats/history.
  Another client may have changed the cycle.
- Never show a successful local record before the server confirms creation.

### 4.3 History

Each row shows:

- Fuel type as a text badge.
- Creation date and time, localized to the device's time zone.
- Admin-only delete action.

`createdAt` is a server-generated timestamp, not a user-selected date.
Preserve the timestamp/offset when parsing and use the app's normal local
date-time formatter. Do not treat it like the Tasks feature's date-only values.

History returns all records, despite the web heading "Recent Fuel Records".
There is no pagination or server-provided total-page count. Use a virtualized
list for long histories without silently hiding older records.
The server orders by `createdAt` descending and provides no tie-break guarantee
for equal timestamps; do not assume UUID order indicates creation order.

### 4.4 Admin: delete one record

- Hide deletion controls from non-Admin users; do not copy the web page's
  always-visible admin buttons.
- Confirm with the record's fuel type and date/time:
  "Delete this fuel record? This cannot be undone and may change the next fill."
- Send the selected record ID, not its list index or user ID.
- Disable repeated destructive actions during the request.
- On 204, remove/invalidate the row and refetch history and stats.
- On failure, retain the record and display the error.
- A 404 can mean another client already deleted it; refresh and explain.

### 4.5 Admin: reset history

Use a clearly destructive, secondary action with confirmation, not a primary
one-tap button:

"Delete all your fuel records? This cannot be undone. Your counts will return
to zero and your cycle will restart with four GPL fills before Benzina."

- This deletes the **signed-in Admin's** history, not every user's history.
- On 204, refetch stats/history and any last-record cache.
- Empty results: zero total/GPL/Benzina counts, four GPL remaining, next `gpl`.
- Canceling either confirmation must send no request.

## 5. Data and authentication contract

### Connection

Use the mobile app's existing environment-specific API origin and login flow.
Paths below include `/api`; do not prefix it twice if the network client already
uses an `/api` base URL.

For all fuel endpoints:

```http
Authorization: Bearer <access_token>
Accept: application/json
```

For POST requests also send `Content-Type: application/json`.
Use HTTPS, platform-secure token storage, and the existing 401 reauthentication
flow. Never embed credentials, log tokens, or bypass certificate validation.

The existing login is `POST /api/auth/login` with `username` and `password`;
its response includes `access_token`, `token_type`, `expires_at`, `username`,
and `role`. Reuse it rather than building another fuel-specific login.
Do not assume a refresh-token endpoint exists.

### User scope and permissions

- Standard fuel routes require authentication, with no Writer/Admin restriction
  on creation or reading. Reader accounts can also record fills.
- The server derives user identity from the token. Never send or select a
  `userId` in create requests.
- History, stats, last record, and range queries are scoped to the signed-in
  user. Unlike the existing Tasks records, fuel history is not shared.
- Deletion routes additionally require the exact role `Admin`.
- Single-record Admin deletion operates by record ID without an ownership
  condition in the service. In this mobile section only offer it for records
  returned in the signed-in user's history; do not add arbitrary-ID or
  cross-user administration.
- Clear/separate fuel caches on logout/account change so one user's history
  cannot appear in another user's session.

### Fuel record response

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "userId": 7,
  "fillType": "gpl",
  "createdAt": "2026-11-10T08:40:00Z"
}
```

| Field | Wire type | Notes |
| --- | --- | --- |
| `id` | string | Server-generated UUID; use as record identity. |
| `userId` | number | Backend unsigned integer, **not a UUID or string**. |
| `fillType` | string enum | Exactly `gpl` or `benzina`. |
| `createdAt` | string | Server timestamp with time-zone information; may include fractional seconds. |

The current web TypeScript interface declares `userId` as a string, but the Go
response serializes a number. Follow the actual backend wire type on mobile.
Do not copy that interface mismatch.

### Statistics response

Example after three GPL fills in a new history:

```json
{
  "totalFills": 3,
  "gplCount": 3,
  "benzinaCount": 0,
  "fillsUntilBenzina": 1,
  "nextFillType": "gpl"
}
```

Counts are integers. An empty history returns:

```json
{
  "totalFills": 0,
  "gplCount": 0,
  "benzinaCount": 0,
  "fillsUntilBenzina": 4,
  "nextFillType": "gpl"
}
```

Do not replace an unavailable or malformed stats response with these zero values.
If enum values or stats are invalid/inconsistent, report a data-load problem
and disable creation rather than guessing a permitted action.

## 6. Required endpoints and examples

| Method | Path | Success | Body |
| --- | --- | --- | --- |
| GET | `/api/fuel/stats` | 200 | Statistics object. |
| GET | `/api/fuel/records` | 200 | Fuel-record array; `[]` if empty. |
| POST | `/api/fuel/records` | 201 | Created fuel-record object. |
| DELETE | `/api/fuel/admin/records/{id}` | 204 | No body; Admin only. |
| DELETE | `/api/fuel/admin/records` | 204 | No body; deletes signed-in Admin's records. |

Responses are direct objects/arrays, not `{data: ...}` envelopes.
Do not try to JSON-decode a 204 response.
There is no fuel PUT/PATCH endpoint or single-record GET-by-ID endpoint.

### Create GPL

`POST /api/fuel/records`

```json
{
  "fillType": "gpl"
}
```

### Create Benzina

Same endpoint, allowed only when Benzina is due:

```json
{
  "fillType": "benzina"
}
```

Do not send `id`, `userId`, `createdAt`, vehicle details, or expense fields.
The response contains the generated ID, authenticated user's numeric ID,
fuel type, and server timestamp.

### Recommended initial loading

Fetch `/stats` and `/records` concurrently.
They are separate requests, not an atomic snapshot. If they fail or appear
inconsistent during another client's write, expose the stale/error state and
refresh rather than pretending both are current.

After create/delete/reset invalidate or refresh stats, records, and any
optional last-record/range caches.

## 7. Optional endpoints and date-range caveat

### Last record

`GET /api/fuel/records/last`

- 200: one fuel-record object.
- 404 with `{"error":"no fuel records found"}`: valid empty-history state.
- Other failures must remain errors, not "no records".

The endpoint returns **404**, not 200 with null. If the overview already loads
the complete history, using its first record avoids this extra request.

### Date-range history

`GET /api/fuel/records/range?start=2026-11-01&end=2026-11-10`

Both parameters are required in `YYYY-MM-DD` format. A successful response is
a fuel-record array ordered newest first, scoped to the signed-in user.

**Current implementation caveat:** the backend parses both parameters at
**00:00:00 UTC** and uses inclusive SQL `BETWEEN`. Consequently `end=2026-11-10`
does not include most of 10 November, and a same-day range generally excludes
that day's fills after midnight. It also does not implement device-local day
boundaries or reject reversed ranges explicitly.

Do not present this as an inclusive local-date range without addressing the
mismatch. Options for a separately approved filter feature:

- Filter the already fetched full history locally using explicit
  `[local start of first day, local start of day after last day)` boundaries.
  Keep lifetime statistics unfiltered and label them accordingly.
- Coordinate a backend contract change for explicit, tested day/time-zone
  boundaries before relying on the range endpoint.

Do not silently append a day to the API end date and claim local-time correctness.
No date filter is required for basic web parity.

## 8. Error handling and reliability

Fuel handler errors are commonly plain text; the empty last-record response is
JSON. Inspect content type and support safe text messages and JSON `error` or
`message` fields. Do not assume every failure is `{message: ...}`.

| Status / failure | Expected mobile behavior |
| --- | --- |
| 400 invalid request/type | Show validation error; do not create a local record. |
| 400 cycle restriction | Explain the restriction and refresh server stats/history. |
| 401 | Existing expired-session/reauthentication flow; no retry loop. |
| 403 | Explain Admin-only access; hide/disable unavailable destructive actions. |
| 404 deleting record | Explain record is no longer available and refresh. |
| 404 last-record lookup | Empty-history state only for this optional endpoint. |
| 500 | Retryable load/save/delete failure; no successful-looking fallback data. |
| Timeout/network failure | Explain failure or uncertain outcome; retain data with stale indication. |

Relevant current server messages:

```text
invalid request body
fill type must be 'gpl' or 'benzina'
must fill with benzina before adding more GPL fills
must wait N more GPL fills before benzina
failed to get fuel statistics
failed to create fuel record
failed to get fuel records
failed to get last fuel record
record not found
failed to delete record
failed to delete user records
```

Range validation additionally reports missing parameters or invalid start/end
date format. Translate known business messages through the app's error mapping;
use a safe fallback for unexpected messages, not raw server internals.

### Duplicate submissions and concurrency limitations

- Creation has **no idempotency key**. After a POST timeout, the record may
  already exist. Refresh/reconcile first and let the user decide whether another
  fill is needed; do not automatically replay the POST.
- There is no client request ID in record responses, so comparison of history
  cannot always prove which client created a record. If uncertain, say so.
- The backend checks the cycle and inserts the record in separate operations;
  concurrent requests from mobile/web can pass the same pre-check. Device-side
  button disabling prevents duplicate taps in this client but does **not**
  provide global concurrency guarantees.
- Use server results, refresh after mutations/rejections, and do not claim the
  mobile implementation fixes server-side atomicity.
- Do not automatically retry a timed-out reset: a later retry could delete fills
  added since the original request. Refresh, explain the uncertain result, and
  require a fresh confirmation for a new destructive operation.
- No offline write queue. Existing cached reads are acceptable only if clearly
  marked stale and creation is unavailable until current stats are fetched.

## 9. Loading, empty states, and accessibility

- First load: show progress; keep create/destructive actions disabled.
- Stats failed but history loaded: retain usable history; show stats error and
  Retry; do not guess the next fill.
- History failed but stats loaded: show stats and a separate history error,
  not "No records". Creation may use fresh valid stats if no mutation is pending.
- Refresh failure: retain previously loaded data with a visible stale indicator;
  disable creation if stats freshness could not be established.
- Empty successful history: "No fuel records yet. Record your first GPL fill."
  Only show first-fill guidance when stats also confirm the initial state.
- Do not let obsolete fetch responses overwrite newer post-mutation data.
- Respect safe areas, accessible touch targets, text scaling, screen readers,
  dark mode, and long translated labels.
- Confirmations must identify the destructive scope and have a clear Cancel.

## 10. Acceptance criteria and QA checklist

| ID | Scenario | Expected result |
| --- | --- | --- |
| AC01 | Open Fuel Manager with empty history | Zero counts; four GPL remaining; next GPL; only GPL enabled; empty history guidance. |
| AC02 | Record first GPL | One persisted record; total 1, GPL 1, Benzina 0, remaining 3. |
| AC03 | Record second and third GPL | Remaining becomes 2 then 1; Benzina remains disabled. |
| AC04 | Record fourth GPL | Remaining 0; next Benzina; GPL disabled; Benzina enabled. |
| AC05 | Record Benzina when due | Total 5, GPL 4, Benzina 1; remaining 4; next GPL. |
| AC06 | Repeat cycle | Lifetime totals accumulate; cycle follows GPL since latest Benzina, not total modulo five. |
| AC07 | Attempt early Benzina or GPL when Benzina due | 400 handled with reason and refresh; no local phantom record. |
| AC08 | Rapid repeated taps | One in-flight create; no client-triggered duplicate submission. |
| AC09 | POST succeeds, follow-up refresh fails | Saved confirmation retained; stale overview flagged; Retry refresh does not create another fill. |
| AC10 | POST times out | Uncertain outcome explained; reconcile before user-directed resubmission; no automatic replay. |
| AC11 | History and wire decoding | UUID record IDs, numeric `userId`, exact enums and timestamp offsets decoded; newest-first list. |
| AC12 | Multiple time zones / fractional seconds | Creation timestamp displayed in correct local date and time without parsing failure. |
| AC13 | Sign in as a different user | Only that user's records/stats; no previous-user cached content. |
| AC14 | Reader/Writer account | Read and create available per cycle; deletion/reset controls absent. |
| AC15 | Admin deletes one record | Confirmation required; 204 accepted without JSON parsing; history/counts/next fill refresh. |
| AC16 | Admin deletes latest Benzina | Stats recalculate from remaining history; no assumption that next fill remains GPL. |
| AC17 | Admin resets history | Confirmation states own-history scope; 204; zero counts, four GPL remaining, next GPL. |
| AC18 | Cancel delete/reset | No HTTP mutation sent. |
| AC19 | Delete/reset fails or record already deleted | No false success; 403/404/500 handled; reconcile history where appropriate. |
| AC20 | Stats loading/failing/stale | Both create actions disabled; error/Retry shown, not zero-value success. |
| AC21 | History fetch fails | Separate error, not empty history; already loaded data marked stale where applicable. |
| AC22 | Authentication expires | Normal reauthentication, no retry loop or misleading empty state. |
| AC23 | Another client changes history | Refresh reflects server state; cycle rejection handled; no global atomicity claim. |
| AC24 | Optional last record on empty history | 404 handled as empty only for this endpoint. |
| AC25 | Optional date filter | Explicit date/time-zone boundaries tested; includes intended final day; lifetime totals clearly labeled. |

Automated coverage should include:

- Stats-to-button-state mapping for remaining values 4, 3, 2, 1, 0.
- Request serialization containing only `fillType` and valid lowercase values.
- Record/stats decoding, including numeric `userId` and timestamp offsets.
- Role-gated controls and cancellation of destructive confirmations.
- 201/204 success handling, plain-text and JSON errors, 400/401/403/404/500.
- Duplicate-tap prevention, uncertain POST outcomes, post-success refresh
  failures, obsolete responses, and account cache separation.

Run the mobile project's existing lint, type/build checks, and tests. Validate
on supported iOS/Android targets, small screens, large text, localized labels,
poor connectivity, and both sides of UTC.

Use dedicated test accounts/data: cycle testing creates records, and deletion
tests are destructive. Do not reset real users' history for QA.

## 11. Integration inputs and deliverables

Obtain through the normal project channels:

- Mobile repository/framework details and supported OS targets.
- Development/staging/production API origins with valid HTTPS.
- Dedicated regular-user and Admin test accounts, shared securely.
- Existing navigation/design/localization patterns.
- Whether optional date filtering or a Last fill card is included; omit them
  from the initial estimate unless requested.

Deliver:

- Required screens and actions connected to the existing backend.
- Automated test results and device/simulator validation against section 10.
- Screenshots or a short walkthrough covering a full cycle and Admin deletion.
- Configuration/setup notes without embedded credentials.
- Any known limitations, especially uncertain writes, concurrency, and optional
  range-end semantics.

No backend change is required for basic web parity. Any request for editable
dates, ordinary-user deletion, stronger concurrency guarantees, extra vehicle
fields, or corrected server-side range semantics needs separate backend scope.

## 12. Repository reference map

| Reference | What it establishes |
| --- | --- |
| [Fuel models and DTOs](api-go/fuel/fuelmanager_models.go) | Request/response fields, numeric user ID, UUID generation, server timestamp. |
| [Fuel route registration](api-go/fuel/fuelmanager_routes.go) | Actual paths and Admin-only deletion routes. |
| [Fuel handlers](api-go/fuel/fuelmanager_handler.go) | Cycle enforcement, error messages, 201/204/404 behavior. |
| [Fuel service](api-go/fuel/fuelmanager_service.go) | Four-GPL rule, per-user reads, ordering, deletion, UTC range bounds. |
| [Authentication middleware](api-go/user/auth_middleware.go) | Bearer authentication and exact Admin role. |
| [Login DTOs](api-go/user/user_dto.go) | Existing authentication response. |
| [Web Fuel Manager](frontend/src/pages/FuelManager/FuelManager.tsx) | Current statistics, add actions, history and deletion workflow. |
| [Web fuel API](frontend/src/api/fuelApi.ts) | Client operations and Fuel cache invalidation; note user-ID type mismatch. |
| [Web API base](frontend/src/api/baseApi.ts) | `/api` base prefix and authentication/error handling. |
| [Application routes](frontend/src/App.tsx) | Existing web route `/fuel-manager`. |

Follow the backend contract and intended workflow, not web quirks such as
always-visible Admin controls, unconfirmed reset, guessing GPL availability
before stats load, or assuming errors always contain `message`.
