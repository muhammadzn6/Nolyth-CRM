# BD Dashboard Card Hierarchy Implementation Plan

> Execute with test-driven development. Preserve unrelated dirty-worktree changes and do not use ports 3000 or 3001.

## Task 1: Add authoritative dashboard aggregates

**Files:**
- Modify: `packages/contracts/src/performance.ts`
- Modify: `packages/contracts/src/performance.test.ts`
- Modify: `packages/backend/src/performance/performance.service.ts`
- Modify: `packages/backend/src/performance/performance.service.test.ts`

1. Add failing contract/service tests for today's platform totals, seven-day activity, timezone, and lifetime pipeline totals.
2. Run targeted tests and confirm the new assertions fail for missing fields.
3. Extend the work-queue contract and compute the aggregates from BD-owned applications, status history, and interviews.
4. Re-run targeted tests until green.

## Task 2: Rebuild the BD card hierarchy

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/page.test.tsx`
- Modify: `apps/web/components/dashboard/bd-dashboard.tsx`
- Modify: `apps/web/components/dashboard/bd-dashboard.test.tsx`
- Modify as needed: `apps/web/components/performance/bd-personal-quality.tsx`
- Modify as needed: `apps/web/components/performance/bd-peer-ranking.tsx`

1. Add failing tests for URL-backed performance period, scoped platform/cadence/funnel data, capped recent rows, flat attention queue, and simplified performance cards.
2. Confirm the assertions fail against the current implementation.
3. Pass the selected performance period into the dashboard and render a local performance-only period control.
4. Replace preview-derived metrics with authoritative work-queue aggregates.
5. Simplify each card to the approved anatomy and cap scrollable lists.
6. Re-run targeted component tests until green.

## Task 3: Apply hierarchy styling and verify

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify only if required: `apps/web/components/dashboard/bd-calendar-preview.tsx`
- Modify only if required: `apps/web/components/dashboard/bd-calendar-preview.test.tsx`

1. Add the minimum CSS needed for the 60/40 primary composition, equal fixed-height secondary cards, connected funnel, component bars, platform stack, and flat rows.
2. Run frontend unit tests and type checks.
3. Verify backend and frontend health on ports 3101 and 3100.
4. Use Playwright with the BD account to verify desktop and narrower desktop layouts, card interaction, internal scrolling, period navigation, and browser console/network health.
5. Fix any observed regression and repeat verification.
