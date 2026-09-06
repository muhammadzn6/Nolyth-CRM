# Task 8 — Browser coverage and final verification

## Delivered scope

- Added three role-scoped Playwright specs for BD performance, Admin performance, and duplicate review workflows.
- Added shared E2E helpers that require environment-backed credentials, assert the required local ports, audit app-owned console/network failures, and retain screenshots in Playwright's workspace output directory.
- Configured browser artifacts under `output/playwright/` and forwarded `ORBIT_DEMO_PASSWORD` only from the process environment.
- Documented disposable-database seed/start/test commands using `3100` and `3101` only.
- Made the demo seed require `ORBIT_DEMO_PASSWORD` and removed its password echo.

## Final review follow-up

- Added an enforceable demo-seed guard before any hashing or Prisma query. It permits only `orbit_task3_test` and `orbit_e2e` database names by default.
- An explicit `ORBIT_ALLOW_DEMO_SEED=true` override is available for a deliberate non-production local exception; the guard rejects every production invocation, including that override.
- Added a four-case safety test covering shared-database rejection, approved non-production override, production override rejection, and the `orbit_e2e` allowlist path.
- Extended authenticated-BD denial coverage to `GET /performance/rules/history`, `POST /performance/rules/preview`, and `PATCH /performance/rules`. These calls use Playwright's browser-context API client (shared signed-in cookie storage), assert `403`, and reject leaked rule or KPI data.

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
- `npx vitest run packages/database/prisma/seed-demo-safety.test.ts` — 4/4 passed.
- `npm --prefix packages/database run typecheck`.
- `npm --prefix apps/web run typecheck`.
- `npm --prefix apps/web run lint`.
- `npm --prefix apps/web run test:e2e -- --list e2e/bd-performance.spec.ts e2e/admin-bd-performance.spec.ts e2e/duplicate-review.spec.ts` — 6 tests discovered across the 3 required specs.
- `NODE_ENV=production DATABASE_URL=…/orbit_e2e pnpm db:seed:demo` — rejected by the demo-seed guard before any database connection or mutation.
- `npm --prefix apps/web run test:e2e -- --list e2e/bd-performance.spec.ts e2e/admin-bd-performance.spec.ts e2e/duplicate-review.spec.ts` — 6 tests discovered across the 3 required specs after the review follow-up.
- `npm --prefix apps/web run typecheck`.
- `npm --prefix apps/web run lint`.
- Playwright CLI opened and snapshotted `http://localhost:3100/login` successfully.
- Controlled local stack startup used only `PORT=3100` and `API_PORT=3101`; `GET http://localhost:3101/health/ready` returned HTTP 200 and `GET http://localhost:3100/login` returned HTTP 200.

Blocked live verification:

- The current shell has neither `ORBIT_E2E_ADMIN_PASSWORD` nor `ORBIT_E2E_BD_PASSWORD`, and fresh checks returned `000` for both `http://localhost:3100/login` and `http://localhost:3101/health/ready`. An authenticated browser run cannot safely start without the environment-supplied credentials.
- `prisma migrate status` against the configured shared local `orbit` database at `localhost:55432` reports migration-history drift: database-only `20260724111622_auth_api_updated` plus seven unapplied BD-performance migrations beginning `20260905010000_harden_performance_rule_invariants`.
- The running worker logged `worker.performance_sla_evaluation_failed` with `PrismaClientKnownRequestError`, consistent with that drift.
- The full browser run on `3100/3101` executed all three required specs and failed at sign-in. A direct API login with the environment-backed `ORBIT_SEED_ADMIN_PASSWORD` and `Origin: http://localhost:3100` returned HTTP 401 `Invalid email or password`. No fallback or committed credential was introduced.
- `npx vitest run apps/web packages/contracts packages/backend` ran 498 tests: 492 passed and 6 failed. All six failures are in pre-existing, uncommitted calendar/closer visual work (`calendar-workspace.test.tsx` and `closer-dashboard.test.tsx`), outside Task 8. Those files were preserved untouched.

## Ruling

Do not migrate, reset, or reseed the configured shared local database. A clean disposable database with the current migration set and the two environment-supplied seed passwords is required for successful live E2E execution.

## Commit scope

Only Task 8 specs, helper, Playwright configuration, README, demo/local seed adjustment, and Task 8 review artifacts are staged. Existing calendar, dashboard, lead-intake, CSS, and ledger edits remain uncommitted.

## Final runtime recheck

- Frontend is currently running at `http://localhost:3100` and `/login` returned HTTP 200.
- Backend is currently running at `http://localhost:3101`; `/health/live` and `/health/ready` both returned HTTP 200.
- No process was started on ports 3000 or 3001.
- Authenticated E2E remains pending until valid `ORBIT_E2E_ADMIN_PASSWORD` and `ORBIT_E2E_BD_PASSWORD` values are supplied and the shared database migration drift is resolved on a disposable database.
