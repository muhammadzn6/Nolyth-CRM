# Lead Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent, role-aware, responsive lead workspace for every lead-detail route.

**Architecture:** Enrich the existing lead-detail API with compact identity relations, then render all lead pages through one reusable server-first workspace frame. Keep mutations in small client components and modal dialogs so navigation and data ownership stay explicit.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Zod contracts, Prisma-backed services, Vitest, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-09-08-lead-workspace-design.md`

## Global Constraints

- Frontend remains on port 3100 and backend on port 3101.
- Preserve existing Admin, BD, and Closer authorization; Closer cannot access Offers.
- Do not modify unrelated dashboard or directory UI.
- Use test-first implementation and verify the failing reason before production edits.
- No page-level horizontal overflow at 390 CSS pixels.

---

### Task 1: Enrich the lead-detail contract

**Files:**
- Modify: `packages/contracts/src/leads.ts`
- Modify: `packages/contracts/src/leads.test.ts`
- Modify: `packages/backend/src/leads/leads.service.ts`
- Modify: `packages/backend/src/leads/leads.service.test.ts`

**Interfaces:**
- Produces: `LeadDetail` with `profile`, `sourceRef`, `currentOwner`, and nullable `responsibleCloser` identity summaries.

- [ ] Add a contract test that parses a complete enriched lead detail and rejects an incomplete identity relation.
- [ ] Run the contract test and confirm it fails because the new fields are not accepted.
- [ ] Add a backend test that asserts `get()` requests and maps the four identity relations.
- [ ] Run the backend test and confirm it fails because `get()` does not include those relations.
- [ ] Add the smallest schemas, Prisma include, and mapping helpers needed for both tests.
- [ ] Run both targeted test files and confirm they pass.

### Task 2: Build the persistent workspace frame

**Files:**
- Create: `apps/web/components/leads/lead-workspace-shell.tsx`
- Create: `apps/web/components/leads/lead-workspace-shell.test.tsx`
- Create: `apps/web/components/leads/job-link-actions.tsx`
- Create: `apps/web/components/leads/job-link-actions.test.tsx`

**Interfaces:**
- Consumes: enriched `LeadDetail`, actor role, active section, and optional header action.
- Produces: `LeadWorkspaceShell` and `JobLinkActions`.

- [ ] Add component tests for identity hierarchy, stage rail, role-aware persistent tabs, active-tab semantics, and normalized job-domain display.
- [ ] Run the tests and confirm they fail because the components do not exist.
- [ ] Implement the server-first frame and the minimal clipboard/open client control.
- [ ] Run the component tests and confirm they pass.

### Task 3: Make ownership editing compact and modal

**Files:**
- Modify: `apps/web/components/leads/lead-closer-assignment.tsx`
- Create: `apps/web/components/leads/lead-closer-assignment.test.tsx`

**Interfaces:**
- Consumes: current `LeadDetail` and eligible `UserSummary[]`.
- Produces: one secondary “Change closer” trigger and modal form.

- [ ] Add tests proving the form is hidden until requested and unchanged selections cannot submit.
- [ ] Run the test and confirm it fails against the existing always-visible card.
- [ ] Replace the card with a modal action, preserving the existing mutation and refresh behavior.
- [ ] Run the test and confirm it passes.

### Task 4: Adopt the frame across lead routes

**Files:**
- Modify: `apps/web/app/leads/[leadId]/page.tsx`
- Modify: `apps/web/app/leads/[leadId]/page.test.tsx`
- Modify: `apps/web/app/leads/[leadId]/interviews/page.tsx`
- Modify: `apps/web/app/leads/[leadId]/interviews/page.test.tsx`
- Modify: `apps/web/app/leads/[leadId]/[section]/page.tsx`
- Create: `apps/web/app/leads/[leadId]/[section]/page.test.tsx`

**Interfaces:**
- Consumes: `LeadWorkspaceShell` and existing section actions/content.
- Produces: consistent Overview, Interviews, Communications, Comments, Offers, and Activity pages.

- [ ] Add route tests that prove the workspace identity and navigation remain visible on every section and Offers stays hidden from Closer users.
- [ ] Run the route tests and confirm they fail because child routes render independent headers.
- [ ] Refactor each route through the shared frame; flatten Overview contacts and merge ownership context.
- [ ] Run all lead route tests and confirm they pass.

### Task 5: Verify behavior and responsive layout

**Files:**
- Modify only targeted files if verification exposes a regression.
- Artifacts: `output/playwright/lead-workspace-*.png`

**Interfaces:**
- Consumes: running web and API services on ports 3100 and 3101.
- Produces: automated and browser evidence for role, route, and responsive behavior.

- [ ] Run targeted contracts, backend, and web tests.
- [ ] Run affected-package type checks and lint checks.
- [ ] Verify service health without starting anything on ports 3000 or 3001.
- [ ] Use Playwright to inspect every permitted lead tab as BD, Admin, and Closer.
- [ ] At 390 CSS pixels, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and capture a screenshot.
- [ ] At desktop width, inspect information hierarchy, modal behavior, focus, and section persistence; capture a screenshot.
