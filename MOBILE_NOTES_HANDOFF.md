# Mobile Notes & Lists: developer handoff

Prepared: 10 November 2026  
Application: Spending Tracker  
Audience: mobile developer and QA

## 1. Objective and latest agreed behavior

Implement **Notes & lists** in the existing mobile app using the current backend.
Reuse the app's authentication, networking, navigation, localization, and native
design conventions. No mobile implementation or device testing is included in
this documentation update.

The latest requirements supersede a combined folder-and-note sidebar:

- The folder navigator contains **only folders**, including nested folders.
  Direct item-count badges are allowed; item titles and completion controls
  belong in the selected folder's main content area.
- Selecting a folder shows **only its direct items**, not descendants' items.
- Selecting an item opens its type-specific editor. Selecting another folder
  closes the editor and clears the previous item selection.
- Every folder has a type: Buy list, Tasks list, or Diary. Diary is the default.
- Changing type or moving an item preserves all fields hidden by the new type.
- Task reminders have been removed. No note end date or completion action
  schedules or sends a Telegram notification.

**Important distinction:** Notes folders of type `tasks_list` are not the
separate work/billing **Tasks** section. Notes use numeric IDs, `completed`,
and optional `endDate`. Work tasks use UUIDs, projects, cost, date, and `sentOn`.
See the [Tasks handoff](MOBILE_TASKS_HANDOFF.md); do not reuse its full-record
update behavior for Notes, or map these different status models together.

A Diary folder is also not the separate `/api/diary` feature. Its items use the
Notes API and the existing styled note content model.

## 2. Folder types and editable fields

| API type | Display label | Item fields shown to the user |
| --- | --- | --- |
| `buy_list` | Buy list | Title and Purchased checkbox. |
| `tasks_list` | Tasks list | Title, description, optional end date, and Done checkbox. |
| `diary` | Diary | Title, multiline content, formatting controls, and preview. |

Folder name, type, and position are configurable in folder create/edit forms.
Item position and destination folder remain configurable for all types.

- New folders default to Diary, even when their parent is another type.
- Existing folders migrate to Diary without changing existing notes or styles.
- Children have independent types; changing a parent does not change children.
- `description` is nullable and separate from diary `content`. Display null as
  blank in the editor; do not copy it into diary content when changing type.
- `completed` means Purchased for buy-list items and Done for task-list items.
  Preserve it when hidden in Diary. Items can be unchecked again.
- `endDate` is a date-only value, not a notification time or timestamp.
- The backend retains all item fields regardless of folder type. Mobile
  editors must hide inapplicable fields rather than erase them.

### Validation and defaults

| Field | Client rule / backend behavior |
| --- | --- |
| Folder name | Required after trimming; maximum 100 characters. |
| Folder type | Exact lowercase API value above. Omitted or empty on create defaults to `diary`; empty on update is rejected. |
| Item title | Required after trimming; maximum 200 characters. |
| Position | Non-negative integer. Create defaults to 0; omitted update preserves it; explicit 0 resets it. |
| Folder / item IDs | Positive JSON integers, not UUIDs. Use the existing server ID when editing. |
| Item folder | Must reference an existing folder. |
| End date | Optional real calendar date in `YYYY-MM-DD` format. Invalid dates such as `2026-02-29` are rejected. |
| Completion | Boolean, default false. Explicit false must be serialized when unchecking. |
| Description | Optional string or null. Omitted/null on create stores null. No length limit is declared. |
| Content | Optional string; no length limit is declared by the request DTOs. |

Preserve calendar dates without converting through UTC timestamps. Do not invent
an end-date ordering rule or disallow past dates; neither rule is implemented.

Diary style is a single object with `bold`, `italic`, `textColor`,
`backgroundColor`, and `fontSize`. Defaults are false, false, `#1f2937`,
`#ffffff`, and 16. The web offers font sizes 14, 16, 18, 20, and 24.
This is whole-note styling, not rich-text spans or an HTML editor.

## 3. Mobile navigation and visual direction

### Folder navigator

On phones, use a folder screen or drawer leading to the selected folder's
content screen. On tablets, a folder-only sidebar and main content pane can
mirror the web layout. Do not put item rows underneath folders in the navigator.

- Show folder name, type, direct item count, and a distinct selected state.
- Use a shopping-bag icon for Buy list, checklist for Tasks list, and book for
  Diary, or the native design system's equivalents.
- Show nesting with indentation or a subtle connecting line.
- **New folder** creates a root; **Subfolder** uses the selected folder as parent.
- Edit and delete target the selected folder. Do not use an ambiguous home icon
  for creating folders.
