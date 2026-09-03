# Task 1 implementation report

## Files changed

- Created the pnpm/Turborepo workspace manifests: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, and `pnpm-lock.yaml`.
- Created manifests for `@orbit/web`, `@orbit/api`, `@orbit/worker`, `@orbit/config`, `@orbit/contracts`, `@orbit/database`, `@orbit/backend`, `@orbit/ui`, and `@orbit/testing`.
- Created empty TypeScript entrypoints for each app and package.
- Created `packages/testing/src/workspace.test.ts` and its metadata helper, `packages/testing/src/workspace.ts`.
- Created strict root TypeScript defaults and package-level `tsconfig.json` files.
- Replaced the prototype `.gitignore` with workspace-oriented ignores while preserving `.worktrees/`.
- Deleted the prototype root `package-lock.json` and obsolete Next-only configuration files: `next.config.ts`, `eslint.config.mjs`, and `postcss.config.mjs`.

## Tests run and results

- `npx --yes pnpm@10.15.1 exec vitest run packages/testing/src/workspace.test.ts` — PASS (1 test).
- `npx --yes pnpm@10.15.1 typecheck` — PASS (9 packages).
- `git diff --check` — PASS.

The initial `pnpm` command could not run because pnpm was not installed in the environment. The pinned pnpm CLI was then run ephemerally, and the minimal declared dependencies were installed safely with pnpm.

## Design decisions

- Used pnpm workspace globs for `apps/*` and `packages/*`.
- Used Turborepo `tasks` configuration, with build dependencies and non-cacheable development/database tasks.
- Kept package manifests intentionally minimal and used `workspace:*` dependencies for internal package relationships.
- Added explicit package `exports` pointing to TypeScript source entrypoints so each `@orbit/*` package is resolvable before later tasks add implementations.
- Kept the existing root Vitest configuration usable by retaining its test setup dependency.

## Concerns

- The prototype application source remains at the repository root; later tasks will need to move or replace it as the web/API packages are implemented.
- Package scripts for database migration/seed and e2e testing are foundation placeholders until later tasks create those entrypoints/configurations.

## Review fix report

### Files changed

- Updated all workspace package manifests with the package-local tooling they invoke: Next/ESLint/Playwright for web, tsx/ESLint for API and worker, tsx/ESLint for database, and ESLint for shared packages.
- Changed web `dev` to a safe foundation Node command that does not require an application implementation.
- Added minimal `apps/api/src/main.ts`, `apps/worker/src/main.ts`, `packages/database/src/migrate.ts`, and `packages/database/src/seed.ts` stubs for the advertised scripts.
- Extended `packages/testing/src/workspace.test.ts` to cover all three apps and five shared packages, including `@orbit/testing`, and to verify every package exports `./src/index.ts`.
- Extended `packages/testing/src/workspace.ts` with package metadata reading while retaining the package-name helper.
- Updated `pnpm-lock.yaml` from the manifest changes.

### Tests run/results

- Focused Vitest workspace test — PASS (1 test).
- `pnpm typecheck` — PASS (9 packages).
- API and worker entrypoint commands — PASS.
- Web foundation `dev` command — PASS.
- Database `db:migrate` and `db:seed` commands — PASS.

### Design decisions and concerns

- Tooling is declared in the workspace package that invokes it, while shared root tooling remains available for root orchestration.
- Foundation stubs only print readiness messages and contain no product behavior; later tasks own their replacement.
- The existing e2e scripts remain placeholders until later tasks add Playwright/Vitest e2e configuration and tests.

## Review fix report — round 2

### Files changed

- Added shared ESLint 9 flat configuration in `eslint.config.mjs`, including TypeScript parsing and global generated-output ignores.
- Wired every app/package lint script to the shared config and added the parser dependency to the root toolchain.
- Added minimal `apps/web/app/layout.tsx` and `apps/web/app/page.tsx` App Router entrypoints, plus React runtime/type declarations for the web package.
- Added package-local `vitest.e2e.config.ts` files for API and worker with no-test-safe behavior.
- Made web and shared-package e2e scripts safe foundation commands; shared Vitest commands explicitly use the root config.
- Fixed root Vitest setup resolution for package-local execution.
- Updated `pnpm-lock.yaml`.

