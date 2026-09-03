# Task 6 Report: API Bootstrap, Request Context, Validation, and Health

## Files changed

- Replaced the API foundation stub in `apps/api/src/main.ts` with Nest application startup and reusable runtime configuration for the `/api/v1` prefix, strict CORS, cookie parsing, security headers, request context, validation, and structured exception handling.
- Added `apps/api/src/common/request-context.middleware.ts` to accept bounded safe incoming request IDs or generate UUID request IDs and return them in every response header.
- Added `apps/api/src/common/http-exception.filter.ts` to serialize application/HTTP errors with request metadata, map malformed JSON to `400 INVALID_REQUEST`, preserve `422 VALIDATION_ERROR` for DTO validation, and redact unexpected failures.
- Added `apps/api/src/common/validation.pipe.ts` to validate body DTOs that expose strict Zod schemas while leaving Task 5's existing explicit Zod validation unchanged.
- Added the health module/controller under `apps/api/src/modules/health/` with process liveness plus injectable PostgreSQL `SELECT 1` and Redis `PING` readiness checks.
- Registered `HealthModule` in `apps/api/src/app.module.ts`.
- Added `apps/api/src/modules/health/health.controller.test.ts` for request ID propagation, cookie parsing, malformed/unknown payload rejection, redacted errors, liveness/security/CORS, and readiness dependency failure.
- Updated the existing identity E2E harness to use the production bootstrap configuration, proving Task 5 routes and cookie-session behavior remain compatible.

## TDD and verification

- RED: `npm test -- health.controller.test.ts` from `apps/api` — expected failure, 6/6 tests failed because `health.module.ts` did not exist.
- GREEN: `npm test -- health.controller.test.ts` from `apps/api` — PASS, 6 tests.
- `npm test` from `apps/api` — PASS, 4 files and 25 tests.
- `npm run test:e2e -- identity.e2e.test.ts` from `apps/api` — PASS, 1 file and 5 tests using `configureApi`.
- `npm run typecheck` from `apps/api` — PASS.
- `npm run lint` from `apps/api` — PASS.
- `git diff --check` — PASS after implementation and report creation.

## Limitations

- `pnpm` and Corepack are not installed in this shell, so equivalent package-local npm scripts used the repository's already-installed pnpm dependency tree. No dependencies or lockfiles were changed.
- Readiness failure is covered through injected checks. The concrete PostgreSQL and Redis checks were not run against live services in this task verification.
- The minimal Redis readiness adapter supports direct `redis://` and TLS `rediss://` PING checks without Redis AUTH or database selection; the current local configuration is unauthenticated Redis. A future authenticated Redis deployment should replace this adapter with the shared Redis client introduced alongside queue infrastructure.
- The existing non-failing Vitest ESM-config warning remains unchanged.

## Completion follow-up

- Exposed liveness and readiness at the design-required unprefixed routes, `GET /health/live` and `GET /health/ready`, while retaining `/api/v1` for application endpoints.
- Added regressions for unsafe incoming request IDs, malformed JSON response/header correlation, successful readiness, and the public health route paths.
- Corrected CORS from a fixed response origin to a one-entry allowlist. Requests from the configured application origin receive that origin in `Access-Control-Allow-Origin`; an attacker origin is not reflected and receives no allow-origin header.
- RED: `./node_modules/.bin/vitest run apps/api/src/modules/health/health.controller.test.ts` — expected failure: 1 failed and 8 passed because the attacker response incorrectly emitted `Access-Control-Allow-Origin: https://orbit.example.com`.
- GREEN: the same focused command — PASS: 1 file and 9 tests.
- Focused API tests covering health/bootstrap plus identity filters/controllers — PASS: 3 files and 23 tests.
- Identity API E2E tests using `apps/api/vitest.e2e.config.ts` — PASS: 1 file and 5 tests; the pre-existing ESM-config warning was the only warning.
- `./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json` — PASS.
- `./node_modules/.bin/eslint --config eslint.config.mjs apps/api` — PASS.
- `git diff --check` — PASS.