- Preserve the selected folder when opening/canceling a create-folder form.
- On a wide layout, allow collapsing the sidebar and provide **Show folders**
  to restore it.

### Main content and editor

- Header: selected folder name, type badge, direct item count, New item/New note.
- Main list: direct items only, in server order.
- Buy/task lists: completion checkbox and title; task rows can also show end date.
- Diary rows: title and updated timestamp; do not show completion controls.
- Selecting a row opens the appropriate editor. Keep the item list available
  on wide screens; use normal push/back navigation on phones.
- Provide Save, Delete for existing items, and Close editor/back.
- A completion toggle in the list saves immediately with a completion-only
  request. A checkbox changed inside the editor saves with the form.
- After successful create/edit, refresh the tree and reselect the saved item.
  After deletion, close the editor and refresh the selected folder.
- Empty folders show an explicit empty state and still offer item creation.
- Warn before discarding unsaved changes using the mobile app's existing
  pattern; do not silently save drafts when navigating.

### Modern, accessible styling

Follow the refreshed web direction without copying desktop dimensions:

- One clean workspace surface, softly rounded cards, subtle borders/shadows,
  generous spacing, and strong typography hierarchy.
- Type-colored icon tiles and compact count/type badges, not color-only status.
- Clear primary creation actions, labeled contextual actions, rounded selected
  folder rows, and visible keyboard/focus states.
- Support the app's light/dark themes and Solarized if offered by the mobile app.
  Check contrast against the actual themed background.
- Honor safe areas, font scaling, screen readers, native touch-target sizes,
  and reduced-motion preferences. No horizontal overflow on small screens.

## 4. Authentication, roles, and shared data

Use the mobile app's configured API origin, existing session, and standard
Authorization header with the Bearer scheme. Never embed credentials or bot
tokens in the mobile client. Handle HTTP 401 through reauthentication; no
refresh-token endpoint is assumed.

The web Notes editor allows writes for `Writer` and `Admin`; other roles are
read-only in the UI. Mobile should apply the same editor/action gating.
Readers can browse folders and open items but cannot toggle completion.

**Current backend behavior differs from the UI policy:** Notes routes apply
authentication only, not a Writer/Admin authorization check. Folder/note models
and queries have no user ownership filter. Data is shared among authenticated
accounts, not private personal notebooks. Do not advertise client-side controls
as server-enforced authorization or data isolation. Policy changes require
separate backend/product agreement.

For navigation context, the current **web** root redirects Admins to `/tasks`
and other users to `/map`; direct links to other screens survive login.
This is not a request to change the mobile app's global start screen.

## 5. Data and API contract

### Endpoints

| Method | Path | Success | Purpose |
| --- | --- | --- | --- |
| GET | `/api/note-folders/tree` | 200 | Complete nested folder array with direct notes. |
| POST | `/api/note-folders` | 201 | Create root or child folder. |
| PUT | `/api/note-folders/{id}` | 200 | Partially update folder fields. |
| DELETE | `/api/note-folders/{id}` | 204 | Delete folder; see deletion limitations below. |
| POST | `/api/notes` | 201 | Create an item in an existing folder. |
| PUT | `/api/notes/{id}` | 200 | Partially update item fields. |
| DELETE | `/api/notes/{id}` | 204 | Delete one item. |

Collection paths match the web client; backend collection routes are also
registered with a trailing `/`. There is no separate GET-all-notes, GET-one-note,
completion, move, or PATCH endpoint. The tree is the read source. It returns a
plain array (`[]` when empty), without pagination or a `{data: ...}` envelope.

### Tree response example

```json
[
  {
    "id": 12,
    "name": "Weekend",
    "type": "tasks_list",
    "position": 0,
    "parentId": null,
    "children": [],
    "notes": [
      {
        "id": 42,
        "folderId": 12,
        "position": 0,
        "title": "Collect parcel",
        "content": "",
        "description": "Bring the collection code",
        "endDate": "2026-11-14",
        "completed": false,
        "style": {
          "bold": false,
          "italic": false,
          "textColor": "#1f2937",
          "backgroundColor": "#ffffff",
          "fontSize": 16
        },
        "createdAt": "2026-11-10T10:00:00Z",
        "updatedAt": "2026-11-10T10:00:00Z"
      }
    ]
  }
]
```

`parentId`, `description`, and `endDate` are nullable. `createdAt`/`updatedAt` are server-generated
timestamps; `endDate` is not. Preserve hidden response fields in client state.

### Ordering

