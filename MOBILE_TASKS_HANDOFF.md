# Mobile Tasks section: developer handoff

Prepared: 9 November 2026  
Updated: 10 November 2026  
Application: Spending Tracker  
Audience: mobile developer and QA

## Latest integration clarifications

- The current web homepage is Tasks (`/tasks`) for Admins and Map (`/map`) for
  other users. Tasks remains Admin-only in web routing; the API access behavior
  in section 5.1 is unchanged. This does not automatically change the mobile
  app's global start screen.
- Task reminders have been removed. No scheduled Telegram messages are sent;
  marking work as sent remains a stored-date change only.
- Notes now supports a separate **Tasks list** folder type with numeric item IDs,
  `completed`, and optional `endDate`. It is not this UUID/project/cost/`sentOn`
  workflow. Its PUT requests preserve omitted fields, unlike work-task PUT.
  Follow the [Mobile Notes & Lists handoff](MOBILE_NOTES_HANDOFF.md) for that
  feature, its folder configuration, and the refreshed folder-only navigation.

## 1. Objective and agreed status model

Add a **Tasks** section to the existing mobile app so users can record work,
review its current sending status, and update that status using the existing
Spending Tracker backend.

**Confirmed scope:** match the existing app's **Not sent / Sent** workflow.
This is not a To do / In progress / Done task manager.

| Display status | Stored value | Meaning |
| --- | --- | --- |
| Not sent | `sentOn` absent, null, or empty | Work has not been marked as sent. |
| Sent | `sentOn` contains a date | Work has been marked as sent on that date. |

There is **no `status` field or status endpoint**. Derive status from `sentOn`.
The word "Sent" does not mean completed, paid, delivered, or acknowledged.
Updating `sentOn` only saves a date: the backend does not send an email,
notification, invoice, or external message.

The API and web behavior below were checked against this repository. Mobile UX
requirements are specified separately; implementation and device testing have
not been performed as part of this document.

## 2. Delivery scope

### Required first release

- Add a Tasks navigation entry using the mobile app's existing navigation,
  authentication, styling, localization, and networking conventions.
- Load tasks and projects from the existing API.
- Show task status, pending count, pending cost total, and total task count.
- Create a task attached to an existing project.
- Create a project when the required project does not exist.
- View and edit all task fields.
- Mark an individual task as sent by setting its sent date; clear that date to
  return it to Not sent.
- Provide Not sent and History views, refresh, validation, and reliable
  loading, empty, authentication, and error states.
- Persist all changes through the backend so mobile and web see the same data.

### Optional web-parity additions, not required for the first release

- Prepare view: unsent tasks grouped by project with project totals.
- Mark all pending tasks as sent.
- Multi-select tasks and assign them to another project.

The optional operations and their API limitations are documented below so they
can be estimated separately. Task/project deletion and project editing are
available on the backend but are not part of this mobile release.

### Out of scope

New backend models or endpoints; work-progress states; priorities; due dates;
assignees; reminders; attachments; payments; invoicing; actual message delivery;
offline write synchronization; background polling; and changes to other sections.

## 3. Screens and interaction requirements

### 3.1 Tasks overview

- Default to **Not sent**.
- Header: Tasks, Add task, and an accessible Add project action.
- Summary values, calculated from the complete fetched task list:
  - Pending count: number of tasks without a nonempty `sentOn`.
  - Pending total: sum of `cost` for those tasks, displayed in EUR.
  - Total tasks: all fetched tasks, including sent tasks.
- Two required tabs or equivalent controls:
  - **Not sent:** pending tasks grouped by task month, oldest month first,
    task date ascending within each group.
  - **History:** **all tasks**, not just sent ones, task date descending.
- For equal dates, compare UUID strings deterministically; do not subtract IDs.
- Task cards show name, project name, task date, EUR cost, and a text status
  badge. Show the sent date for sent tasks. Open details/edit on tap.
- Show an unknown/unassigned project fallback if a historical record has no
  project; still display the task and include its cost in totals.
- Support pull-to-refresh and refresh when returning to the section.
- A Sent-only filter is not required. Do not silently make History sent-only.

### 3.2 Create/edit task

