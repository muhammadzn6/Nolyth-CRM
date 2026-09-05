# Task 3 report — pure BD performance scoring engine

## Status

Complete after final review fixes.

Commits: `da23dad fix: harden BD performance scoring invariants`; final Task 3 review-fix commit on the current branch

## Delivered

- Effective-dated business-calendar persistence with IANA timezone and local workday start/end defaults (`UTC`, 09:00–17:00), plus database constraints for workday windows and outcome-point ordering.
- Timezone- and DST-aware business-calendar helpers for working days, holidays, full/reduced leave, elapsed business hours, due dates, follow-up pauses, and Admin reassignment SLA state.
- Explicit follow-up SLA compliance (`MET`, `MISSED`, `PENDING`, `PAUSED`), breach state, and exact due timestamp so late completed work is distinguishable from on-time completion.
- Eligible workday capacity and prorated daily-target calculation for full and reduced approved leave.
- Calendar-day maturity helpers that preserve the original application cohort for late recruiter responses.
- Pure effective-attainment, validated highest-stage outcome, and balanced-score calculations with unavailable-component rebalancing and score coverage/status. Outcome points must be positive and non-decreasing.
- Eligibility evaluation at an explicit evaluation time so expired Admin provisional exceptions no longer suppress ranking.
- Deterministic, unique official leaderboard ranking with all stated tie-breakers and no numeric rank for null/non-calculable scores.
- Completed Admin reassignment SLA results expose `MET`/`MISSED` compliance and a breach flag, including exact-deadline and late-reassignment boundaries.
- Approved leave now persists an optional reduced local availability window. The contract rejects partial/invalid windows, the business-calendar engine rejects windows outside the active workday, and database-to-engine coverage proves a 09:00–13:00 leave window yields a 50% daily target.
- Local work-window resolution explicitly chooses the first occurrence of an ambiguous fall-back time and moves nonexistent spring-forward times to the first valid time after the gap.

## Verification

- `npx vitest run packages/backend/src/performance packages/contracts/src/performance.test.ts` — 46 tests passed.
- `DATABASE_URL=<disposable orbit_task3_test> npx vitest run packages/database/src/performance-rules.test.ts` — 6 tests passed.
- `npx tsc --noEmit -p packages/contracts/tsconfig.json` — passed.
- `npx tsc --noEmit -p packages/backend/tsconfig.json` — passed.
- `npx tsc --noEmit -p packages/database/tsconfig.json` — passed after regenerating the project-local Prisma client.
- `packages/database/node_modules/.bin/prisma validate --schema packages/database/prisma/schema.prisma` — passed.
- `git diff --check` — passed.

## Concerns

- `UTC` is the persisted default to preserve the previous behavior; Admin can now set an explicit IANA business-calendar timezone and workday window for future effective-dated rules.
- Existing unrelated calendar/dashboard changes remain uncommitted and untouched.
- The configured local `orbit` database still has pre-existing migration-history drift; the new migration was verified against disposable `orbit_task3_test`.
