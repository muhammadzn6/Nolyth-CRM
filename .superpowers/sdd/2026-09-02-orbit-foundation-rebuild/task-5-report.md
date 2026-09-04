# Task 5 Report: Identity, Session, and Authorization Services

## Status

Implemented and reviewed the Task 5 identity boundary, including password verification, rotating hash-only sessions, active-user authentication, role/profile authorization, and Nest authentication endpoints using secure HTTP-only cookies.

## Review fixes

- Added an API `AppErrorFilter` to translate backend authentication and authorization errors into their intended HTTP status, code, and generic message. Without it, Nest would return 500 responses for expected 401/403 failures.
- Updated session lookups to request `include: { user: true }`. Prisma does not load relations by default; without this include, every valid session would lack its user record and be rejected as unauthenticated.
- Added focused regression coverage for both fixes. The identity fixture now matches Prisma relation-loading behavior.

## Verification

- `./node_modules/.bin/vitest run packages/backend/src/identity/identity.service.test.ts apps/api/src/modules/identity/app-error.filter.test.ts` — PASS: 2 files, 9 tests.
- `./node_modules/.bin/tsc --noEmit -p packages/backend/tsconfig.json && ./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json` — PASS.
- Scoped backend/API ESLint checks — PASS.
- `git diff --check` — PASS.

## E2E limitation

The focused API E2E suite was attempted with `./node_modules/.bin/vitest run --config apps/api/vitest.e2e.config.ts apps/api/src/modules/identity/identity.e2e.test.ts`. Supertest attempted to listen on `0.0.0.0`, but this sandbox rejected the bind with `listen EPERM: operation not permitted 0.0.0.0`. The resulting three test failures are therefore not endpoint assertions and cannot validate the HTTP path in this environment. Rerun this suite where local socket binding is permitted.

## Concerns

- The prescribed `pnpm` commands cannot run here because `pnpm` is not installed. Equivalent checks used the repository-local Vitest, TypeScript, and ESLint executables.
- `IdentityModule` adapts Prisma through an `as unknown as IdentityDatabase` boundary. It now issues the required relation include, but the cast means future Prisma delegate-shape drift will not be caught at that injection point.

## Review follow-up: constant-work login, CSRF, and validation

- Login now always performs password verification. Missing accounts, inactive accounts, missing/non-Argon2id hashes, and unusable Argon2id hashes are routed through a fixed valid Argon2id dummy hash while retaining the generic `Invalid email or password` failure.
- POST login and logout now require a single safe HTTP(S) `Origin` whose parsed origin exactly matches configured `APP_BASE_URL`. Missing, malformed, `null`, multiple, and cross-site Origin values are rejected with 403 before authentication or session mutation.
- Invalid login payloads are converted from raw Zod failures to `ValidationError`, allowing the existing API error filter to return 422 with `VALIDATION_ERROR` instead of 500.
- Added runnable unit regressions for all three findings and extended the API E2E cases with trusted-Origin, CSRF rejection, and invalid-input expectations.

## Follow-up verification

- `./node_modules/.bin/vitest run packages/backend/src/identity/password.constant-work.test.ts packages/backend/src/identity/identity.constant-work.test.ts packages/backend/src/identity/identity.service.test.ts apps/api/src/modules/identity/identity.controller.test.ts apps/api/src/modules/identity/app-error.filter.test.ts` — PASS: 5 files, 29 tests.
- `./node_modules/.bin/tsc --noEmit -p packages/backend/tsconfig.json` — PASS.
- `./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json` — PASS.
- Scoped ESLint checks for all changed backend/API TypeScript files — PASS.
- `git diff --check` — PASS.

The API E2E suite was rerun after adding the new cases. It remains blocked before endpoint assertions because Supertest cannot bind `0.0.0.0` in this sandbox (`listen EPERM: operation not permitted 0.0.0.0`); all five cases report the same environment limitation. No broad rate-limiting or session-concurrency behavior was added.
