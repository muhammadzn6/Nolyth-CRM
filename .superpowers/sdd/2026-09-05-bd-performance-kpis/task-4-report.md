# Task 4 report — performance service and review workflows

## Status

Completed and corrected after review.

## Delivered

### Final correction

- Historical performance now segments attainment and score weights by the effective rule version on each eligible workday and application date; later settings do not recalculate earlier periods.
- The BD initial maturity window is derived independently from the persisted BD creation date (with the reporting-period start as a compatibility fallback). Once elapsed, an empty matured qualified cohort scores `0%` and retains the `LOW_OUTCOME_SAMPLE` warning.
- Admin performance and KPI drill-down reads now invoke the idempotent overdue-SLA evaluator, providing a production read-time trigger for reassignment and duplicate-review alerts.
- `INTERVIEWS_NEEDING_SCHEDULING` and `OUTCOMES` drill-downs now use the same qualified-credit, reporting-period, maturity, and zero-point cohort predicates as their KPIs.
- Current BD daily targets now resolve the latest schedule active at the current instant, including `effectiveTo`, with the effective rule default as fallback.
- Added focused regressions for all five corrections.

- Server-authoritative Admin team and BD personal performance reads using the approved scoring, maturity, business-calendar, and leaderboard engines.
- Role-safe API routes for Admin performance, BD performance, drill-down, rules preview/update, duplicate-review queue/decision, and follow-up reassignment.
- Transactional duplicate-review resolution that preserves approved provisional credit and removes rejected duplicate credit.
- Recruiter-response follow-up creation, immediate leave pause, Admin reassignment SLA, reassignment timestamping, activity events, and in-app notifications.
- Strict request contracts for read windows, rule mutations, and reassignment input.
- Effective-dated rule mutations now preserve the old version, create a future version, and resolve rules by calculation date. Rule preview is explicitly a **Target and Configuration** projection: it calculates each BD's future working-day target delta and returns every active/proposed rule value, while declaring that exact future qualified applications, follow-up completion, recruiter outcomes, and balanced scores are unavailable until those future facts exist.
- Outbound recruiter communications transactionally complete eligible open follow-ups with completion timestamp and source audit metadata.
- Recruiter-response lead transition, status audit, and follow-up creation run in one idempotent transaction.
- Idempotent SLA evaluation persists Admin reassignment breaches and duplicate-review `overdueAt` timestamps, writes audit events, and appends deduplicated in-app and email outbox events. Duplicate review deadlines use the approved three-business-day calendar calculation.
- Admin drill-downs query records for the specific requested KPI, rather than returning generic lead lists.
- BD peer API responses expose only the approved summary projection.
- Outcome scoring derives the persisted Screening milestone from recruiter/pre-screen interview rounds.

## Verification

- `npx vitest run packages/backend/src/performance/performance.service.test.ts packages/backend/src/performance/score.test.ts packages/backend/src/performance/eligibility.test.ts packages/backend/src/performance/maturity.test.ts packages/backend/src/performance/business-hours.test.ts packages/backend/src/leads/collaboration.service.test.ts packages/backend/src/leads/application-intake.test.ts apps/api/src/modules/performance/performance.controller.test.ts packages/contracts/src/performance.test.ts` — 86 tests pass.
- Backend, API, and contracts TypeScript checks pass.
- Local Prisma schema validation passes, including migration `20260905050000_duplicate_review_overdue`.
- `git diff --check` passes.

## Concern

The local `orbit` database still has the pre-existing migration-history drift reported by Tasks 1–3. This correction adds an additive migration for duplicate-review overdue state, and schema validation is clean. Full dashboard/browser integration remains deliberately in later Tasks 5–8.
