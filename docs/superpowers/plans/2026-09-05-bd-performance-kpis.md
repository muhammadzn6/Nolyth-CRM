# BD Performance KPIs and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved configurable BD performance model, duplicate workflow, SLA/outcome scoring, Admin controls, and Admin/BD dashboard surfaces.

**Architecture:** Keep scoring as a pure backend domain module that consumes normalized application, target, work-calendar, follow-up, outcome, and audit inputs. Persist versioned performance rules and review decisions, expose role-scoped read/write APIs, and compose existing dashboard components from typed KPI responses. The frontend will never calculate authoritative credit or ranking; it will display server-calculated values and drill into permitted records.

**Tech Stack:** NestJS, TypeScript, Zod shared contracts, Prisma/PostgreSQL, Next.js App Router, React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-05-bd-performance-kpis-design.md`

## Global Constraints

- Local frontend remains on port 3100 and backend remains on port 3101.
- Incomplete applications are rejected and are not persisted or counted.
- Confirmed duplicates are persisted for traceability but receive zero qualified credit.
- Likely-duplicate overrides require a reason and remain pending Admin review.
- Historical scores use the rules effective at calculation time and cannot change silently.
- Admin sees complete team and application-level detail; BD sees complete own detail and summary-only peer data.
- Official rankings default to rolling 30 days and use unique ranks.

## File Map

- `packages/database/prisma/schema.prisma`: versioned performance rules, target schedules, leave/holiday records, duplicate-review state, follow-up/SLA timestamps, and audit relations.
- `packages/contracts/src/performance.ts`: shared schemas and types for rules, KPI responses, score components, leaderboard rows, duplicate reviews, and drill-down queries.
- `packages/backend/src/performance/`: pure scoring, maturity, business-hours, eligibility, and leaderboard services with unit tests.
- `packages/backend/src/leads/leads.service.ts`: normalized intake, duplicate classification, provisional credit, and primary recruiter contact linkage.
- `apps/api/src/modules/performance/`: Admin rule management, KPI reads, duplicate-review decisions, reassignment alerts, and role-scoped routes.
- `apps/web/lib/api-client.ts`: typed helpers for performance rules, Admin KPIs, BD KPIs, reviews, and drill-down records.
- `apps/web/components/performance/`: reusable leaderboard, quality guardrails, score detail, baseline, rule editor, review queue, and trend components.
- `apps/web/components/dashboard/dashboard-overview.tsx`: Admin BD performance section and role-scoped Admin dashboard composition.
- `apps/web/components/dashboard/bd-dashboard.tsx`: BD target strip, work queue, interviews, personal score, peer summary, and target status.
- `apps/web/e2e/`: Playwright coverage for Admin and BD performance workflows.

### Task 1: Add versioned performance-rule and review data model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260905000000_bd_performance_rules/migration.sql`
- Create: `packages/contracts/src/performance.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/performance.test.ts`

**Interfaces:**
- Produce `performanceRuleSchema`, `performanceRuleInputSchema`, `bdTargetScheduleSchema`, `duplicateReviewSchema`, `performanceKpiSchema`, `performanceLeaderboardRowSchema`, and `performanceDrilldownQuerySchema`.
- Produce `PerformanceRuleSet`, `PerformanceKpi`, `PerformanceLeaderboardRow`, `DuplicateReview`, `AdminBdPerformanceResponse`, and `BdPerformanceResponse` types.

- [ ] Write failing contract tests for default values: target 70, SLA 48 business hours, reassignment SLA 2 business hours, maturity 21 days, lookback 6 months, weights 45/25/30, outcome points 1/2/3/5, slowdown threshold 120%, multiplier 25%.
- [ ] Add Prisma models for effective-dated rule sets, per-BD target schedules, working-day configuration, holidays, approved leave, and duplicate override reviews. Store `effectiveFrom`, `effectiveTo`, `createdById`, and audit metadata.
- [ ] Add explicit fields for review state, mandatory override reason, reviewer, reviewed time, expiry, and provisional-credit resolution.
- [ ] Add indexes for BD/date queries, review status/SLA, normalized JD identity, and effective-date lookup.
- [ ] Generate/apply the PostgreSQL migration without changing existing lead data.
- [ ] Run `npx vitest run packages/contracts/src/performance.test.ts` and the relevant Prisma/database migration checks.
- [ ] Commit: `feat: add performance rule and review contracts`.