### Tests run/results

- `pnpm exec vitest run packages/testing/src/workspace.test.ts` — PASS (2 tests).
- `pnpm typecheck` — PASS (9 packages).
- `pnpm lint` — PASS (9 packages).
- `pnpm build` — PASS (9 packages; Next web build generated `/`).
- `pnpm test:e2e` — PASS (9 packages; no real e2e tests added).

### Design decisions and concerns

- The shared ESLint config intentionally provides parsing and ignores without product-specific rules; later tasks can add rules without restoring the deleted prototype config.
- The web page is deliberately a static foundation placeholder, leaving product UI to later tasks.
- API/worker e2e configs are intentionally no-test-safe placeholders; Vitest emits non-failing ESM-loader warnings until those packages adopt a finalized module/config convention.

## Review fix report — final Task 1 test orchestration

### Change

- Added `--passWithNoTests` to the ordinary `test` script in every app and package manifest. Existing tests still run normally; only empty suites now exit successfully during root Turbo orchestration.

### Verification

- `pnpm test` — PASS (14 Turbo tasks; `@orbit/testing` workspace test passed with 2 tests).
- `pnpm typecheck` — PASS (9 packages).
- `pnpm lint` — PASS (9 packages).
- `pnpm build` — PASS (9 packages; web App Router build succeeded).

### Concern

- Turbo reports non-failing warnings for TypeScript packages whose foundation `build` scripts emit no output; this is pre-existing foundation behavior and does not affect test, typecheck, lint, or build exit status.

## Admin user management — persistence and contracts

### Delivered

- Added strict Zod contracts for safe user summaries, admin-created users, supported user updates, and invitation acceptance.
- Added case-insensitive create-user email normalization, IANA timezone validation, exact role validation, minimum invitation-password length, and rejection of unknown fields.
- Added the `AuthTokenPurpose` Prisma enum with `PASSWORD_RESET` and `USER_INVITATION`, renamed the persisted token discriminator from `type` to `purpose`, and indexed purpose with expiry.
- Added a forward-only migration that preserves supported legacy `password_reset`/`PASSWORD_RESET` values while adding `USER_INVITATION` persistence.
- Added contract tests and guarded disposable-database persistence tests for nullable password hashes, invitation/user linkage, token-hash uniqueness, expiry, and consumption.
- Audited all `authToken.type` usages. Updated the post-migration Prisma persistence test to `purpose: "PASSWORD_RESET"`; retained the raw SQL `"type" = 'password_reset'` fixture because it intentionally represents the pre-migration schema.
- Added the approved admin user-management implementation plan under `docs/superpowers/plans`.

### Verification

- TDD/current-state RED: `@orbit/database` typecheck failed on the remaining `authToken.type` write because the generated contract exposes `purpose`.
- Focused contracts: `5 passed` in one test file.
- Prisma Client generation: passed with Prisma 6.19.3.
- Prisma schema validation: passed with an explicit disposable-database URL supplied for configuration parsing; this command did not mutate the database.
- TypeScript: all nine workspace projects passed direct `tsc --noEmit` checks.
- ESLint: repository-wide direct ESLint run passed.
- `git diff --check`: passed before this report append.

### Exact database limitation

The guarded persistence suite was attempted only with `DATABASE_URL` targeting `orbit_task3_test`. It failed before schema cleanup with Prisma reporting that the user was denied database access. The Compose PostgreSQL container was healthy and showed `orbit` owns both the disposable database and its `public` schema, but its logs showed no corresponding host-runner connection; the published host port therefore did not provide a usable path to that container from this runner. No broad/application database was reset, migrated, seeded, or otherwise modified.

Accordingly, this report does not claim that `packages/database/src/user-management.test.ts`, `packages/database/src/client.test.ts`, `prisma migrate deploy`, or migration drift validation passed. Those checks should be rerun from a Node environment attached to the `orbit-foundation-rebuild_default` Compose network with `DATABASE_URL=postgresql://orbit:orbit@postgres:5432/orbit_task3_test`.

## Admin user management review fix — required auth-token user

