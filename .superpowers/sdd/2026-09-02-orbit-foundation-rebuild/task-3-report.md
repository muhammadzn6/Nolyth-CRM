# Task 3 Report: PostgreSQL Prisma Foundation

## Delivered

- Added the PostgreSQL Prisma schema, initial SQL migration, and seed script for users, authentication records, candidates, profiles, assignments, job leads, audit records, and outbox events.
- Added the `database` Prisma singleton and `withTransaction` helper exported by `@orbit/database`.
- Used UUID primary keys, `timestamptz`, PostgreSQL `citext` for case-insensitive emails, decimal compensation, foreign keys, and foundation indexes.
- Added persistence coverage for UUID generation, case-insensitive user-email uniqueness, one-BD-per-profile assignment, lead ownership fields, and all-or-nothing business/audit/outbox writes.
- Replaced the Task 1 migration/seed placeholder scripts with Prisma commands and added Prisma dependencies.

## Verification

- Initial TDD run: `npx --yes pnpm@10.15.1 --filter @orbit/database test` — expected RED; 5 tests failed because the client/delegates did not exist.
- `npx --yes pnpm@10.15.1 --filter @orbit/database prisma generate` — passed.
- `npx --yes pnpm@10.15.1 --filter @orbit/database typecheck` — passed.
- `npx --yes pnpm@10.15.1 --filter @orbit/database lint` — passed.
- `git diff --check` — passed.
- The migration was deployed through an ephemeral Node container on the Compose network. PostgreSQL confirms migration `00000000000000_init` in `_prisma_migrations` and all 13 required application tables.

## Remaining Verification Concern

The PostgreSQL persistence test container was interrupted before Vitest emitted a result, so this report does not claim that the five live persistence tests passed. The host-side runner is unsuitable for this containerized database in this environment: it either cannot reach the Docker-published localhost port from the sandbox or reaches a different PostgreSQL listener outside it. The appropriate follow-up is to rerun `packages/database/src/client.test.ts` from a Node environment on the `orbit-foundation-rebuild_default` Compose network using `DATABASE_URL=postgresql://orbit:orbit@postgres:5432/orbit`.

The seed script is implemented and typechecked but was not separately executed after the migration because the verification run was interrupted.

## Fix Round: Target Schema Corrections

### Delivered

- Corrected the candidate/profile relationship to one candidate with many profiles.
- Replaced singular assignment assumptions with historical BD, closer-eligibility, and lead-closer-assignment records. Active-pair uniqueness is enforced by PostgreSQL partial unique indexes.
- Added identity foundation fields for password hashes, timezone, lifecycle timestamps, user provenance, and hashed session/auth-token values.
- Added lead source/canonical URL/hash, responsible closer, archive, closure, placement, and start-date fields; active canonical URLs are unique per profile.
- Expanded immutable activity context and outbox delivery state for later identity, contract, and worker tasks.
- Added an explicit `DATABASE_URL` test guard that only permits the disposable `orbit_task3_test` database before any cleanup executes.
- Added a forward-only correction migration rather than rewriting the migration already applied to the local development database.

### Verification

- TDD RED: the corrected suite failed 7/7 against the prior schema; Prisma reported `Unknown argument passwordHash`.
- Prisma generated successfully and `@orbit/database` typecheck and lint passed.
- `20260902000000_task_3_foundation_corrections` deployed to the local `orbit` database and disposable `orbit_task3_test` database.
- Live disposable-database persistence suite: `7 passed` in `267ms` using a temporary Node container attached to the Compose network with `DATABASE_URL=postgresql://orbit:orbit@postgres:5432/orbit_task3_test`.
- Seed executed against the local development database; verification returned `admin@orbit.local|UTC|ADMIN`.

## Fix Round: Authentication and Migration Safety

### Delivered

