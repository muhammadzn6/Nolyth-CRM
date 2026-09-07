# BD Dashboard Operational Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the BD dashboard’s generic KPI-card layout with the approved daily operational workspace while preserving existing role permissions and server-owned performance calculations.

**Architecture:** Keep the page server-rendered and use the existing `BdDashboard` route boundary. Add a small, typed dashboard view-model builder for derived display data, render the new sections with lightweight semantic HTML/CSS/SVG (no chart dependency), and use existing links for drill-down actions. Extend the BD work-queue response only where the current server contract can provide trustworthy counts; unavailable data remains an explicit zero/empty state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, Tailwind/CSS in `apps/web/app/globals.css`, `@orbit/contracts`, existing `@orbit/ui` Card.

**Spec:** `docs/superpowers/specs/2026-09-05-bd-performance-kpis-design.md` plus the approved BD dashboard decisions in this conversation.

## Global Constraints

- BD dashboard only; do not redesign Admin or Closer dashboard behavior in this change.
- Frontend remains on port 3100 and backend remains on port 3101; never use 3000 or 3001.
- Daily reporting anchor is US Eastern; PKT is supporting context.
- Qualified applications drive target progress; recorded applications and duplicates remain separate.
- Confirmed duplicates and pending overrides never inflate qualified target progress.
- No external email/LinkedIn integration is assumed; BD-entered communication remains the source of truth.
- Use accessible labels, keyboard navigation, and inline/section-level failure states.

### Task 1: Lock the BD dashboard view-model with tests

**Files:**
- Modify: `apps/web/components/dashboard/bd-dashboard-kpis.ts`
- Test: `apps/web/components/dashboard/bd-dashboard-kpis.test.ts`

**Interfaces:**
- Produce pure builders for daily target display, operational pulse values, platform segments, and lifetime funnel stage labels.
- Keep the existing `buildBdDashboardKpis` and `buildBdSecondarySignals` public behavior compatible with current tests.

- [ ] **Step 1: Write failing tests** for qualified-vs-recorded totals, platform percentages, unique counts, target remaining/over-target, and zero target days.
- [ ] **Step 2: Run `npm --prefix apps/web test -- bd-dashboard-kpis.test.ts` and confirm the new assertions fail for missing view-model behavior.**
- [ ] **Step 3: Implement the smallest pure view-model helpers using deterministic inputs and US Eastern date formatting.**
- [ ] **Step 4: Run the focused test again and confirm it passes.**
- [ ] **Step 5: Run the existing KPI test suite and remove only unused imports created by the change.**

### Task 2: Build the daily activity tracker and operational pulse

**Files:**
- Modify: `apps/web/components/dashboard/bd-dashboard.tsx`
- Test: `apps/web/components/dashboard/bd-dashboard.test.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consume the view-model builders from Task 1 and existing `BdPerformanceResponse`, `BdWorkQueue`, `LeadSummary`, and `InterviewSummary` props.
- Produce accessible sections named `Today’s activity` and `Today’s operational pulse` with clickable totals/platform segments and modal/page-safe links.

- [ ] **Step 1: Add failing render assertions** for full-width target tracker, `Recorded`, `Qualified`, platform segments, unique stats, operational stage blocks, target remaining text, and zero-count stage actions.
- [ ] **Step 2: Run the focused dashboard test and verify it fails because the new sections do not exist.**
- [ ] **Step 3: Implement the tracker and equal-width connected pulse blocks with semantic links, inline progress bars, target/pace labels, and explicit recorded-vs-qualified copy.**
- [ ] **Step 4: Add responsive CSS: equal-width desktop flow, horizontal scrolling on narrow screens, accessible focus states, and calm channel/status colors.**
- [ ] **Step 5: Run `npm --prefix apps/web test -- bd-dashboard.test.ts` and verify all assertions pass.**

### Task 3: Add the BD calendar/action queue and communication activity surfaces

**Files:**
- Modify: `apps/web/components/dashboard/bd-dashboard.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `apps/web/components/dashboard/bd-dashboard.test.tsx`

**Interfaces:**
- Consume the existing interview list and work-queue totals.
- Produce a compact horizontally scrollable weekly interview grid/list, priority-sorted action queue links, outbound/inbound communication activity shell, and recent activity placeholder with truthful empty/error states.

- [ ] **Step 1: Add failing render assertions** for `Upcoming interviews`, `Action queue`, `Recruiter communication activity`, outbound/inbound labels, response-rate placeholder, and quick actions.
- [ ] **Step 2: Run the focused test and verify it fails.**
- [ ] **Step 3: Implement the calendar/action split using existing interview data, with 24-hour formatting, US Eastern primary context, PKT support, stage labels, and drawer-safe application links.**
- [ ] **Step 4: Implement communication activity with separate direction colors, channel rows, and explicit “recorded in Orbit” context; do not fabricate unavailable counts.**
- [ ] **Step 5: Add CSS for compact grid columns, action priority markers, responsive horizontal scrolling, and accessible contrast.**
- [ ] **Step 6: Run focused tests and typecheck.**

### Task 4: Add lifetime funnel, trend visualization, leaderboard composition, and quality strip

**Files:**
- Modify: `apps/web/components/dashboard/bd-dashboard.tsx`
- Modify: `apps/web/components/performance/bd-peer-ranking.tsx`
- Modify: `apps/web/components/performance/bd-personal-quality.tsx`
- Modify: `apps/web/app/globals.css`
- Tests: `apps/web/components/dashboard/bd-dashboard.test.tsx`, existing performance component tests

**Interfaces:**
- Consume existing server-owned performance fields for score, coverage, rank, peer summaries, and quality.
- Produce lifetime funnel labels and honest zero/limited-data states; do not infer unavailable lifetime totals from bounded preview arrays.

- [ ] **Step 1: Add failing assertions** for Lifetime default, Weekly/Monthly/Annual controls, funnel stage names, conversion placeholders, weekly leaderboard, score coverage, raw/effective attainment labels, and quality guardrails.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Render server-provided values where available and show `N/A`/“More history needed” rather than invented analytics where the API contract lacks lifetime data.**
- [ ] **Step 4: Add compact contribution and attainment visuals that preserve N/A rebalancing semantics.**
- [ ] **Step 5: Run dashboard/performance tests and typecheck.**

### Task 5: Browser verification and regression coverage

**Files:**
- Modify: `apps/web/e2e/bd-performance.spec.ts`
- Modify: `apps/web/e2e/performance-helpers.ts` only if selectors need shared helpers

- [ ] **Step 1: Add Playwright assertions** for BD dashboard section order, visible daily tracker, operational pulse, calendar/action split, funnel controls, leaderboard, and quality strip.
- [ ] **Step 2: Run `npm --prefix apps/web test:e2e -- bd-performance.spec.ts` against frontend 3100/backend 3101 and record failures.**
- [ ] **Step 3: Fix only selector, layout, or rendering issues exposed by the browser run.**
- [ ] **Step 4: Capture a final BD dashboard screenshot and verify no horizontal overflow at desktop width and expected horizontal scrolling at narrow width.**
- [ ] **Step 5: Run final `npm run typecheck`, `npm run test`, `npm run format:check`, and the focused Playwright spec.**

## Self-review checklist

- The current API does not expose enough data for true lifetime funnel totals, daily communication counts, historical trend series, or recent activity on the BD response. Those elements must be rendered as explicit unavailable/empty states until a server contract is added; this plan does not invent data.
- Existing performance calculations remain server-owned and are not recomputed in the browser.
- Existing dashboard tests must remain green while the old KPI-card assertions are updated to the approved new structure.
