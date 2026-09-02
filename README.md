# Spending Tracker: AI Section Implementation Prompt

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
- Backend implementation when the feature persists or retrieves data.
- Frontend implementation, including loading, empty, error, validation, and unauthorized states as applicable.
- Focused automated tests for new business logic, handlers, or non-trivial UI behavior.
- Validation by running the relevant Go tests and frontend typecheck, lint, or build commands.

Do not replace existing tooling, introduce a new state-management framework, refactor unrelated code, or add dependencies unless the feature cannot be implemented with the installed stack. Before adding a dependency, explain why an existing library cannot meet the need.

Follow all repository guidelines below.
```

## Backend Guidelines

- Language: Go, as declared in `api-go/go.mod` (currently Go 1.25).
- HTTP framework: Fiber v2. Database access: GORM, using SQLite or PostgreSQL drivers already configured by the application.
- Dependency injection: use `samber/do/v2` and register new dependencies through the existing DI setup when required.
- Organize domain work under `api-go/<feature>/`. Follow the nearby pattern of `<feature>_models.go`, `<feature>_service.go`, and `<feature>_handler.go` (or the existing domain naming convention).
- Keep handlers thin: parse and validate HTTP input, authorize, call services, and map HTTP responses. Keep queries, transactions, and business rules in services.
- Define request/response DTOs and database models explicitly. Use JSON tags and validate incoming data. Do not expose database-only fields accidentally.
- Register API routes through the domain handler using the existing `/api` grouping. Apply the established authentication and role middleware; do not create unauthenticated endpoints unless the request explicitly requires it.
- Return appropriate status codes: `400` for invalid input, `401`/`403` for access failures, `404` for absent resources, and `500` only for unexpected server failures.
- Use parameterized GORM queries. Make multi-record mutations transactional with `db.Transaction`.
- Prefer existing helper functions and types in the relevant domain before creating duplicates.
- Add focused Go tests alongside the affected backend package, especially for business rules, authorization-sensitive behavior, and import/export parsing.

## Frontend Guidelines

- Language: TypeScript. Framework/build tool: React 19 with Vite.
- UI system: MUI with Emotion. Use MUI components and `@mui/icons-material` for controls; retain the existing theme and visual language.
- Routing: React Router. Add the new route and navigation entry through the existing application routing/navigation pattern.
- Place reusable UI in `frontend/src/components/`; place feature screens in the nearest existing page or feature directory. Do not put all implementation code in `App.tsx`.
- Use the existing API client under `frontend/src/api/`. Add endpoint metadata to `api/endpoints.ts` and use the client rather than ad hoc `fetch` calls.
- Keep request/response schemas and types in the existing API schema/domain structure. Preserve global ambient types in `src/types/` unless all consumers are intentionally migrated.
- Use functional React components and typed props. Follow the repository's existing hooks and local state patterns; do not add global state management for a self-contained section.
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