Use the same form for creating and editing, prefilled when editing.

| Field | Control / default | Rules |
| --- | --- | --- |
| Project | Picker, names ascending; initially unselected | Required; send the selected project's UUID. |
| Task name | Text; blank on create | Required after trimming whitespace. |
| Cost | Decimal numeric input; default `10` on create, matching web | Required finite number; send a JSON number, not a string. |
| Date | Date-only picker; today's local calendar date on create | Required, real calendar date, `YYYY-MM-DD`. This is the task/work date, not a deadline. |
| Sent on | Clearable date-only picker; blank on create | Optional, real calendar date, `YYYY-MM-DD`. Blank means Not sent. |
| Description | Multiline text; blank on create | Optional; trim before submitting. |

- Display currency as EUR with two decimal places. There is no currency field.
- Use locale-aware numeric input; e.g. normalize a decimal comma before JSON
  serialization. Reject non-finite or invalid numeric input.
- The backend currently imposes no nonnegative-cost or date-order rule.
  Do not invent restrictions such as `sentOn >= date` or disallowing future dates.
- No name/description length limits are defined by these handlers; do not
  advertise invented server limits.
- Preserve date-only values as calendar dates. Do not convert through UTC
  timestamps, which can shift the date in some time zones.
- Disable duplicate submissions while saving.
- On validation/API failure, preserve input and show an actionable error.
- Close/reset the form only after confirmed success. Use the returned task to
  refresh the list, grouping, and totals; a sent-on-create task is visible in
  History, not Not sent.
- For legacy tasks without a project, require selection of a valid project
  before saving: the current update handler requires `projectId`.
- Warn before discarding unsaved edits using the app's established pattern.

### 3.3 Task details and status changes

Show every task field and an Edit action. Provide:

- **Mark as sent:** ask for a sent date, defaulting to today's local date.
- **Mark as not sent:** confirm, then clear the sent date.

Both use the normal full task update described in section 5. There is no
separate send, unsend, or PATCH operation. Explain to users that marking as sent
records a status only; it does not transmit the task anywhere.

### 3.4 Create project

Fields: required name and optional multiline description. Trim both.
On success add the returned project to the picker and select it in the task
form without losing other entered task data.

If there are no projects, show "Create a project to add your first task" with an
Add project action; prevent task submission until a project exists.
Show the duplicate-name error inline. Do not assume case-insensitive uniqueness.

## 4. Data contract

IDs are UUID strings generated by the server, not numeric IDs. JSON names are
case-sensitive and use the exact camelCase shown here.

### Project response

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Client website",
  "description": "Website maintenance"
}
```

`description` can be omitted when empty.

### Task response

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "projectId": "11111111-1111-4111-8111-111111111111",
  "projectName": "Client website",
  "name": "Update landing page",
  "cost": 120.5,
  "date": "2026-11-09",
  "description": "Replace the hero image"
}
```

This example is Not sent. A Sent response additionally contains, for example,
`"sentOn": "2026-11-09"`.

- `projectName` is read-only and provided by the backend.
- `sentOn` and `description` are omitted when not stored; tolerate null and
  empty values when reading existing client data.
- For a task without a project, `projectId` and `projectName` are empty strings.
- Use `""` to clear optional string fields in requests; do not depend on null
  serialization behavior.

## 5. API integration

### 5.1 Connection and authentication

Use the mobile app's existing environment-specific API origin. The deployment
owner must provide the development/staging/production origins and test access
before integration. Append the `/api/...` paths below; do not duplicate `/api`.
A device cannot reach the developer workstation through its own `localhost`.
Use HTTPS and valid certificates; do not bypass certificate validation.

All task and project routes require:

```http
Authorization: Bearer <access_token>
Accept: application/json
Content-Type: application/json
```

`Content-Type` is needed for JSON request bodies. Reuse existing login; if
needed, the current login is `POST /api/auth/login` with `username` and
`password`. Its response contains `access_token`, `token_type`, `expires_at`,
`username`, and `role`. Use the platform's secure credential storage; never
embed credentials or log tokens. On 401 use the app's reauthentication flow,
not an infinite retry loop. Do not assume a refresh-token endpoint exists.