- Legacy plaintext session and auth-token rows are deleted during the correction migration; the plaintext columns are dropped and replaced with hash-only columns and unique indexes.
- Migrated users retain a null `password_hash`, which is an explicit reset/provisioning-required state that the future identity service must handle before password verification.
- Seeding now requires `ORBIT_SEED_ADMIN_PASSWORD`, hashes it with Argon2id, records `password_changed_at`, and rotates the seeded admin hash on subsequent seed runs. The example environment leaves the value empty rather than publishing a shared password.
- Published legacy outbox rows migrate to `PROCESSED` with `processed_at = published_at`; unpublished rows remain `PENDING`, and both retain deterministic ID-derived idempotency keys and zero attempts.
- Lead closer assignments retain history while a partial unique index permits only one active closer per lead. Profile BD and closer-eligibility records continue to enforce active profile/user-pair uniqueness, allowing the multiple BDs and eligible Closers required by the product design.
- The persistence suite now rebuilds only a URL explicitly targeting `orbit_task3_test`, loads legacy fixtures, deploys the correction migration, and verifies auth invalidation, reset-required users, outbox preservation, assignment uniqueness, outbox defaults, and seed/schema coherence.

### Verification

- TDD RED against `cec3964`: `3 failed, 7 passed`; failures reproduced retained legacy auth data, multiple active lead Closers, and seed execution without an operator-provided password.
- Disposable migration and persistence suite on the Compose network: `10 passed` in `1.89s`.
- Prisma generate: passed.
- Direct seed with an ephemeral disposable-test password: passed; the persistence suite independently verified the PHC string is Argon2id and validates against the supplied password.
- Prisma migration status for `orbit_task3_test`: `2 migrations found` and schema up to date.
- Full workspace typecheck: `9 successful, 9 total`.
- Full workspace lint: `9 successful, 9 total`.
- `git diff --check`: passed.

The existing `orbit` development database was not reset, cleaned, migrated, or seeded during this fix round. A read-only Prisma migration-status check reports its two existing migrations as up to date.

## Fix Round: Forward-Only Security Upgrade

### Delivered

- Restored `20260902000000_task_3_foundation_corrections/migration.sql` byte-for-byte to the version committed at `cec3964`, matching the migration already recorded by existing databases.
- Added `20260902010000_task_3_security_forward_corrections` as the sole forward safety migration.
- The new migration deletes legacy session and auth-token rows whose renamed columns may contain plaintext, makes `password_hash` nullable, and resets every non-Argon2id credential to the safe provisioning-required state while preserving Argon2id hashes.
- Published outbox rows are corrected to `PROCESSED`; `processed_at` preserves an existing value or falls back to `published_at`.
- Duplicate active lead-closer assignments are reconciled deterministically: the newest assignment remains active and older active rows are ended with `migration: superseded duplicate active closer` before the one-active-closer partial unique index is installed.
- The migration regression now explicitly constructs the initial schema, applies and records the authentic cec3964 correction, adds a post-cec duplicate assignment, and only then deploys the new forward migration.

### Verification

- Upgrade-path RED with the restored cec3964 migration and no forward fix: `8 failed, 2 passed`; the primary regression observed one retained session, while downstream tests confirmed `password_hash` was still `NOT NULL`.
- Upgrade-path GREEN after the forward migration: `10 passed` in `3.53s` against `orbit_task3_test`.
- Disposable `prisma migrate deploy`: passed with no pending migrations after the test-applied upgrade; migration status reports `3 migrations found` and schema up to date.
- Disposable Argon2id seed: passed with an ephemeral verification password.
- Prisma generate, `@orbit/database` typecheck, and `@orbit/database` lint: passed.
- Full workspace typecheck and lint: `9 successful, 9 total` each.
- Applied only `20260902010000_task_3_security_forward_corrections` to the existing `orbit` development database; Prisma reports all three migrations applied and the schema up to date. The database was not reset, cleaned, or reseeded.
- Post-upgrade read-only checks on `orbit`: zero sessions, zero auth tokens, zero non-Argon2id non-null password hashes, and zero published outbox rows missing processed state.