### Task 2: Implement normalized intake and duplicate classification

**Files:**
- Modify: `packages/contracts/src/leads.ts`
- Modify: `packages/backend/src/leads/leads.service.ts`
- Modify: `apps/api/src/modules/leads/leads.controller.ts`
- Modify: `apps/web/components/leads/lead-capture-form.tsx`
- Test: `packages/backend/src/leads/application-intake.test.ts`
- Test: `packages/contracts/src/leads.test.ts`

**Interfaces:**
- Produce `normalizeJobUrl(url: string): string`.
- Produce `classifyApplicationDuplicate(input, lookback): Promise<"NONE" | "LIKELY" | "CONFIRMED">`.
- `POST /leads/intake` accepts profile, company, job title, JD link, recruiter name, and recruiter email; it assigns the applied date server-side.

- [ ] Add failing tests for removing `utm_*`, LinkedIn tracking parameters, URL fragments, trailing slashes, and preserving job IDs.
- [ ] Add failing tests for confirmed identity: same profile + normalized JD link; likely identity: same profile + normalized company + job title; different profiles never collide.
- [ ] Add failing tests proving the six-month default lookback and Admin-configured lookback.
- [ ] Implement normalization and duplicate classification against saved applications only.
- [ ] Persist valid intake records, auto-create/reuse standardized company and platform source, and link recruiter as the primary contact.
- [ ] Persist duplicate status and create a pending review record for likely-duplicate overrides with a mandatory reason.
- [ ] Ensure confirmed duplicates receive zero qualified credit and rejected overrides lose provisional credit.
- [ ] Return structured warning/review state to the frontend without blocking confirmed-duplicate traceability saves.
- [ ] Run the focused backend/contract tests and `git diff --check`.
- [ ] Commit: `feat: implement application duplicate workflow`.

### Task 3: Build pure business-calendar, maturity, and scoring engines

**Files:**
- Create: `packages/backend/src/performance/business-hours.ts`
- Create: `packages/backend/src/performance/maturity.ts`
- Create: `packages/backend/src/performance/score.ts`
- Create: `packages/backend/src/performance/eligibility.ts`
- Create: `packages/backend/src/performance/leaderboard.ts`
- Test: `packages/backend/src/performance/*.test.ts`

**Interfaces:**
- `businessHoursBetween(start, end, schedule): number` excludes configured weekends, holidays, leave, and reduced schedules.
- `maturityDate(appliedAt, maturityDays): Date` always advances through leave, holidays, and weekends.
- `calculateEffectiveAttainment(rawPercent, threshold, multiplier): number` implements 120%/25% diminishing return by default.
- `calculateBalancedScore(input): ScoreResult` returns score, component weights, coverage, and status.
- `calculateOutcomeScore(maturedApplications, stagePoints): number` uses highest stage only.
- `evaluateEligibility(input): EligibilityResult` uses 10 eligible working days plus maturity elapsed; 20/5 become warning badges.
- `rankLeaderboard(rows): RankedRow[]` applies score, attainment, outcomes, SLA, then alphabetical ordering with unique ranks.

- [ ] Write failing unit tests for business-hour exclusion, reassignment pause, leave/holiday target exclusion, and Admin reassignment overdue timing.
- [ ] Write failing unit tests for maturity continuing through leave and late-response original-cohort behavior.
- [ ] Write failing score tests for 100%, 120%, 160%, and 200% attainment; verify 160%→130% and 200%→140% effective attainment.
- [ ] Write failing tests for 45/25/30 weighting, `N/A` component rebalancing, zero matured outcome score after maturity, and insufficient-data status.
- [ ] Write failing tests for outcome points 1/2/3/5 with highest-stage-only behavior.
- [ ] Write failing tests for eligibility, Building Baseline, low-sample warnings, Admin provisional exceptions, and unique tie ordering.
- [ ] Implement the pure functions with no database or HTTP dependencies.
- [ ] Run all performance unit tests and review boundary cases before integration.
- [ ] Commit: `feat: add BD performance scoring engine`.