- Folders among siblings: `position` ascending, name ascending, numeric ID ascending.
- Notes within a folder: `position` ascending, `updatedAt` descending, numeric ID ascending.
- Folder children and direct notes remain separate groups.
- Count only `folder.notes.length` for a folder badge, not all descendants.
- Completing or editing an item changes `updatedAt` and can reorder equal-position
  items. Respect the refreshed response rather than inventing completion sorting.

## 6. Write examples and preservation rules

### Create/configure folders

Create a root folder:

```http
POST /api/note-folders
Content-Type: application/json

{"name":"Shopping","type":"buy_list","position":0}
```

To create a child, include `"parentId": 12`. Configure an existing folder:

```http
PUT /api/note-folders/12
Content-Type: application/json

{"type":"tasks_list","position":2}
```

Type changes modify the folder only; existing notes are not rewritten.
**Folder create/update responses contain empty `children` and `notes` arrays,
even for a nonempty updated folder.** Refetch the tree rather than replacing
a cached subtree with that mutation response.

### Create items

Buy-list item:

```json
{"folderId":12,"title":"Milk","position":0,"completed":false}
```

Task-list item:

```json
{
  "folderId": 12,
  "title": "Collect parcel",
  "description": "Bring the collection code",
  "endDate": "2026-11-14",
  "completed": false,
  "position": 0
}
```

Diary item:

```json
{
  "folderId": 12,
  "title": "A good day",
  "content": "Multiline diary text.",
  "position": 0,
  "style": {
    "bold": false,
    "italic": false,
    "textColor": "#1f2937",
    "backgroundColor": "#ffffff",
    "fontSize": 16
  }
}
```

These are alternative `POST /api/notes` bodies; select a folder of the
corresponding type. Do not send IDs or timestamps on create.

### Partial updates

Unlike the work Tasks API, Notes PUT preserves omitted fields:

```http
PUT /api/notes/42
Content-Type: application/json

{"completed":true}
```

Use `{"completed":false}` to reopen/unpurchase. Other useful bodies:

| Action | Body |
| --- | --- |
| Edit task description | `{"description":"Updated details"}` |
| Clear end date | `{"endDate":""}` |
| Clear description to null | `{"description":null}` |
| Move item | `{"folderId":15}` |
| Reset position | `{"position":0}` |

- Send only relevant/changed fields, especially from typed editors. Do not send
  empty diary content or default style merely because those controls are hidden.
- For `description`, omission preserves the value and explicit JSON null clears
  it. Existing clients can still store `""`; mobile should send null when the
  user clears the description. Preserve hidden descriptions during other edits.
- Other pointer-backed update fields still treat JSON null like omission.
  In particular, `endDate: null` does **not** remove a saved date; use `""`.
- A supplied `style` replaces the whole style object after applying server
  defaults. Preserve untouched style properties when changing one property.
- Item writes return the complete item response.

## 7. Known limitations and error handling

- Folder moves reject self-parenting and descendant cycles. Supplying an
  existing parent changes it; omission or `parentId: null` leaves it unchanged.
  Moving an existing folder back to root is **not supported** by this update
  contract. Do not expose a working-looking root move without backend support.
- Folder deletion is not an implemented recursive note-deletion operation:
  the service deletes the folder row, and child-folder cascading depends on
  database constraints. Notes have no declared folder foreign-key cascade;
  orphan notes are omitted from tree responses. Agree on nonempty-folder
  deletion behavior before enabling it in mobile; do not promise safe
  recursive deletion or silently issue a non-atomic sequence of deletes.
  Single-note deletion is supported.
- There are no versions, ETags, atomic bulk operations, or offline conflict
  resolution. Partial updates reduce unrelated overwrites but concurrent writes
  to the same field can still overwrite one another.
- No reminders, push registration, background polling, or Telegram setup belongs
  in this mobile feature.

Error responses from Notes handlers generally use `{"error":"..."}`:

| Status | Current behavior |
| --- | --- |
| 400 | Invalid JSON/ID binding or service rejection, including invalid end dates, missing folders, and invalid parent moves. Update-not-found is also 400. |
| 401 | Missing/invalid session; middleware response is not necessarily JSON. |
| 422 | Request validation, e.g. unsupported type, title/name limits, negative position. |
| 404 | Delete failure/not-found. The current delete handler also maps other service failures here. |
| 500 | Tree loading failure. Other service/database failures may be returned as 400 or 404 by the mutation handlers. |

Do not treat every 400 as a client-field error or every 404 as proof that an
item was already removed. Show the server's `error` field when available, with
a fallback for non-JSON responses and network failures.