**Current access behavior:** these task/project routes apply authentication
only, with no route-level Writer/Admin restriction. The models and queries
have no per-user ownership field/filter: records are shared among authenticated
users, not private personal lists. Do not describe them as user-private.
Any intended change to role policy or data isolation needs backend/product
agreement and is outside this handoff's implementation scope.

### 5.2 Endpoints

Paths below match the web client; backend groups also register collection routes
with a trailing `/`.

| Method | Path | Success | Response / purpose |
| --- | --- | --- | --- |
| GET | `/api/tasks` | 200 | Task array, `[]` when empty. |
| GET | `/api/tasks/{id}` | 200 | One task with project name. |
| POST | `/api/tasks` | 201 | Created task; `Location` header points to its URL. |
| PUT | `/api/tasks/{id}` | 200 | Updated task; full writable record required. |
| GET | `/api/projects` | 200 | Project array, `[]` when empty. |
| GET | `/api/projects/{id}` | 200 | One project. |
| POST | `/api/projects` | 201 | Created project; `Location` header points to its URL. |

Lists are plain JSON arrays, not `{data: ...}` envelopes. No task/project
pagination, search, server-side status filters, or summary endpoint is
implemented. Calculate the overview from the full list locally.
Backend list ordering: tasks by task date descending then ID descending;
projects by name ascending then ID ascending.

Load tasks and projects concurrently. If either fails, show which data could
not load and offer retry; a failed fetch is not an empty dataset.

### 5.3 Create task

`POST /api/tasks`

```json
{
  "projectId": "11111111-1111-4111-8111-111111111111",
  "name": "Update landing page",
  "cost": 120.5,
  "date": "2026-11-09",
  "sentOn": "",
  "description": "Replace the hero image"
}
```

Do not supply `id` or `projectName`. On success the response has the task
response shape above, including the generated ID and resolved project name.

### 5.4 Edit task / change status

`PUT /api/tasks/22222222-2222-4222-8222-222222222222`

```json
{
  "projectId": "11111111-1111-4111-8111-111111111111",
  "name": "Update landing page",
  "cost": 120.5,
  "date": "2026-11-09",
  "sentOn": "2026-11-09",
  "description": "Replace the hero image"
}
```

**PUT replaces all writable fields.** Never send just `sentOn`: project, name,
and date are required, and omitted cost/optional fields may be reset.
Preserve `projectId`, `name`, `cost`, `date`, and `description` when changing
status. To revert to Not sent, send the same full record with `"sentOn": ""`.

There are no version/ETag conflict checks or modification timestamps in these
DTOs. A stale full-record write can overwrite another client's changes.
For status shortcuts, fetch the current task before building the PUT body.
This narrows but does not eliminate the race; do not claim conflict-safe
editing. Refetch on section entry and after uncertain write outcomes.

### 5.5 Create project

`POST /api/projects`

```json
{
  "name": "Client website",
  "description": "Website maintenance"
}
```

Returns the Project response shape in section 4.

### 5.6 Errors and backend constraints

Task/project error bodies may be plain text, not JSON. Parse according to
content type and provide a safe, useful user message rather than assuming a
single JSON error envelope or displaying raw database internals.

| HTTP status | Meaning / mobile behavior |
| --- | --- |
| 400 | Invalid body, invalid path UUID, or task/project validation failure. Preserve form and highlight relevant inputs. |
| 401 | Missing/invalid/expired authentication. Reauthenticate; never show an empty success state. |
| 403 | If returned by the deployment, show permission denied without retry loops. |
| 404 | Task/project no longer exists. Inform the user and refresh; do not recreate automatically. |
| 409 | Duplicate project name; for optional deletion, a project may still be referenced by tasks. |
| 500 / other failure | Show a retryable failure, preserve input, and avoid presenting raw server internals. |
| Network failure / timeout | Explain connectivity or uncertain outcome; do not report success. |

Current validation messages include `ProjectId required`, `Name required`,
`Date required`, `Date must be yyyy-MM-dd`, `SentOn must be yyyy-MM-dd`,
`Project already exists`, and `Project does not exist`.

Important limitations:

