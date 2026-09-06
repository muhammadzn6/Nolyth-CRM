# SDD ledger — plan: docs/superpowers/plans/2026-09-05-bd-performance-kpis.md

## Pre-flight scan

| Scope | Check | Result / ruling |
|---|---|---|
| Task 1 → Task 2 | Shared `packages/contracts/src/leads.ts`; Task 1 adds intake contract, Task 2 extends intake/duplicate behavior | Compatible. Task 2 must preserve existing generic `createLeadSchema` callers. |
| Task 1 → Task 4 | Task 1 creates rule/review persistence and types; Task 4 consumes effective-dated rules and review fields | Compatible. Task 4 must use the rule version active at event/calculation time. |
| Task 2 → Task 4 | Task 2 produces normalized duplicate state and provisional credit; Task 4 resolves/recalculates it | Compatible. Review decisions must be idempotent and audited. |
| Task 3 → Task 4 | Task 3 produces pure business-hours, maturity, score, eligibility, and ranking functions; Task 4 supplies persisted inputs | Compatible. No scoring logic belongs in controllers or React. |
| Task 4 → Task 5 | Task 4 produces typed Admin rule/review/KPI APIs; Task 5 consumes them | Compatible. Frontend must parse all responses with shared schemas. |
| Task 4 → Task 6 | Task 4 produces Admin performance response and drill-down permissions; Task 6 renders them | Compatible. Admin-only detail links must be server-authorized. |
| Task 4 → Task 7 | Task 4 produces BD response and peer-safe fields; Task 7 renders them | Compatible. Peer rows cannot include application/recruiter/audit detail. |
| Task 6 → Task 8 | Task 6 produces Admin routes and interactive controls; Task 8 covers them in browser | Compatible. Seed data must include eligible, baseline, pending-review, and overdue states. |
| Task 7 → Task 8 | Task 7 produces BD route and role-scoped actions; Task 8 covers them in browser | Compatible. E2E must verify peer privacy and personal drill-down. |
| Task 1 self-check | Contract and Prisma additions have migration/tests in the same task | Consistent. |
| Task 2 self-check | Intake endpoint, normalization, duplicate state, and focused tests are co-located | Consistent. |
| Task 3 self-check | Pure functions have exact signatures and unit tests before implementation | Consistent. |
| Task 4 self-check | Service, API module, notifications, audit, and service tests share interfaces | Consistent. |
| Task 5 self-check | Typed client, settings route, preview, and UI tests share rule interfaces | Consistent. |
| Task 6 self-check | Admin components consume Admin response and test drill-down/privacy boundaries | Consistent. |
| Task 7 self-check | BD components consume BD response and test peer-safe rendering | Consistent. |
| Task 8 self-check | E2E files cover all approved workflows and local ports | Consistent. |

## Rulings

- Ruling: preserve the existing generic lead-create contract and add intake-specific behavior around it — the current API has established ID-based callers and imports; changing that contract would broaden migration risk.
- Ruling: authoritative score calculations stay server-side — the specification requires auditability and role-safe drill-down, and client-calculated ranking could leak or diverge.

## Task progress

### Task 1 — complete

- Commits: `af8c4fc`, `9175b77`, `2232b0a`
- Final review: approved; no remaining findings.
- Verification: focused contract tests, disposable PostgreSQL invariant tests, contracts/database typechecks, Prisma validation, and diff checks passed.
- Note: configured local `orbit` database has pre-existing migration-history drift; disposable migration verification passed.

### Task 2 — complete

- Commits: `3bf8baa`, `29e52df`
- Final review: approved; no remaining findings.
- Verification: focused intake/duplicate tests, PostgreSQL persistence tests, affected typechecks, Prisma validation, and diff checks passed.
- Note: configured local `orbit` database has pre-existing migration-history drift; disposable migration verification passed.

### Task 3 — complete

- Commits: `fed89cf`, `da23dad`, `6777a90`, `d64e564`
- Final review: approved; no remaining findings.
- Verification: 49 performance/contract tests, 6 disposable PostgreSQL persistence tests, affected typechecks, Prisma validation, and diff checks passed.
- Note: configured local `orbit` database has pre-existing migration-history drift; disposable migration verification passed.

- Task 1: complete — `af8c4fc`, `9175b77`, and `2232b0a`; effective-date invariants, persisted defaults, concurrency versions, response contracts, and null audit metadata are covered by contract/database checks. Scoped fix review found no remaining Task 1 issues.

### Task 2 — complete

- Commits: `3bf8baa`, pending review-fix commit
- Verification: focused lead/contract/API tests, disposable PostgreSQL persistence test, affected contracts/backend/database/API typechecks, Prisma validation/migration status, and diff checks passed.
- Ruling: generic ID-based creation remains available to Admin-only callers (including Admin imports); BD application creation is strictly routed through intake so complete fields, duplicate classification, server-owned dates, and qualified-credit state cannot be bypassed.
- Ruling: confirmed duplicates must be retained for traceability, so the legacy active canonical-URL uniqueness index is removed and duplicate classification/qualified credit become first-class lead fields.

### Task 3 — complete

