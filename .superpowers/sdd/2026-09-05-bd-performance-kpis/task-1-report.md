# Task 1 Report: Performance Rule and Review Data Model

## Scope delivered

- Added effective-dated performance rule sets with the approved defaults, working-day configuration, audit metadata, and versioning.
- Added per-BD effective-dated target schedules, holidays, and approved leave records.
- Added duplicate-review state for likely-duplicate overrides, including mandatory override reason, review decision, reviewer, audit metadata, and provisional-credit resolution.
- Added one follow-up record per lead for recruiter response, SLA lifecycle, reassignment, and Admin reassignment SLA timestamps.
- Added the required indexes for BD/date queries, review and reassignment SLA queues, target and rule effective-date lookup, and retained the existing profile plus normalized-JD identity index.
- Added and exported Zod schemas/types for performance rules, target schedules, duplicate reviews, KPI responses, leaderboard rows, and drill-down queries.
- Removed the inherited changes to the generic lead-create contract and `JobLead` data fields; Task 1 leaves existing lead data unchanged.

## Review findings resolved

- The inherited diff had introduced a second lead-create schema even though the approved brief explicitly preserves the generic lead-create contract. It was removed.
- The inherited diff stored duplicate classification on `JobLead`, contradicting the brief’s requirement not to change existing lead data. Duplicate-review state remains in the new review table; the required owner/date index remains because it is an index, not a lead data-field change.
- Running `prisma format` would rewrite unrelated alignment throughout the existing schema. Its output was reverted and only the Task 1 declarations were retained; Prisma validation confirms the resulting schema is valid.

## Follow-up review fixes

- Added PostgreSQL half-open-range exclusion constraints so global rule periods cannot overlap and target periods cannot overlap for the same BD; adjacent periods remain valid.
- Replaced child working-day rows with a database-persisted `working_days` array. It defaults atomically to Monday–Friday, preserves existing configured days during migration, and has database validation for non-empty, unique days in the Sunday–Saturday range.
- Added persisted `version` fields to rule, target-schedule, and duplicate-review response schemas, plus expected-version update inputs for rules, target schedules, and duplicate-review decisions.
- Aligned drill-down filtering with `ADMIN_REASSIGNMENT_OVERDUE` and narrowed `DuplicateClassification` to its only valid persisted value, `LIKELY`.
- Added negative contract coverage for invalid periods, score weights, duplicate working days, stale update versions, obsolete status values, and invalid classifications. Added PostgreSQL integration coverage for defaults, invalid persisted working days, global/BD overlap rejection, and adjacent periods.

## Verification

- `./node_modules/.bin/vitest run packages/contracts/src/performance.test.ts` — 1 file, 4 tests passed.
- `./node_modules/.bin/tsc --project packages/contracts/tsconfig.json --noEmit` — passed.
- `packages/database/node_modules/.bin/prisma validate --schema packages/database/prisma/schema.prisma` — passed.
- `packages/database/node_modules/.bin/prisma migrate status --schema packages/database/prisma/schema.prisma` — database schema is up to date (23 migrations).
- `git diff --check` — passed.

### Follow-up verification

- `./node_modules/.bin/vitest run packages/contracts/src/performance.test.ts` — 1 file, 7 tests passed.
- `DATABASE_URL=<disposable orbit_task3_test URL> ./node_modules/.bin/vitest run packages/database/src/performance-rules.test.ts` — 1 file, 4 tests passed after applying all 24 migrations to a reset disposable schema.
- `./node_modules/.bin/tsc --project packages/contracts/tsconfig.json --noEmit` — passed.
- `./node_modules/.bin/tsc --project packages/database/tsconfig.json --noEmit` — passed.
- `packages/database/node_modules/.bin/prisma validate --schema packages/database/prisma/schema.prisma` — passed.
- `packages/database/node_modules/.bin/prisma migrate status --schema packages/database/prisma/schema.prisma` — the configured local `orbit` database has the new migration pending and also contains pre-existing migration history drift (`20260724111622_auth_api_updated` exists in the database but not this checkout).

## Environment notes

- The declared `pnpm` package manager is unavailable in this environment, so verification used the installed local binaries.
- Prisma validation was not blocked by the known Prisma 7 datasource-configuration limitation: the available Prisma CLI is 6.19.3 (with `@prisma/client` 7.10.0) and validates the existing `url = env("DATABASE_URL")` datasource successfully. No Prisma 7 datasource workaround was needed.