- The task handler checks project presence but does not strictly reject every
  malformed project UUID before converting it. Always select a valid UUID from
  the project response; do not offer free-text project IDs.
- Cost defaults to zero if omitted by an API caller; the mobile form must still
  require valid numeric input.
- There is no idempotency key for creation. Do not automatically retry a POST
  after a timeout: it may already have succeeded. Refresh/reconcile first and
  let the user decide whether to resubmit.
- Do not automatically replay stale PUT bodies after an uncertain result;
  fetch current state and reconcile first.

## 6. Optional web-parity operations

### Prepare and mark all as sent

Show only pending tasks, grouped by project with the sum of each group's cost.
Group by project ID, using project name as the display label.

If implemented, label the action **Mark all as sent**, explain that no message
is transmitted, confirm the number of tasks and sent date, and disable it when
there are no pending tasks or a write is in flight.

There is no bulk-send endpoint. The web client sends separate full-record
`PUT /api/tasks/{id}` requests with the same sent date. These are **not atomic**:
some may succeed before another fails. For mobile:

1. Reconcile current server records before preparing each status update.
2. Track each confirmed success and any failure/unknown outcome separately.
3. Stop on failure, refetch tasks, and show completed/remaining counts only when
   reconciled; distinguish any still-unknown result.
4. Never report that all tasks were updated unless confirmed.
5. After refresh, retry only records that remain pending, preserving sent tasks.

### Assign selected tasks to a project

`POST /api/tasks/assign-project`

```json
{
  "projectId": "11111111-1111-4111-8111-111111111111",
  "taskIds": [
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333"
  ]
}
```

Success: HTTP 200 with `{"success": true}`. Use a valid existing project and a
nonempty array of valid task UUIDs. Empty project IDs are not a supported
unassignment workflow. The response gives no affected count and can succeed
when only some requested IDs still exist; refetch to reconcile actual results.
No matching tasks returns 404; malformed UUIDs return 400; database failures
can return 500. Clear selection after confirmed reconciliation.

## 7. Reliability, usability, and accessibility

- Keep all mutations server-confirmed; do not show optimistic success without
  rollback/reconciliation.
- After successful changes update or invalidate all affected views, totals,
  project names, and cached task details.
- Ignore/cancel obsolete fetch responses so they cannot overwrite newer data.
- On refresh failure, retain already loaded data and label it stale with a
  visible retry action. Never mix a failed refresh with fresh-looking totals.
- Clear user-scoped caches on sign-out/account change according to app policy.
- First-load, refreshing, saving, no-tasks, nothing-pending, no-projects, and
  request-failed states must be distinguishable.
- Use the app's existing responsive layout, safe-area/keyboard handling, native
  back behavior, theme, accessible touch targets, and screen-reader labels.
- Status must include text, not color alone. Support text scaling, long task
  names, and a readable multiline description.
- Offline mode may show explicitly stale cached data if the app already does
  so, but must not silently queue writes or pretend a change was saved.

## 8. Acceptance criteria and QA checklist

| ID | Scenario | Expected result |
| --- | --- | --- |
| AC01 | Open Tasks with a valid session | Tasks/projects load; default Not sent view; correct counts and pending EUR total. |
| AC02 | No tasks exist | Empty-state guidance and Add task shown; count and total are zero. |
| AC03 | No projects exist | Add project available; task creation blocked until selection is possible. |
| AC04 | Create a project, then a pending task | New project selected; task saved once and survives reload in both mobile and web. |
| AC05 | Create a task with a sent date | Appears in History as Sent; excluded from pending count and total. |
| AC06 | Empty/whitespace name, missing project/date, invalid date/cost | Submission blocked with useful validation; entered values retained. |
| AC07 | Duplicate project name | 409 handled inline; no phantom project added. |
| AC08 | Edit name, project, cost, date, and description | Server response reflected everywhere; persists after reload. |
| AC09 | Mark pending task as sent | Only sent date changes; moves out of Not sent; totals recalculate; History retains task. |
| AC10 | Clear sent date | Task becomes Not sent; sent date removed; pending count and total increase correctly. |
| AC11 | History contains mixed statuses | Both sent and pending tasks present, task date descending. |
| AC12 | Multiple months/projects, equal-date UUIDs | Required grouping/order stable; no numeric-ID assumptions. |
| AC13 | Decimal costs and date changes across time zones | Numeric JSON sent correctly; EUR displayed to two decimals; dates do not shift. |
| AC14 | Missing optional fields or historical unassigned project | No crash; correct fallback/status; valid project required before editing. |
| AC15 | Fetch failure, timeout, or offline | Visible retry/error state, not "no tasks"; existing data identified as stale. |
| AC16 | Save failure or uncertain POST outcome | Form retained; no success or blind automatic duplicate creation. |
| AC17 | Session expires | Reauthentication flow; no infinite retry or successful-looking empty list. |
| AC18 | Another client edits/deletes a task | Refresh reflects changes; 404 handled; no automatic recreation. |
| AC19 | Repeated Save taps / navigation during fetch | No duplicate in-flight submission; obsolete response cannot replace newer state. |
| AC20 | Optional mark-all partially fails | Confirmed results reconciled; remaining/unknown results explicit; no false all-success message. |
| AC21 | Optional project reassignment | Refetched tasks show actual project changes; status/cost/date preserved. |

