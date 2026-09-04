# Task 5 Report — Admin user-management integration

## Delivered

- Updated `README.md`, the local-development runbook, foundation architecture docs, foundation security docs, and foundation verification docs for the bootstrap admin → admin invite → invitation acceptance → role/activation/session-management lifecycle.
- Added `apps/web/e2e/user-management.spec.ts` to smoke the admin user-management browser journey on the existing Playwright `3100`/`3101` isolated runtime:
  - seeded admin signs in;
  - admin creates an invited teammate;
  - invited teammate accepts the one-time link and signs in;
  - invited non-admin does not see admin navigation;
  - admin revokes sessions and deactivates the teammate.
- Added `packages/testing/src/user-management-orchestration.test.ts` to regress the E2E orchestration contract:
  - root `test:e2e` remains `pnpm test:e2e:services && pnpm test:e2e:smoke`;
  - the browser smoke script does not target `@orbit/database` or inject a destructive `DATABASE_URL`;
  - the user-management browser smoke file is present in the serialized Playwright stage.
- Fixed the low-priority `revokeUserSessions` client gap: successful responses now pass through the shared success-envelope validator instead of accepting any `2xx` body.

## Red → green evidence

- RED: `./node_modules/.bin/vitest run apps/web/lib/api-client.test.ts`
  - failed 1 test because `revokeUserSessions(...)` resolved `undefined` for a malformed `200 OK` body.
- GREEN: `./node_modules/.bin/vitest run apps/web/lib/api-client.test.ts`
  - passed 1 file, 10/10 tests.
- RED: `./node_modules/.bin/vitest run packages/testing/src/user-management-orchestration.test.ts`
  - failed because `apps/web/e2e/user-management.spec.ts` was not present.
  - The first draft also caught an over-broad test assertion that treated `pnpm test:e2e` as a standalone destructive `pnpm test`; the assertion was narrowed to standalone command matching before the green run.
- GREEN: `./node_modules/.bin/vitest run packages/testing/src/user-management-orchestration.test.ts`
  - passed 1 file, 2/2 tests.

## Verification run

- `./node_modules/.bin/vitest run apps/web/**/*.test.ts apps/web/**/*.test.tsx` — PASS, 6 files and 34/34 tests.
- `./node_modules/.bin/vitest run packages/testing/src` — PASS, 3 files and 6/6 tests.
- `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` — PASS.
- `./node_modules/.bin/tsc --noEmit -p packages/testing/tsconfig.json` — PASS.
- `packages/database/node_modules/.bin/prisma validate --schema packages/database/prisma/schema.prisma` without `DATABASE_URL` — FAIL, `Environment variable not found: DATABASE_URL`.
- `DATABASE_URL=postgresql://orbit:orbit@localhost:5432/orbit packages/database/node_modules/.bin/prisma validate --schema packages/database/prisma/schema.prisma` — PASS.
- `./node_modules/.bin/turbo run lint` — FAIL before package scripts ran: Turbo could not find the configured package-manager binary because `pnpm` is not on PATH.
- `./node_modules/.bin/turbo run typecheck` — FAIL before package scripts ran for the same missing package-manager binary.
- Direct lint equivalents — PASS:
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `apps/web`
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `apps/api`
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `apps/worker`
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `packages/backend`
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `packages/testing`
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `packages/contracts`
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `packages/config`
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `packages/database`
  - `./node_modules/.bin/eslint --config ../../eslint.config.mjs .` from `packages/ui`
- Direct typecheck/build equivalents — PASS:
  - `./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json`
  - `./node_modules/.bin/tsc --noEmit -p apps/worker/tsconfig.json`
  - `./node_modules/.bin/tsc --noEmit -p packages/backend/tsconfig.json`
  - `./node_modules/.bin/tsc --noEmit -p packages/config/tsconfig.json`
  - `./node_modules/.bin/tsc --noEmit -p packages/contracts/tsconfig.json`
  - `./node_modules/.bin/tsc --noEmit -p packages/database/tsconfig.json`
  - `./node_modules/.bin/tsc --noEmit -p packages/ui/tsconfig.json`
  - `./node_modules/.bin/tsc -p apps/api/tsconfig.json`
  - `./node_modules/.bin/tsc -p apps/worker/tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/backend/tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/config/tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/database/tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/testing/tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/ui/tsconfig.json`