### Change

- Made `AuthToken.userId` and the `AuthToken.user` Prisma relation required to match the invitation-token invariant that every auth token belongs to an account.
- Added forward-only migration `20260902040000_require_auth_token_user` that deletes existing orphan auth tokens, then sets `auth_tokens.user_id` `NOT NULL`.
- Added persistence coverage that rejects orphan post-migration auth-token inserts.
- Updated the legacy migration regression so its `password_reset` fixture is inserted after the Task 3 security correction has deleted unsafe pre-correction tokens, but before the user-management migration converts `type` to `purpose`. The regression now asserts that the linked legacy token survives as `PASSWORD_RESET` and the orphan token is removed by the `NOT NULL` migration.
- Reduced `schema.prisma` churn back to the semantic nullable-to-required change only.

### Verification

- `node_modules/.bin/vitest run packages/contracts/src/users.test.ts` — PASS, 1 file and 6/6 tests.
- `env DATABASE_URL=postgresql://orbit:orbit@localhost:5432/orbit_task3_test packages/database/node_modules/.bin/prisma validate --schema packages/database/prisma/schema.prisma` — PASS.
- `env DATABASE_URL=postgresql://orbit:orbit@localhost:5432/orbit_task3_test packages/database/node_modules/.bin/prisma generate --schema packages/database/prisma/schema.prisma` — PASS, Prisma Client 6.19.3 generated.
- Disposable Docker SQL migration regression against `orbit_task3_test` — PASS. Applied init, Task 3 foundation correction, Task 3 security correction, inserted linked and orphan legacy `password_reset` auth tokens, applied Task 8 outbox lease, user-management, and required-auth-token-user migrations. Assertions returned `auth_count=1`, `legacy=PASSWORD_RESET,10000000-0000-4000-8000-000000000001`, `null_user_count=0`, `user_id_nullable=NO`, and the expected active closer `10000000-0000-4000-8000-000000000003`.
- `docker run --rm --network orbit-foundation-rebuild_default ... packages/database/node_modules/.bin/prisma migrate deploy --schema packages/database/prisma/schema.prisma` — PASS against a freshly reset disposable `orbit_task3_test`; all six migrations applied successfully, including `20260902040000_require_auth_token_user`.
- `docker run --rm --network orbit-foundation-rebuild_default ... packages/database/node_modules/.bin/prisma migrate diff --from-url postgresql://orbit:orbit@postgres:5432/orbit_task3_test --to-schema-datamodel packages/database/prisma/schema.prisma --exit-code` — FAIL, exit 2, for existing schema drift around generated UUID/default timestamps and `users_created_by_user_id_idx`. The diff did not report `auth_tokens.user_id` nullability drift after the new migration.
- Direct TypeScript check for all nine workspace `tsconfig.json` files — PASS.
- `node_modules/.bin/eslint --config eslint.config.mjs .` — PASS.
- `git diff --check` — PASS after this report append.

### Final disposable-database rerun

- The existing Compose PostgreSQL host mapping on port `5432` still returned `User was denied access on the database (not available)` before either guarded suite could reset its schema. This path did not modify a database.
- A separate temporary `postgres:16-alpine` container was therefore started on `127.0.0.1:55432` with only `orbit_task3_test`. `node_modules/.bin/vitest run packages/database/src/client.test.ts packages/database/src/user-management.test.ts --no-file-parallelism` then passed 2 files and 14/14 tests, including legacy `password_reset` conversion, orphan-token cleanup, and rejection of new null-user tokens.
- Against that same disposable database, `prisma migrate status` reported all six migrations applied and the schema up to date, a repeated `prisma migrate deploy` reported no pending migrations, and PostgreSQL reported `auth_tokens.user_id` as `is_nullable = NO`.
- Migrations-directory drift mode could not run because the repository has no `migration_lock.toml`. The fallback migrated-database-to-datamodel comparison returned the pre-existing UUID/default-timestamp and `users_created_by_user_id_idx` drift already described above; it reported no `auth_tokens.user_id` nullability drift.
- The temporary container was removed after verification. No application or live database was reset, migrated, seeded, or otherwise modified.