- Commits: `fed89cf`, `da23dad`, final Task 3 review-fix commit on the current branch
- Review-fix scope: persisted IANA business calendar and local window, DST-aware calculations, explicit late-completion compliance, safe outcome-point invariants, leave-prorated capacity, expiry-aware eligibility, and null-score rank protection.
- Verification: 41 performance/contract tests, 5 disposable PostgreSQL persistence tests, contracts/backend/database typechecks, Prisma validation, and diff check passed.
- Ruling: the new persisted default is `UTC`, 09:00–17:00 to preserve the previous UTC calculation behavior while making the calendar explicit and configurable. Cost if wrong: new deployments keep UTC due dates until Admin configures the operational timezone.
- Ruling: a persisted reduced leave window is constrained to a valid local-hour pair in contracts/database, then constrained to the effective rule's workday by the business-calendar engine. This keeps historical persistence rule-agnostic while ensuring Task 4 cannot use capacity outside the active calendar.

### Task 4 — complete

- Delivered role-safe Admin/BD performance reads, rules/review/reassignment APIs, authoritative pure-engine calculations, activity events, in-app notifications, and response-to-follow-up integration.
- Final correction: rule-versioned attainment/weights, independent initial-maturity eligibility, Admin read-time SLA evaluation, KPI-exact drill-downs, and latest-active target resolution are covered by regression tests.
- Final drill-down correction: recruiter-response and follow-up-SLA drilldowns now use the exact KPI cohorts; duplicate-review decisions return the persisted post-update record. Reassignment history remains a separate explicit metric.
- Verification: 88 focused service/controller/contract/performance tests plus 6 disposable PostgreSQL invariant tests, backend/API/contracts/database typechecks, local Prisma validation, and diff check passed.
- Note: local `orbit` migration-history drift is pre-existing; Task 4 adds no migration.

### Task 4 — final control-invariant correction

- Final commit records server-owned target creation, GiST exclusion constraints for BD leave and active leaderboard-exception intervals, and distinct `EXCLUDE` and `PROVISIONAL` leaderboard projections.
- Ruling: revoked leaderboard exceptions do not participate in the database interval constraint, because revocation ends their operational effect and a later exception must be permitted for the same period. Cost if wrong: an Admin would have to wait for the prior exception period to end before recording a replacement.

### Task 4 — final SLA correction and approval

- Final commit: `aff0deb`; reassigned owners use rules effective at handoff time, and late Admin reassignment durably records the overdue transition, audit event, and idempotent notifications before reopening the follow-up.
- Final review: approved in `task-4-review-report-final12.md`; no Critical, Important, or Minor findings.
- Verification: 130 focused tests, 9 disposable PostgreSQL persistence tests, five TypeScript checks, Prisma validation, and diff checks passed.

### Task 5 — complete

- Commits: `4988856`, `1aff133`, `8ab883d`, `0930353`
- Delivered typed performance API helpers, Admin performance rules/review UI, future holiday/leave controls, effective-date history/provenance, and field-level validation.
- Final review: approved in `task-5-review-report-final3.md`; no remaining findings.
- Verification: 67 focused tests, web/backend/API typechecks, Prisma validation, and diff checks passed.

### Task 6 — complete

- Commits: `e06f69a`, `0930353`
- Delivered Admin BD performance dashboard, KPI drill-downs, leaderboard, Building Baseline, quality guardrails, resilient reassignment queue, and Admin-only queue API.
- Final review: approved in `task-6-review-report-final.md`; no remaining findings.
- Verification: 90 web, 112 API, and 177 backend tests, all TypeScript checks, web lint, Prisma validation, and diff checks passed.

### Task 7 — complete

- Commits: `ab04559`, `ed3aca7`, `d9b52d8`, `c611075`, `8a60e77`, `21ec4df`
- Delivered BD operational dashboard, server-authoritative high-volume work-queue totals, personal score/coverage, peer-safe ranking, selected-interview quick actions, degraded performance states, and calendar date navigation.
- Final review: approved after the selected-date regression correction; isolated suite passed with no remaining findings.
- Verification: 102 web tests, web typecheck, web lint, and diff checks passed in the isolated committed checkout. Existing unrelated uncommitted calendar/visual changes remain separate.

### Task 6 — in progress

- Base commit: `aff0deb`.
- Ruling: Task 5's typed web-client performance reader has not been implemented, but Task 6 must remain limited to its listed files. The allowed server page will therefore make the smallest contract-validated request to the existing Admin performance endpoints and pass their server-owned values into Task 6 components. Cost if wrong: the helper is temporarily route-local until Task 5 can consolidate typed performance reads into the shared client.
- Blocker: Task 4 exposes no Admin-readable queue for `NEEDS_REASSIGNMENT` or `ADMIN_REASSIGNMENT_OVERDUE` follow-ups. Its `REASSIGNMENTS` drill-down only returns persisted handoff history after `reassignedAt`, which cannot truthfully power the Task 6 open reassignment queue. A minimal authenticated queue read is required before this task can meet its acceptance criteria without inventing client data.

### Task 5 — in progress

- Base: `aff0deb`; implementing typed performance API helpers and the Admin Performance Rules/duplicate-review UI from `task-5-brief.md`.

### Task 7 — in progress

- Base commit: `0930353`.
- Ruling: `BdPerformanceResponse` exposes the effective current target and next effective date, but no historical target-series or next-target value. The BD surface will render only those server-owned values and label the current target as the effective target context. Cost if wrong: a later contract extension can add a historical target timeline without changing peer privacy.