Disable duplicate writes while saving. Preserve editor input on failure and
leave checkboxes unchanged/revert optimistic changes after rejection.
After a confirmed write, refetch the tree. If that refresh fails, distinguish
"saved, refresh failed" from a failed save and offer Retry refresh, not an
automatic duplicate create. Refresh on screen return and pull-to-refresh;
clear account-specific client state on logout/account change.

## 8. Acceptance and device-validation checklist

| Scenario | Expected result |
| --- | --- |
| Legacy data | Existing folders display as Diary; notes, styles, and ordering survive. |
| Folder navigation | Only folders appear in the navigator; direct items appear in main content. |
| Nested selection | Selecting a child shows its own items, not parent/sibling items. |
| Selection changes | Switching folders closes the old editor; canceling folder creation preserves selection. |
| Root/child creation | Correct parent sent; default Diary; child type remains independent. |
| Configuration | Name/type/position persist after refresh and reopening the app. |
| Buy list | Title and Purchased only, plus common position/folder controls. |
| Tasks list | Title, separate description, optional end date, Done. |
| Diary | Existing text, formatting, and preview; no completion/end-date controls. |
| Hidden fields | Diary -> Buy list -> Tasks list -> Diary retains content, style, description, date, completion. |
| Completion | True and explicit false persist; list toggles do not reset other fields. |
| Nullable description | Omitted/null create returns null; omitted update preserves; null update clears; empty-string compatibility and hidden values survive. |
| Clearing dates | Empty string clears; null is not used as a clear operation. |
| Moving items | New folder list and count update; hidden fields survive; numeric IDs used. |
| Ordering | Position 0 is serialized; ties match the server's timestamp/numeric-ID order. |
| Invalid input | Whitespace names, oversized titles, fractional/negative positions, invalid dates/types are rejected. |
| Empty/deleted items | Helpful empty state; item deletion closes editor and updates counts. |
| Read-only account | Can browse/open; creation, edits, deletion, and completion actions disabled. |
| Errors and sessions | No false empty state/success; input retained; 401 reauthenticates; refresh can be retried independently. |
| Layout/accessibility | Small phone/tablet, keyboard-open editor, large text, screen reader, and theme contrast validated. |
| Date handling | Same end date on devices on both sides of UTC; no UTC-derived date shifts. |

Run the mobile repository's existing lint, type/build checks, and automated
tests, then validate supported iOS/Android targets. Web browser and Go tests do
not substitute for device validation.

## 9. Integration prerequisites

Obtain the mobile repository/framework, supported OS targets, API origins,
normal test access, localization/design conventions, and agreed folder-deletion
policy before implementation. Backend deployment must include the new folder
type and item-field migrations; do not recreate or import existing records.

Deliver connected screens, focused automated tests, device results for section 8,
and setup instructions without credentials. Offline queued writes, per-user
isolation, new authorization rules, and notification scheduling are separate work.

## 10. Repository reference map

| Reference | What to inspect |
| --- | --- |
| [Notes DTOs](api-go/notes/notes_models.go) | Exact JSON fields, enum values, optionality, validation. |
| [Notes handlers](api-go/notes/notes_handler.go) | Routes, status codes, error shapes. |
| [Notes service](api-go/notes/notes_service.go) | Tree ordering, preservation, parent/date validation. |
| [Database entities](api-go/internal/db/entities.go) | Defaults, numeric IDs, deletion constraints. |
| [Database initialization](api-go/internal/db/gorm_db.go) | Startup migrations. |
| [Auth middleware](api-go/user/auth_middleware.go) | Existing authentication and role helpers. |
| [Web API client](frontend/src/api/domains/notes.ts) | Current request shapes. |
| [Web workspace](frontend/src/components/Notes/NotesWorkspace.tsx) | Folder selection, typed payloads, mutations. |
| [Folder actions](frontend/src/components/Notes/FolderActions.tsx) | Root/subfolder/configuration controls. |
| [Folder tree](frontend/src/components/Notes/NoteTree.tsx) | Folder-only navigator, type icons, counts. |
| [Item list](frontend/src/components/Notes/NoteList.tsx) | Direct items and completion controls. |
| [Editor](frontend/src/components/Notes/NoteEditor.tsx) | Type-specific forms and optional date picker. |
| [Folder dialog](frontend/src/components/Notes/FolderDialog.tsx) | Folder name, type, and position configuration. |
| [Service tests](api-go/notes/notes_service_test.go) | Migration, ordering, type conversion, hidden-field preservation. |
| [Handler tests](api-go/notes/notes_handler_test.go) | Binding, defaults, explicit resets, validation. |
| [Frontend tests](frontend/tests/notes-types.test.mjs) | Field visibility, sidebar separation, action restrictions, payloads. |
