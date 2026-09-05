# Task 4 report — performance service and review workflows

## Status

Complete. The final controller contract boundary pass is committed after the SLA/workflow correction pass.

### Final production scheduler, qualified scheduling KPI, and record-quality pass

- The existing worker runtime is now explicitly covered as the production overdue-SLA trigger: it evaluates once at worker startup and on each polling interval, while the worker-application wiring test verifies the real evaluator is connected. Read-time evaluation remains a safety net, not the only trigger.
- `INTERVIEWS_NEEDING_SCHEDULING` now counts only `qualifiedCredit: true` recruiter-response applications, exactly matching its drill-down cohort. Confirmed duplicates cannot inflate the KPI.
- Record Health now requires all approved facts: a standardized company mapping that matches the saved company, correctly detected platform/source, primary recruiter contact with a valid email/domain, usable required values, and no unresolved Admin correction requirement.
- Generic `lead.updated` activity is no longer treated as a correction. Correction Rate counts only the explicit `performance.record_corrected` audit event.
- Added the Admin-only `POST /performance/records/:leadId/audit` workflow with `PASSED`, `CORRECTION_REQUIRED`, and `CORRECTED` outcomes. A correction requires a prior audit failure and writes immutable activity/audit data. The strict shared response contract prevents private audit details from leaking into peer-safe views.

### Final controller contract boundary pass

- Every performance controller response is now parsed through its strict shared contract: Admin performance, BD performance, drill-downs, rule reads, rule previews and updates, duplicate-review queue and decisions, and follow-up reassignment.
- Strict nested parsing rejects unexpected service fields, preventing peer/private information from reaching the frontend if a service projection regresses.
- Added controller-level valid-response coverage for every endpoint, contract-breaking response coverage for every endpoint, and an incompatible drill-down status validation regression.
- Corrected stale Task 4 service-test expectations to assert the contract-shaped drill-down and ISO-date projections, plus the syntax/type issues that had prevented the required focused suite from executing.

### Latest correction pass

- Follow-up SLA schedules now load future approved leave intervals for both the original and reassigned BD; only leave active at response time pauses the original BD and starts Admin reassignment.
- Any outbound recruiter communication now completes the eligible open follow-up even when no contact is selected. Optional contact context remains in the communication audit record.
- The production worker now invokes the idempotent overdue-SLA evaluator at startup and on its polling interval. Admin read-time evaluation remains a safety net.
- Drill-down query validation now rejects a status that is incompatible with its metric before Prisma is called.
- Added server-side quality-rate calculation from saved leads, duplicate reviews, and auditable activity events: record health, audit pass, correction, confirmed duplicate, pending override, rejected override, and total duplicate rate. Admin/BD responses and the peer-safe existing quality fields consume these values.
- Began projecting performance drill-down, duplicate-review, and follow-up responses into dedicated shared response shapes.

### Deferred follow-up

- The new quality contracts require the existing dashboard/client task to consume the additional fields; this is intentionally deferred to the planned UI tasks.

## Delivered

### Final drill-down and review-response correction

- `RECRUITER_RESPONSES` drill-down now reads the same qualified, applied-date application cohort as the KPI and retains only records whose current highest outcome is above `NONE`, including interview-derived stages.
- `FOLLOW_UP_SLA` drill-down now uses the active follow-up owner and the same responded-at, eligible-status, completion/due predicates as the performance row. Original-owner history remains available through the explicit `REASSIGNMENTS` metric.
- Duplicate-review decisions now re-read and return the persisted post-update review inside the transaction, including the incremented version, reviewer, review timestamps, and resolved-credit timestamp.
- Added regressions for each correction, including a reassigned follow-up and persisted duplicate-review response fields.

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

- `npx vitest run apps/api/src/modules/performance/performance.controller.test.ts packages/backend/src/performance/performance.service.test.ts packages/backend/src/performance/score.test.ts packages/backend/src/performance/eligibility.test.ts packages/backend/src/performance/maturity.test.ts packages/backend/src/performance/business-hours.test.ts packages/backend/src/leads/collaboration.service.test.ts packages/backend/src/leads/application-intake.test.ts packages/contracts/src/performance.test.ts apps/worker/src/main.test.ts apps/worker/src/worker.module.test.ts` — 109 tests pass.
- `DATABASE_URL=<disposable orbit_task3_test URL> npx vitest run packages/database/src/performance-rules.test.ts` — 6 tests pass.
- Backend, API, contracts, and database TypeScript checks pass.
- Local Prisma schema validation passes.
- `git diff --check` passes.

## Concern

The local `orbit` database still has the pre-existing migration-history drift reported by Tasks 1–3. This correction adds an additive migration for duplicate-review overdue state, and schema validation is clean. Full dashboard/browser integration remains deliberately in later Tasks 5–8.

## Final Admin controls and quality aggregation correction

