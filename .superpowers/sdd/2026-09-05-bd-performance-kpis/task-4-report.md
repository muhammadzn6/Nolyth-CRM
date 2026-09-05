# Task 4 report — performance service and review workflows

## Status

Completed and corrected after review.

## Delivered

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

- Focused performance, collaboration, intake, API-controller, and contracts tests pass.
- Backend, API, and contracts TypeScript checks pass.
- Local Prisma schema validation passes, including migration `20260905050000_duplicate_review_overdue`.
- `git diff --check` passes.

## Concern

The local `orbit` database still has the pre-existing migration-history drift reported by Tasks 1–3. This correction adds an additive migration for duplicate-review overdue state, and schema validation is clean. Full dashboard/browser integration remains deliberately in later Tasks 5–8.