Add automated coverage for status derivation, summary arithmetic, payload
serialization, date-only handling, required-field validation, and mutation error
handling. Use API fixtures for 200/201, empty arrays, 400, 401, 404, 409, 500,
and network failures. If optional bulk features ship, test partial success.

Run the mobile project's existing lint, type/build checks, and tests, then
validate on supported iOS/Android targets as applicable. Include small screens,
keyboard-open forms, large text, decimal-comma input, and time zones on both
sides of UTC. No backend changes are required for the agreed first release.

## 9. Integration checklist and developer deliverables

Before integration, obtain from the app/deployment owner:

- Mobile repository access, framework/version, supported OS targets, and
  existing navigation/design/localization conventions.
- Reachable API origins and valid HTTPS configuration per environment.
- Test accounts/access through the normal secure channel and representative
  shared task/project data.
- Confirmation of whether the optional Prepare/mark-all/reassignment features
  belong in this delivery. Otherwise omit them from the first release.

The mobile developer should deliver:

- Working required screens and actions connected to the existing backend.
- Automated tests and device/simulator validation results against section 8.
- Screenshots or a short walkthrough of creation, status changes, and errors.
- Any known limitations, especially shared data and concurrent full-record edits.
- Setup/configuration instructions without embedded credentials.

## 10. Repository reference map

These are references for behavior and contract, not mobile framework choices:

| Reference | What to inspect |
| --- | --- |
| [API DTOs](api-go/tasks/projects_tasks.go) | Task, task-details, project, assignment JSON shapes. |
| [Handlers and routes](api-go/tasks/projects_tasks_handler.go) | Paths, validation, status codes, response mapping. |
| [Service](api-go/tasks/project_task_service.go) | Query ordering, full-record updates, reassignment behavior. |
| [Database entities](api-go/internal/db/entities.go) | UUIDs, project relationship, stored fields. |
| [Authentication middleware](api-go/user/auth_middleware.go) | Bearer authentication behavior. |
| [Login DTOs](api-go/user/user_dto.go) | Login request and token response. |
| [Web task API](frontend/src/api/domains/tasks.ts) | Existing client calls. |
| [Web overview](frontend/src/components/pages/TasksBoard.tsx) | Pending totals, views, and task/project mutations. |
| [Web task form](frontend/src/components/pages/TaskCreateForm.tsx) | Existing defaults and editable fields. |
| [Web Prepare view](frontend/src/components/Tasks/PrepareSection.tsx) | Separate per-task sent-date updates; not actual delivery. |
| [Web History view](frontend/src/components/Tasks/HistorySection.tsx) | Full-history display and optional assignment. |
| [Grouping helpers](frontend/src/helpers/comparers.ts) | Current month/project grouping semantics. |
| [Formatting helpers](frontend/src/helpers/formatters.ts) | EUR currency display and date-only formatting. |

Follow the API contract, but do not copy web implementation quirks such as
numeric UUID comparison, UTC-derived "today", or assuming a multi-request
operation is atomic.