- Workspace-owned Vitest suite with disposable DB URL:
  - command: `DATABASE_URL=postgresql://orbit:orbit@localhost:5432/orbit_task3_test ./node_modules/.bin/vitest run <30 workspace-owned test files>`
  - result: FAIL only in the two destructive DB suites before test bodies ran; 28/30 files passed, 162 tests passed, 14 DB tests skipped after suite initialization failed.
  - failure: Prisma `P1010` / `User was denied access on the database (not available)` at the guarded `DROP SCHEMA "public" CASCADE` setup in `packages/database/src/client.test.ts` and `packages/database/src/user-management.test.ts`.
- Direct guarded DB suites from `packages/database` with the same disposable URL — FAIL with the same Prisma `P1010` at `DROP SCHEMA "public" CASCADE`.
- Container metadata checks:
  - `docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'` showed Postgres, Redis, and object storage containers healthy.
  - `docker exec orbit-foundation-rebuild-postgres-1 createdb -U orbit orbit_task3_test` reported the disposable database already exists.
  - `docker exec orbit-foundation-rebuild-postgres-1 psql -U orbit -d postgres -c '\l orbit'` showed database `orbit` owned by `orbit`.
  - `docker exec orbit-foundation-rebuild-postgres-1 psql -U orbit -d postgres -c '\l orbit_task3_test'` showed database `orbit_task3_test` owned by `orbit`.
  - `docker exec orbit-foundation-rebuild-postgres-1 psql -U orbit -d orbit_task3_test -c '\dn+ public'` showed schema `public` owned by `orbit`.
- API/worker E2E, package-directory invocation — PASS:
  - from `apps/api`: `../../node_modules/.bin/vitest run --config vitest.e2e.config.ts` — 7 files, 56/56 tests.
  - from `apps/worker`: `../../node_modules/.bin/vitest run --config vitest.e2e.config.ts` — 3 files, 10/10 tests.
  - Both emitted the existing Vite warning about ESM syntax in a config loaded as CommonJS under the future native loader.
- Incorrect root-based E2E config invocation:
  - `./node_modules/.bin/vitest run --config apps/api/vitest.e2e.config.ts` and the worker equivalent from the repo root are not valid substitutes for package scripts; they swept unrelated prototype/root/web/Playwright files and failed accordingly.
- Web build:
  - sandbox command with local env and `3100`/`3101` origins failed with `TurbopackInternalError: Failed to write app endpoint /page`, caused by `creating new process` → `binding to a port` → `Operation not permitted (os error 1)`.
  - escalated rerun of the same command failed with the same Turbopack port-binding error.
- Normal local DB migration/seed for browser smoke:
  - `DATABASE_URL=postgresql://orbit:orbit@localhost:5432/orbit packages/database/node_modules/.bin/prisma migrate deploy --schema packages/database/prisma/schema.prisma` — FAIL with Prisma `P1010`.
  - `DATABASE_URL=postgresql://orbit:orbit@localhost:5432/orbit ORBIT_SEED_ADMIN_PASSWORD=local-e2e-admin-password packages/database/node_modules/.bin/tsx packages/database/prisma/seed.ts` — FAIL with Prisma `P1010`.
  - `DATABASE_URL=postgresql://orbit:orbit@127.0.0.1:5432/orbit packages/database/node_modules/.bin/prisma migrate status --schema packages/database/prisma/schema.prisma` — FAIL with Prisma `P1010`.
  - `DATABASE_URL=postgresql://orbit:orbit@localhost:5432/orbit packages/database/node_modules/.bin/prisma migrate status --schema packages/database/prisma/schema.prisma` — FAIL with Prisma `P1010`.
  - `DATABASE_URL=postgresql://orbit:orbit@172.20.0.2:5432/orbit packages/database/node_modules/.bin/prisma migrate status --schema packages/database/prisma/schema.prisma` was interrupted by the user before a result was returned.

## Limits and notes

- `pnpm` is not installed on PATH, so root Turbo scripts cannot dispatch package scripts in this shell. Direct local binaries were used instead.
- The raw root `./node_modules/.bin/vitest run` form traverses nested workspace `node_modules` package tests; it was interrupted and replaced with explicit workspace-owned test files.
- The destructive database tests were run only before browser smoke and were never run concurrently with Playwright.
- The Playwright browser smoke was not executed because the normal local `orbit` database could not be migrated or seeded via Prisma with the documented `orbit:orbit` credentials in this environment.
- No ports `3000` or `3001` were used for the new Playwright smoke configuration. The smoke file relies on the existing Playwright config defaults of `3100` and `3101`.
- `pgrep -fl 'vitest|next build|playwright test|start-foundation|prisma migrate status|prisma migrate deploy|tsx packages/database/prisma/seed'` returned no matches after the user asked to stop long-running checks.