### Task 4: Persist calculations, SLAs, and Admin review workflows

**Files:**
- Create: `packages/backend/src/performance/performance.service.ts`
- Create: `packages/backend/src/performance/performance.service.test.ts`
- Modify: `packages/backend/src/leads/leads.service.ts`
- Modify: `packages/backend/src/notifications/notifications.service.ts`
- Create: `apps/api/src/modules/performance/performance.controller.ts`
- Create: `apps/api/src/modules/performance/performance.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- `getAdminBdPerformance(actor, query): Promise<AdminBdPerformanceResponse>`.
- `getBdPerformance(actor, query): Promise<BdPerformanceResponse>`.
- `reviewDuplicateOverride(actor, reviewId, decision, reason): Promise<DuplicateReview>`.
- `reassignFollowUp(actor, followUpId, newOwnerId): Promise<FollowUp>`.
- `getPerformanceRules(actor): Promise<PerformanceRuleSet>` and `updatePerformanceRules(actor, input): Promise<RulePreview>`.

- [ ] Write service tests for role authorization and Admin-versus-BD drill-down visibility.
- [ ] Write service tests for provisional override credit, approval retention, rejection retroactive removal, and recalculation.
- [ ] Write service tests for response during leave: original outcome credit, paused BD SLA, Admin reassignment SLA, reassigned-owner SLA, and audit timestamps.
- [ ] Implement rule loading by effective date and score calculation from persisted records.
- [ ] Implement every-pending-review Admin queue, three-business-day override SLA, and two-business-hour reassignment SLA.
- [ ] Emit in-app and email notifications for `Admin Reassignment Overdue`.
- [ ] Implement rule impact preview and effective-dated update transaction.
- [ ] Add audit records for rule changes, review decisions, credit changes, ownership, SLA transitions, and score inputs.
- [ ] Run backend performance tests and API module tests.
- [ ] Commit: `feat: add performance service and admin review workflows`.

### Task 5: Expose typed API client and Admin Performance Rules UI

**Files:**
- Modify: `apps/web/lib/api-client.ts`
- Create: `apps/web/components/performance/performance-rules-form.tsx`
- Create: `apps/web/components/performance/rule-impact-preview.tsx`
- Create: `apps/web/app/admin/performance/page.tsx`
- Test: `apps/web/components/performance/performance-rules-form.test.tsx`

**Interfaces:**
- API client helpers: `getPerformanceRules`, `previewPerformanceRules`, `updatePerformanceRules`, `getDuplicateReviews`, `reviewDuplicateOverride`.

- [ ] Write failing UI tests for loading rules, editing individual BD target, configuring holidays/leave, changing weights, and showing the future-only effective date.
- [ ] Write failing UI tests for impact preview and mandatory confirmation before save.
- [ ] Implement typed API helpers using shared Zod response parsing.
- [ ] Implement the centralized Performance Rules page with sections for targets, schedules, SLA windows, maturity, duplicate rules, and outcome points.
- [ ] Add explicit effective-date history and rule provenance display.
- [ ] Add accessible validation for positive durations, valid percentages, multiplier bounds, and required reason/expiry fields.
- [ ] Run focused frontend tests and web TypeScript check.
- [ ] Commit: `feat: add performance rules admin ui`.

### Task 6: Implement Admin BD Performance dashboard

**Files:**
- Create: `apps/web/components/performance/bd-team-kpis.tsx`
- Create: `apps/web/components/performance/bd-leaderboard.tsx`
- Create: `apps/web/components/performance/building-baseline.tsx`
- Create: `apps/web/components/performance/quality-control.tsx`
- Create: `apps/web/components/performance/reassignment-queue.tsx`
- Create: `apps/web/components/performance/score-details.tsx`
- Modify: `apps/web/components/dashboard/dashboard-overview.tsx`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/components/performance/*.test.tsx`

**Interfaces:**
- Consume `AdminBdPerformanceResponse` and produce role-safe links for KPI drill-downs.

