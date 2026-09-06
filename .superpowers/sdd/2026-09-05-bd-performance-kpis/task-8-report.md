# Task 8 — Browser coverage and final verification

## Delivered scope

- Added three role-scoped Playwright specs for BD performance, Admin performance, and duplicate review workflows.
- Added shared E2E helpers that require environment-backed credentials, assert the required local ports, audit app-owned console/network failures, and retain screenshots in Playwright's workspace output directory.
- Configured browser artifacts under `output/playwright/` and forwarded `ORBIT_DEMO_PASSWORD` only from the process environment.
- Documented disposable-database seed/start/test commands using `3100` and `3101` only.
- Made the demo seed require `ORBIT_DEMO_PASSWORD` and removed its password echo.

## Browser coverage

- BD: daily target progress, remaining target, personal score coverage, personal drill-down, peer-safe quality summary, and Edit/Open application/Open calendar interview actions.
- Admin: rolling-period controls, KPI drill-down, Building Baseline, reassignment queue, rule impact preview, future-effective save, and rule history.
- Duplicate workflow: server rejection of incomplete intake, automatic applied date, confirmed duplicate traceability with zero credit, likely-duplicate warning and mandatory override, Admin approval retention, Admin rejection, and rejected-review qualified-credit removal.

## Review follow-up coverage

- Duplicate rejection now captures the provisional lead and owner, proves that lead appears in the owner’s Admin-authorized qualified-applications drill-down before review, and proves it is absent after Admin rejection. This verifies the target-credit projection rather than only the lead flag.
- A signed-in BD now receives an `/unauthorized` redirect for the Admin rules screen and HTTP `403` from the Admin performance summary, performance drill-down, rules, and reassignment-queue APIs. The assertions also reject any leaked qualified-application KPI data.
- Dedicated 390px viewport checks cover the BD dashboard plus the Admin dashboard and performance-rules route. Each asserts its operational cards are visible and the document has no horizontal overflow.

## Verification evidence

Passed:

- `npm --prefix apps/web run test:e2e -- --list e2e/bd-performance.spec.ts e2e/admin-bd-performance.spec.ts e2e/duplicate-review.spec.ts` — 3 tests discovered.
- `npm --prefix apps/web run lint`.
- `npm --prefix apps/web run typecheck`.
- `npm --prefix apps/api run typecheck`.
- `npm --prefix packages/backend run typecheck`.
- `npm --prefix packages/contracts run typecheck`.
- `packages/database/node_modules/.bin/prisma validate --schema packages/database/prisma/schema.prisma`.
- `git diff --check`.
- `npm --prefix apps/web run test:e2e -- --list e2e/bd-performance.spec.ts e2e/admin-bd-performance.spec.ts e2e/duplicate-review.spec.ts` — 6 tests discovered across the 3 required specs after the review follow-up.
- `npm --prefix apps/web run typecheck`.
- `npm --prefix apps/web run lint`.
- Playwright CLI opened and snapshotted `http://localhost:3100/login` successfully.
- Controlled local stack startup used only `PORT=3100` and `API_PORT=3101`; `GET http://localhost:3101/health/ready` returned HTTP 200 and `GET http://localhost:3100/login` returned HTTP 200.

Blocked live verification:

- The current shell has neither `ORBIT_E2E_ADMIN_PASSWORD` nor `ORBIT_E2E_BD_PASSWORD`, and neither `http://localhost:3100/login` nor `http://localhost:3101/health/ready` is running. An authenticated browser run cannot safely start without the environment-supplied credentials.
- `prisma migrate status` against the configured shared local `orbit` database at `localhost:55432` reports migration-history drift: database-only `20260724111622_auth_api_updated` plus seven unapplied BD-performance migrations beginning `20260905010000_harden_performance_rule_invariants`.
- The running worker logged `worker.performance_sla_evaluation_failed` with `PrismaClientKnownRequestError`, consistent with that drift.
- The full browser run on `3100/3101` executed all three required specs and failed at sign-in. A direct API login with the environment-backed `ORBIT_SEED_ADMIN_PASSWORD` and `Origin: http://localhost:3100` returned HTTP 401 `Invalid email or password`. No fallback or committed credential was introduced.
- `npx vitest run apps/web packages/contracts packages/backend` ran 498 tests: 492 passed and 6 failed. All six failures are in pre-existing, uncommitted calendar/closer visual work (`calendar-workspace.test.tsx` and `closer-dashboard.test.tsx`), outside Task 8. Those files were preserved untouched.

## Ruling

Do not migrate, reset, or reseed the configured shared local database. A clean disposable database with the current migration set and the two environment-supplied seed passwords is required for successful live E2E execution.

## Commit scope

Only Task 8 specs, helper, Playwright configuration, README, demo/local seed adjustment, and Task 8 review artifacts are staged. Existing calendar, dashboard, lead-intake, CSS, and ledger edits remain uncommitted.