- Team quality is now calculated from summed raw numerators and denominators across saved applications, audits, and duplicate reviews. It no longer averages BD-level percentages, and unequal-volume regressions cover record health, audit pass, correction, confirmed duplicate, rejected override, and total duplicate rates.
- Added Admin-only list/create/update/delete workflows for individual BD target schedules, performance holidays, and approved leave. Target and leave periods are overlap-protected, all mutations use optimistic versions, leave supports persisted reduced availability, and each mutation writes an immutable activity audit record.
- Added a persisted `PerformanceLeaderboardException` lifecycle with an additive migration, mandatory reason/expiry, active-only list behavior, explicit revocation, optimistic versioning, and audit records. Active exceptions move the BD to Building Baseline with the `ADMIN_OVERRIDE_PROVISIONAL` warning and no numeric rank; expired or revoked exceptions do not affect eligibility.
- Added strict shared request/response contracts and controller routes for every new Admin operation.

### Final verification

- Focused API/backend/contracts/worker tests: 114 passed.
- Disposable PostgreSQL migration and persistence tests: 7 passed.
- TypeScript checks passed for worker, API, backend, contracts, and database.
- Prisma schema validation and `git diff --check` passed.

### Remaining environment note

The local `orbit` database still has the pre-existing migration-history drift. The disposable `orbit_task3_test` database applied the full migration sequence and passed the new persistence coverage.

## Final lifecycle correction

- Updating a started BD target now creates a replacement schedule at the next eligible working-day boundary. The previous schedule is closed in the same optimistic, transactional write; its history remains intact. Successive changes create successive versions without overlapping periods.
- Performance target and eligible-working-day accumulation now starts on the later of the reporting-period start and the BD account/start date. New BDs no longer inherit targets or leaderboard working days from before they existed.
- Started/past holidays and approved leave can no longer be updated or deleted. Holiday checks use the active business-calendar timezone, preventing timezone-boundary edits from changing historical scores or SLA calculations.

### Final lifecycle verification

- Focused API/backend/contracts/worker tests: **120 passed**.
- Disposable PostgreSQL persistence tests: **7 passed**.
- TypeScript checks passed for backend, API, contracts, database, and worker.
- Prisma schema validation and `git diff --check` passed.

## Final KPI projection correction

- Added numeric `scoreCoveragePercent` to every KPI projection while retaining the categorical score-coverage status.
- Building Baseline rows now calculate an estimated eligibility date from the later of the tenth eligible working day and the initial maturity date.
- Outcome scoring and recruiter-response KPI/drill-down logic retain the highest historical stage from lead transitions, interview milestones, and offers after a lead is closed.
- Creating a first individual BD target may omit `effectiveFrom`; Orbit resolves it to the next eligible working day using the Admin business calendar and holidays.
- Scheduling drill-downs now treat only interviews within the reporting window as scheduled, matching `INTERVIEWS_NEEDING_SCHEDULING` KPI calculations.
- BD performance responses now include a self-only eligibility projection: eligibility, Building Baseline progress, reason, estimate, and low-sample warnings.
- Added `GET /performance/me/drilldown`; it always forces the requesting BD ID server-side and cannot disclose another BD's records.

### Final KPI projection verification

- Task 4 focused suite: **125 passed**.
- Disposable PostgreSQL persistence suite: **7 passed**.
- TypeScript checks passed for contracts, backend, API, and database.
- Prisma validation and `git diff --check` passed.

## Final target ownership and leaderboard-exclusion correction

- Target creation now owns `effectiveFrom` exclusively on the server. The create contract rejects client-supplied values and the service always uses the next eligible working-day boundary; target updates retain their existing versioned effective-date behavior.
- Added a PostgreSQL GiST exclusion constraint over each BD's approved-leave `tstzrange`, while retaining the service-level overlap check for a clear validation response. A concurrent persistence regression proves that only one overlapping leave can be saved.
- Added a PostgreSQL GiST exclusion constraint over each BD's active leaderboard-exception range. Revoked exceptions are intentionally excluded from the constraint so a later exception may replace a revoked one. A concurrent persistence regression proves that only one overlapping active exception can be saved.
- `EXCLUDE` and `PROVISIONAL` are now distinct projections. Provisional BDs remain in Building Baseline with no numeric rank and an `ADMIN_OVERRIDE_PROVISIONAL` badge. Excluded BDs are omitted from both the official leaderboard and Building Baseline, returned in the explicit `excluded` collection with `ADMIN_EXCLUDED`, `eligibilitySection: EXCLUDED`, and the persisted exception type for display.
- Extended strict Admin/BD response contracts with the explicit eligibility section and excluded collection, preventing the distinction from being lost at the API boundary.

### Final target/exclusion verification

- Focused API, service, scoring, eligibility, maturity, business-calendar, leaderboard, intake, contract, and worker suites passed: **127 tests**.
- Direct TypeScript checks passed for contracts, backend, API, worker, and database packages.
- Prisma schema validation passed.
- The disposable `orbit_task3_test` database applied the new migration and passed **9** persistence tests, including both concurrent-overlap regressions.
- `git diff --check` passed.
