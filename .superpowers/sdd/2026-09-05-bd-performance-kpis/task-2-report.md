# Task 2 Report: Normalized intake and duplicate classification

## Status

Complete.

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

## Verification

- `./node_modules/.bin/vitest run packages/backend/src/leads packages/contracts/src/leads.test.ts apps/web/components/dashboard/bd-application-entry.test.tsx apps/web/lib/api-client.test.ts` — 10 files, 76 tests passed.
- `./node_modules/.bin/tsc --project packages/contracts/tsconfig.json --noEmit` — passed.
- `./node_modules/.bin/tsc --project packages/backend/tsconfig.json --noEmit` — passed.
- `./node_modules/.bin/tsc --project apps/api/tsconfig.json --noEmit` — passed.
- `./node_modules/.bin/tsc --project apps/web/tsconfig.json --noEmit` — passed.
- `git diff --check` — passed.

## Concerns

- Confirmed duplicate state is persisted in the immutable lead activity audit event because Task 1 intentionally left existing lead data unchanged. Likely-duplicate override state is persisted in `duplicate_reviews` and is ready for Task 4 review/recalculation workflows.
- The application intake client update is a necessary interface-consumer change outside the brief's listed files; it ensures structured duplicate warnings reach the form instead of being flattened into a generic error.
