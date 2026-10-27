# MFA AI Prompt for this Application

Purpose
-------
This file contains a single, detailed prompt you can paste to an AI assistant to help design and implement multi-factor authentication (MFA) for this specific repository.

Prompt
------
You are a senior software engineer and security architect. I need you to design and implement Multi-Factor Authentication (MFA) for a web application whose backend is in Go and frontend is a TypeScript React app (Vite). The repository layout is a monorepo with the backend under `api-go/` and the frontend under `frontend/`.

Requirements
- Propose a recommended MFA approach (TOTP as primary, WebAuthn as passwordless/strong second factor, SMS/email only for recovery/backup) and justify tradeoffs.
- Produce a step-by-step implementation plan with high-level design, database schema changes, API endpoints, backend code snippets in Go, and frontend components in TypeScript/React matching the repo style.
- Provide PR-ready patches (file paths and code snippets) for both `api-go/` and `frontend/` so I can apply them directly. Indicate exact files to create or modify and include full file contents for each patch.
- Add migrations or instructions to modify the database (column names, indices, constraints). Use clear SQL or migration tool commands.
- Implement secure TOTP (RFC 6238) support: generation of secret, QR code provisioning payload (otpauth://), verification endpoints, backup codes generation, and rotation/invalidations.
- Implement WebAuthn registration and authentication flows (server-side relying party handling in Go and client-side registration/authentication in React) with fallback to TOTP.
- Add account recovery and backup flows: single-use recovery codes, email fallback, device management (list/remove registered authenticators), and rate limiting to prevent abuse.
- Provide concrete API contract examples (HTTP methods, paths, request and response JSON) for each endpoint.
- Integrate MFA enforcement checks into the existing login/session flow (stateless JWT or session cookies — detect repo/session approach and adapt). Provide code showing where to plug checks in the auth flow.
- Include tests: unit tests for verification logic in Go, and component/integration tests for the frontend (React testing library / vitest). Provide commands to run tests.
- List required third-party libraries or services (Go packages, npm packages, optional SMS/email providers like Twilio or SendGrid) and the minimal configuration required (env vars). Explain security considerations (secret storage, CSRF, rate limits, replay attacks, PKCE if applicable, transport security requirements).
- Provide a deployment checklist and migration/rollout strategy that is low-risk for production users (feature flags, gradual rollout, admin disable, monitoring, and audit-logging suggestions).
- Provide suggested commit messages and PR title/description templates.

Context and constraints you should assume
- Backend: Go modules under `api-go/`. There are packages such as `user/` and auth-related handlers (adapt as necessary). Use idiomatic Go and prefer standard libraries plus well-audited packages.
- Frontend: React + TypeScript under `frontend/src/`. Use the existing `frontend/src/api/` APIs and the app's styling/components pattern. Provide new components under `frontend/src/components/MFA/` and API client calls under `frontend/src/api/`.
- DB: Use existing server DB conventions; keep changes minimal and additive. Include rollback SQL for every migration.
- UX: Keep MFA opt-in per-user initially. Add clear onboarding flow (enable MFA → choose method → verify → backup codes), and an admin toggle to require MFA later.
- Compatibility: Support existing accounts without forcing immediate enrollment. Ensure sessions created prior to enabling MFA are handled safely.

Deliverables (explicit)
1. A short design doc summarizing choices (1-2 paragraphs).
2. An ordered implementation plan with milestones and estimated complexity (Low/Medium/High) for each step.
3. PR-style patches: file paths and full file contents to add/modify for backend and frontend.
4. SQL/migration files with up/down statements.
5. Tests and commands to run them.
6. Post-deploy checklist and rollback steps.

If anything in the repository structure is unclear, ask a single clarifying question before producing patches. Otherwise, proceed and assume the project uses standard Go HTTP handlers and a React app with an internal API client under `frontend/src/api`.

Notes for the AI implementer
- Be explicit: when adding or modifying files, show the path and full file contents.
- Use secure defaults: minimum secret length, proper crypto libraries, constant-time comparisons, and hygiene around logging secrets.
- Where choices exist (e.g., SMS vs email vs push), list pros/cons and provide a reasonable default.

Example quick-start tasks (ask the AI to produce these first)
- Add TOTP secret management and verification endpoints in `api-go/user`.
- Add a `MFASetup` React component and a `MFAChallenge` component in `frontend/src/components/MFA/`.
- Add migration to store `mfa_enabled boolean`, `mfa_totp_secret varchar`, `mfa_recovery_hashes jsonb` (or equivalent), and `webauthn_devices jsonb`.

End
