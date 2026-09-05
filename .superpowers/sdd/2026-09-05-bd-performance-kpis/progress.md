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

- Task 1: complete — `af8c4fc`, `9175b77`, and `2232b0a`; effective-date invariants, persisted defaults, concurrency versions, response contracts, and null audit metadata are covered by contract/database checks. Scoped fix review found no remaining Task 1 issues.

### Task 2 — complete

- Commits: `3bf8baa`, pending review-fix commit
- Verification: focused lead/contract/API tests, disposable PostgreSQL persistence test, affected contracts/backend/database/API typechecks, Prisma validation/migration status, and diff checks passed.
- Ruling: generic ID-based creation remains available to Admin-only callers (including Admin imports); BD application creation is strictly routed through intake so complete fields, duplicate classification, server-owned dates, and qualified-credit state cannot be bypassed.
- Ruling: confirmed duplicates must be retained for traceability, so the legacy active canonical-URL uniqueness index is removed and duplicate classification/qualified credit become first-class lead fields.

### Task 3 — complete

- Pure business-calendar, maturity, scoring, eligibility, and leaderboard modules added without HTTP or database dependencies.
- Verification: 25 focused performance tests, backend TypeScript check, and diff check passed.
- Note: this layer evaluates schedules in UTC; Task 4 must normalize persisted rule/calendar times before using it.