- [ ] Write failing component tests for the four aggregate KPIs and every KPI drill-down link.
- [ ] Write failing tests for leaderboard score, component values, coverage, warning badges, unique rank, and tie-break details.
- [ ] Write failing tests for Building Baseline progress, estimated eligibility date, reason, and no-rank presentation.
- [ ] Write failing tests for quality guardrails and the Admin reassignment queue, including overdue state.
- [ ] Implement the dedicated BD Performance section below Admin global KPIs: leaderboard left, quality/reassignment queue right, details/trends below.
- [ ] Add rolling 30-day default with daily and rolling 7-day selectors.
- [ ] Add expandable application-level drill-downs available only to Admin.
- [ ] Preserve the existing calm, soft-rounded visual system and compact dashboard density.
- [ ] Run component tests, web TypeScript check, and accessibility-focused assertions.
- [ ] Commit: `feat: add admin BD performance dashboard`.

### Task 7: Implement BD dashboard surfaces

**Files:**
- Modify: `apps/web/components/dashboard/bd-dashboard.tsx`
- Create: `apps/web/components/performance/bd-peer-ranking.tsx`
- Create: `apps/web/components/performance/bd-personal-quality.tsx`
- Modify: `apps/web/components/dashboard/dashboard-overview.tsx`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/components/dashboard/bd-dashboard.test.tsx`

**Interfaces:**
- Consume `BdPerformanceResponse` and existing interview/lead/task responses.

- [ ] Write failing tests for the four daily KPI cards: qualified today, remaining target, recruiter responses, and interviews to schedule.
- [ ] Write failing tests for work queue/recent-applications split, Upcoming Interviews rows, and Edit/Open application/Open calendar actions.
- [ ] Write failing tests for personal rolling 30-day score, score coverage, status, target history, and next effective target.
- [ ] Write failing tests ensuring peers expose only names, qualified counts, Record Health Rate, Audit Pass Rate, and Duplicate Rate.
- [ ] Implement the compact BD operational dashboard without making the full calendar the primary component.
- [ ] Add `Building baseline`, `Low Application Sample`, `Low Outcome Sample`, `Partial measurement`, and `Insufficient data` states.
- [ ] Add personal application-level drill-down while preventing peer record/recruiter/audit detail leakage.
- [ ] Run focused dashboard tests and web TypeScript check.
- [ ] Commit: `feat: add BD performance dashboard`.

### Task 8: Add Playwright coverage and final verification

**Files:**
- Create: `apps/web/e2e/bd-performance.spec.ts`
- Create: `apps/web/e2e/admin-bd-performance.spec.ts`
- Create: `apps/web/e2e/duplicate-review.spec.ts`
- Modify: `playwright.config.ts` to use frontend port 3100 and backend port 3101 only
- Modify: `README.md` with local verification commands

**Interfaces:**
- Browser flows use seeded Admin and BD accounts and the existing local frontend/backend services.

- [ ] Add a failing E2E test for a complete application submission and automatic applied date.
- [ ] Add E2E coverage for incomplete rejection, confirmed duplicate save with zero credit, likely duplicate warning, mandatory override reason, Admin review, approval, rejection, and retroactive score update.
- [ ] Add E2E coverage for Admin rules preview/save, future effective dates, leaderboard drill-down, Building Baseline, and reassignment overdue queue.
- [ ] Add E2E coverage for BD dashboard privacy, target progress, peer summary, upcoming interview actions, score coverage, and rolling-period switching.
- [ ] Run Playwright against frontend 3100 and backend 3101; verify no use of ports 3000 or 3001.
- [ ] Run `npx vitest run apps/web packages/contracts packages/backend`, both TypeScript checks, `git diff --check`, and Playwright.
- [ ] Review console errors, network responses, role leakage, and visual overflow in the affected dashboard surfaces.
- [ ] Commit: `test: cover BD performance workflows`.

## Execution order

Tasks 1–4 are backend and contract foundations. Tasks 5–7 can proceed after Task 4, with Tasks 6 and 7 parallelizable once the API response contracts are stable. Task 8 runs after all UI workflows are integrated.

## Definition of done

- All approved rules are configurable and effective-dated.
- Incomplete records never persist.
- Duplicate and override credit behavior matches the approved model.
- Scores, coverage, eligibility, rankings, and tie-breaks are server-authoritative.
- Admin and BD privacy boundaries pass automated tests.
- Every Admin KPI drills into its underlying records.
- Admin and BD dashboard flows pass browser E2E on ports 3100/3101.
