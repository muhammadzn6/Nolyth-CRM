# Closer Lifetime Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a truthful, role-scoped, all-time Closer conversion funnel from handled applications through placements.

**Architecture:** Extend `CloserDashboardData` with a strict aggregate object, calculate it in the existing Closer dashboard service from distinct application IDs, and render it with a focused dashboard component. Downstream offers and placements are attributed only to applications where the Closer recorded attended interview participation.

**Tech Stack:** TypeScript, Zod, NestJS service layer, Prisma-compatible persistence, React 19, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-closer-lifetime-funnel-design.md`

## Global Constraints

- Keep the Closer calendar and immediate operational work above the lifetime funnel.
- Count unique applications at every stage.
- Credit offers and placements only after an attended interview by the signed-in Closer.
- Reuse the established orange editorial visual language.
- Do not touch unrelated BD dashboard work or untracked local artifacts.

---

### Task 1: Closer lifetime funnel contract

**Files:**
- Modify: `packages/contracts/src/closer-dashboard.ts`
- Test: `packages/contracts/src/closer-dashboard.test.ts`

**Interfaces:**
- Produces: `closerDashboardLifetimeFunnelSchema` with non-negative integer fields `applicationsHandled`, `interviewsScheduled`, `callsAttended`, `offers`, and `placements`.
- Produces: required `lifetimeFunnel` on `CloserDashboardData`.

- [x] **Step 1: Write the failing contract test**

Add a valid `lifetimeFunnel` fixture and assertions that negative values and a missing aggregate are rejected.

- [x] **Step 2: Run the focused contract test and confirm failure**

Run: `npm test -- --run packages/contracts/src/closer-dashboard.test.ts`

Expected: FAIL because the aggregate schema does not exist yet.

- [x] **Step 3: Add the strict aggregate schema**

Define five non-negative integer fields and require the object in `closerDashboardDataSchema`.

- [x] **Step 4: Run the focused contract test**

Run: `npm test -- --run packages/contracts/src/closer-dashboard.test.ts`

Expected: PASS.

### Task 2: All-time Closer aggregation

**Files:**
- Modify: `packages/backend/src/closer-dashboard/closer-dashboard.service.ts`
- Modify: `packages/backend/src/closer-dashboard/closer-dashboard.service.test.ts`
- Modify: `apps/api/src/modules/closer-dashboard/closer-dashboard.controller.test.ts`

**Interfaces:**
- Consumes: `CloserDashboardData.lifetimeFunnel` from Task 1.
- Produces: all-time distinct application totals scoped by `InterviewRound.closerId` and `JobLead.responsibleCloserId`.

- [x] **Step 1: Write failing service tests**

Cover distinct applications with multiple interview rounds, another Closer's rows, scheduled applications, attended applications, attended applications reaching offer/placement status, and offers without attendance receiving no downstream credit.

- [x] **Step 2: Run the service test and confirm failure**

Run: `npm test -- --run packages/backend/src/closer-dashboard/closer-dashboard.service.test.ts`

Expected: FAIL because `lifetimeFunnel` is absent.

- [x] **Step 3: Add the minimal lifetime query and aggregation**

Read all relevant leads once where the signed-in Closer is the current responsible Closer or owns an interview round. Select that Closer's interview metadata, offer records, placement timestamps, and status-transition history, then build nested application ID sets for each stage. An offer is evidenced by an offer record or current/historical offer-stage status; a placement is evidenced by placement timestamps or current/historical placement-stage status. Both stages require an `ATTENDED` interview by this Closer. Avoid capped operational arrays and avoid counting interview rounds directly.

- [x] **Step 4: Run the focused service and controller tests**

Run: `npm test -- --run packages/backend/src/closer-dashboard/closer-dashboard.service.test.ts apps/api/src/modules/closer-dashboard/closer-dashboard.controller.test.ts`

Expected: PASS.

### Task 3: Closer lifetime funnel presentation

**Files:**
- Create: `apps/web/components/dashboard/closer-lifetime-funnel.tsx`
- Create: `apps/web/components/dashboard/closer-lifetime-funnel.module.css`
- Create: `apps/web/components/dashboard/closer-lifetime-funnel.test.tsx`
- Modify: `apps/web/components/dashboard/closer-dashboard.tsx`
- Modify: `apps/web/components/dashboard/closer-dashboard.test.tsx`
- Modify: `apps/web/lib/api-client.test.ts`

**Interfaces:**
- Consumes: `CloserDashboardData["lifetimeFunnel"]`.
- Produces: `CloserLifetimeFunnel({ totals })` with five linked stages and an accessible lifetime-funnel label.

- [x] **Step 1: Write failing component tests**

Assert the five labels and totals, application-based links, downstream conversion copy, and that a zero placement total does not render stream geometry beyond Offers.

- [x] **Step 2: Run the focused web tests and confirm failure**

Run: `npm test -- --run apps/web/components/dashboard/closer-lifetime-funnel.test.tsx apps/web/components/dashboard/closer-dashboard.test.tsx`

Expected: FAIL because the component and dashboard section are missing.

- [x] **Step 3: Implement the focused visual component**

Use an SVG orange stream with widths derived from actual nested totals, compact stage labels, conversion percentages, and linked stage overlays. Keep operational content above it and use the component's CSS Module so pre-existing global stylesheet work remains untouched.

- [x] **Step 4: Run the focused web tests**

Run: `npm test -- --run apps/web/components/dashboard/closer-lifetime-funnel.test.tsx apps/web/components/dashboard/closer-dashboard.test.tsx`

Expected: PASS.

### Task 4: Full verification

**Files:**
- Verify only; modify a task-owned file only when a failure directly traces to this feature.

**Interfaces:**
- Consumes: completed contract, backend, and frontend changes.
- Produces: test, type, lint, build, and browser evidence.

- [x] **Step 1: Run package test suites**

Run the repository's direct package test commands for contracts, backend/API, and web.

- [x] **Step 2: Run lint, typecheck, and production build**

Use the existing package scripts, preferring direct workspace commands if the repository Turbo wrapper cannot locate its package manager.

- [x] **Step 3: Verify in Playwright at `http://localhost:3100`**

Log in as the seeded Closer, confirm the funnel appears below operational content, inspect zero/non-zero stages, click a stage, check browser console errors, and capture desktop plus mobile screenshots.

- [x] **Step 4: Review the diff for scope**

Confirm every changed line traces to the approved funnel and that pre-existing BD modifications and untracked artifacts remain untouched.
