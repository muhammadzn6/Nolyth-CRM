# Task 2 Report: Normalized intake and duplicate classification

## Status

Complete, including the Task 2 review-fix round.

## Files

- `packages/contracts/src/leads.ts`
  - Added the strict BD application-intake contract, optional duplicate override reason, and typed intake result/duplicate state contracts.
- `packages/contracts/src/leads.test.ts`
  - Added intake validation coverage, including server-owned applied date and required recruiter fields.
- `packages/backend/src/leads/leads.service.ts`
  - Added URL normalization, duplicate classification with the default/configurable lookback, structured intake results, normalized storage, recruiter contact reuse, duplicate audit events, and pending likely-duplicate reviews.
- `packages/backend/src/leads/application-intake.test.ts`
  - Added focused normalization, classification, boundary, validation, applied-date, confirmed-duplicate, and likely-override tests.
- `apps/api/src/modules/leads/leads.controller.ts`
  - Updated intake notifications for the structured intake response.
- `apps/web/lib/api-client.ts`
  - Parses the structured intake response and retains error details for duplicate warnings.
- `apps/web/components/leads/lead-capture-form.tsx`
  - Removes the client-side applied date/owner fields and presents the mandatory override reason only after a likely-duplicate warning.
- `packages/backend/src/leads/leads.service.ts`
  - Reserves generic ID-based lead creation for Admin callers, so BD application creation cannot bypass strict intake validation or duplicate classification.
  - Resolves the effective Admin duplicate-lookback rule inside the intake transaction, persists duplicate classification and qualified-credit state on each lead, and writes company/source/contact/review/audit records atomically.
  - Treats duplicate lookback as a calendar-date boundary rather than a time-of-day boundary.
- `packages/database/prisma/schema.prisma`
  - Adds durable `duplicateClassification` and `qualifiedCredit` fields to job leads.
- `packages/database/prisma/migrations/20260905020000_application_duplicate_credit/migration.sql`
  - Expands the duplicate classification enum, adds durable credit state, and replaces the old active-canonical-URL unique index so confirmed duplicates can be retained for traceability.
- `packages/backend/src/leads/application-intake.test.ts`
  - Adds configured-rule, exact-boundary, durable-state, and rollback-path coverage.
- `packages/backend/src/leads/leads.service.test.ts`
  - Adds the BD generic-create bypass regression test.
- `packages/database/src/leads-persistence.test.ts`
  - Adds PostgreSQL persistence coverage for confirmed duplicate credit state.

## Verification

- `./node_modules/.bin/vitest run packages/backend/src/leads packages/contracts/src/leads.test.ts apps/web/components/dashboard/bd-application-entry.test.tsx apps/web/lib/api-client.test.ts` — 10 files, 76 tests passed.
- `./node_modules/.bin/tsc --project packages/contracts/tsconfig.json --noEmit` — passed.
- `./node_modules/.bin/tsc --project packages/backend/tsconfig.json --noEmit` — passed.
- `./node_modules/.bin/tsc --project apps/api/tsconfig.json --noEmit` — passed.
- `./node_modules/.bin/tsc --project apps/web/tsconfig.json --noEmit` — passed.
- `git diff --check` — passed.
- `./node_modules/.bin/vitest run packages/backend/src/leads packages/contracts/src/leads.test.ts apps/api/src/modules/leads --exclude .worktrees/**` — 4 files, 27 tests passed.
- `DATABASE_URL=<disposable orbit_task3_test> ./node_modules/.bin/vitest run src/leads-persistence.test.ts` from `packages/database` — 2 PostgreSQL persistence tests passed.
- Backend, database, contracts, and API TypeScript checks — passed.
- Prisma generate, validation, and disposable-database migration status — passed.

## Concerns

- The configured local `orbit` database still has pre-existing migration-history drift noted in Task 1. The new migration was verified against the disposable `orbit_task3_test` database, which is up to date.
- The application intake client update is a necessary interface-consumer change outside the brief's listed files; it ensures structured duplicate warnings reach the form instead of being flattened into a generic error.
