# Task 6 report — Admin BD performance dashboard

## Delivered

- Added the Admin-only BD performance section to the existing dashboard. It renders the server-authoritative aggregate KPIs, official leaderboard, unranked Building Baseline rows, quality guardrails, exact-record drill-downs, and the Admin reassignment queue.
- Added day, rolling 7-day, and rolling 30-day KPI views. The server page validates the existing API envelopes before passing values to the UI; React does not calculate scores, ranks, quality rates, or SLA state.
- Added a small authorized backend contract addition: `GET /performance/admin/reassignment-queue`. It is Admin-authorized, evaluates overdue SLA state, and returns only `NEEDS_REASSIGNMENT` and `ADMIN_REASSIGNMENT_OVERDUE` records using `PerformanceFollowUpWithLead`.
- Added the missing inferred `PerformanceFollowUpWithLead` type export for the already-existing schema. This keeps the new queue and UI aligned with one contract.

## TDD evidence

### RED

- `npm run test -- --run components/performance/admin-bd-performance.test.tsx` failed before the six Task 6 components existed with `Cannot find module './bd-leaderboard'`.
- `npm run test -- --run components/performance/admin-performance-composition.test.tsx` failed before the dashboard composition existed with the missing `Team performance` surface.
- `npm run test -- --run components/performance/admin-performance-page.test.tsx` failed before the page read the Admin performance contract.
- `npm run test -- --run src/performance/performance.service.test.ts` failed before the endpoint service method existed with `service.getAdminReassignmentQueue is not a function`.
- `npm run test -- --run src/modules/performance/performance.controller.test.ts` failed before the controller route existed with `controller.reassignmentQueue is not a function`.

### GREEN

- Web Task 6 tests: 3 files, 9 tests passed.
- Backend performance service test: 1 file, 41 tests passed.
- API performance controller test: 1 file, 10 tests passed.

## Verification

- `npm run typecheck` passed in `apps/web`, `packages/contracts`, `packages/backend`, and `apps/api`.
- `npm run lint` passed in `apps/web`.
- Focused accessibility assertions verify labelled performance regions, period navigation, leaderboard, reassignment owner label, and score drill-down disclosure.
- `git diff --check` passed before staging.

## Scope and reviewer notes

- The Task 5 shared typed performance reader is not yet present. To honor the Task 6 file boundary, the allowed server page performs a minimal schema-validated read of the existing Admin endpoints. Task 5 can later consolidate this route-local read into the shared API client.
- Existing uncommitted calendar, layout, BD-entry, and dashboard edits were preserved and are outside the Task 6 commit.
- Review the Admin role boundary, direct record drill-down links, server-owned values, responsive composition, and queue endpoint status filter. The generated review package contains the exact change range.

## Review correction

- Quality guardrails now render Correction Rate and Confirmed Duplicate Rate separately alongside the existing five informational indicators.
- Scheduled interviews and interviews needing scheduling are separate KPI drill-downs, each linked to its exact server-authorized metric.
- The core Admin performance response, drill-down, and reassignment queue now have independent failure boundaries. A queue outage leaves the KPI, leaderboard, quality, baseline, and score surfaces intact and shows a recoverable queue-only message.
- The reassignment queue controller regression is now a standalone test and verifies both `NEEDS_REASSIGNMENT` and `ADMIN_REASSIGNMENT_OVERDUE` records.

### Review correction verification

- Focused web performance tests: 20 passed.
- Backend performance service tests: 43 passed.
- API performance controller tests: 12 passed.
