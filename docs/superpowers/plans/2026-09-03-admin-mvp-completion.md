# Admin MVP Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the four approved admin MVP areas: data workflows, profile/task/password/invitation/activity workflows, OpenAPI/client generation, and full browser coverage.

**Architecture:** Extend the existing NestJS REST API, Zod contracts, Prisma persistence, and Next.js admin screens without replacing the current session or client-calendar model. Each mutation will use the existing service boundary, emit one activity event after a successful commit, and expose typed frontend helpers. CSV imports will parse bounded batches with row-level results; OpenAPI will describe the same routes and generate a checked-in TypeScript client.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Zod, Next.js App Router, React, Vitest, Playwright, OpenAPI 3.1, TypeScript.

**Spec:** User-approved scope in the conversation: “Admin data workflows”, “Profile, task, password, invitation, and activity workflows”, “OpenAPI specification and generated API client”, and “Full Playwright admin E2E coverage”.

## Global Constraints

- Frontend must run on port 3100.
- Backend must run on port 3101.
- Ports 3000 and 3001 are reserved for other services and must not be used.
- File upload functionality remains deferred; do not add upload or malware-scanning work in this plan.
- Preserve existing client-owned Google Calendar connections and explicit closer assignments.
- Every new mutation must have validation, authorization, an automated test, and an activity event.
- Use existing UI primitives and API-client patterns; do not introduce a second state-management or HTTP stack.

### Task 1: Contract and mutation-audit inventory

**Files:**
- Modify: `packages/contracts/src/index.ts` and affected contract modules
- Modify: `packages/backend/src/**/` services that mutate admin-owned records
- Test: `packages/backend/src/**/service.test.ts`
- Create: `docs/superpowers/plans/2026-09-03-admin-mutation-inventory.md`

**Interfaces:**
- Consumes: Existing Prisma models and service methods.
- Produces: A table of mutation names, authorization rule, activity event type, and test location; shared activity-event helper signatures where duplication exists.

- [ ] **Step 1: Enumerate current mutations**

  Run:

  ```bash
  rg -n "async (create|update|delete|archive|complete|cancel|invite|change|reset|replace)|@Post|@Patch|@Put|@Delete" apps/api packages/backend
  ```

  Record each mutation in `docs/superpowers/plans/2026-09-03-admin-mutation-inventory.md` with its expected event name.

- [ ] **Step 2: Add failing service tests for missing events**

  For each mutation found without an event assertion, add a test that invokes the service with a valid actor and expects one activity event containing the entity id and actor id. Run the owning Vitest file and confirm the new assertion fails.

- [ ] **Step 3: Implement the smallest shared event helper**

  Reuse the existing activity persistence service. Add no new event bus; call the helper after each successful mutation and keep event creation inside the existing transaction boundary where the service already has one.

- [ ] **Step 4: Run backend tests**

  ```bash
  cd packages/backend && npm test -- --run
  ```

  Expected: all existing tests plus the new mutation-event assertions pass.

### Task 2: Bulk CSV import and full client CRUD

**Files:**
- Create: `packages/contracts/src/imports.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/backend/src/imports/imports.service.ts`
- Create: `apps/api/src/modules/imports/imports.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/web/lib/api-client.ts`
- Create: `apps/web/components/data/csv-import-form.tsx`
- Create: `apps/web/components/admin/client-form.tsx`
- Modify: `apps/web/components/clients/client-directory.tsx`
- Create: `apps/web/app/admin/clients/new/page.tsx`
- Modify: `apps/web/app/admin/clients/[clientId]/page.tsx`
- Test: `packages/backend/src/imports/imports.service.test.ts`
- Test: `apps/web/components/data/csv-import-form.test.tsx`

**Interfaces:**
- Consumes: `CompanySummary`, lead/candidate schemas, existing authorization guard, and `createCompany`/`updateCompany` service patterns.
- Produces: `POST /imports/leads`, `POST /imports/candidates`, `POST /companies`, `PATCH /companies/:companyId`, and typed helpers `importLeads`, `importCandidates`, `createCompany`, `updateCompany`.

- [ ] **Step 1: Write failing contract tests**

  Cover required headers, invalid UUIDs, duplicate rows, partial row failures, and a successful result shaped as `{ imported: number; failed: number; errors: Array<{ row: number; message: string }> }`. Run the contract/backend test and confirm failure.

- [ ] **Step 2: Implement bounded CSV parsing**

  Accept UTF-8 text, normalize headers, reject files over 5 MB or 1,000 rows, validate every row with Zod, continue after row errors, and never write an invalid row. Return deterministic row numbers starting at 2 for the first data row.

- [ ] **Step 3: Add admin company create/update endpoints**

  Require `ADMIN`, validate canonical name and optional company fields, enforce optimistic version checks on update, emit `company.created`/`company.updated`, and return `CompanySummary`.

- [ ] **Step 4: Add frontend import and client CRUD screens**

  Add import controls to Leads and Candidates, show row-level errors, add “New client”, edit controls, disabled pending states, and visible API errors. Keep existing client calendar/closer assignment controls intact.

- [ ] **Step 5: Run focused tests and typecheck**

  ```bash
  cd packages/backend && npm test -- --run src/imports/imports.service.test.ts
  cd ../../apps/web && npm test -- --run components/data/csv-import-form.test.tsx
  ../../node_modules/.bin/tsc --noEmit -p tsconfig.json
  ```

### Task 3: Communications, comments, offers, tasks, passwords, and invitations

**Files:**
- Modify: `packages/contracts/src/leads.ts`, `packages/contracts/src/offers.ts`, `packages/contracts/src/tasks.ts`, `packages/contracts/src/identity.ts`
- Modify: `apps/web/lib/api-client.ts`
- Modify: `apps/web/app/leads/[leadId]/[section]/page.tsx`
- Modify: `apps/web/components/**/` forms and action components
- Modify: `apps/web/components/admin/users-page.tsx`
- Create: `apps/web/components/auth/password-reset-form.tsx`
- Create: `apps/web/app/reset-password/page.tsx`
- Modify: `apps/web/app/settings/page.tsx`
- Test: `apps/web/components/**/` focused component tests
- Test: `packages/backend/src/**/` service tests

**Interfaces:**
- Consumes: Existing collaboration, offers, tasks, identity, and invitation endpoints.
- Produces: Complete admin-visible create/edit flows with typed API helpers, password reset/change screens, and resend-invitation control.

- [ ] **Step 1: Add failing tests for each missing UI action**

  Assert that the communications and comments sections render create/edit controls, offer rows render edit controls, task rows expose complete/cancel actions, and user rows expose resend invitation. Run each test and confirm it fails for the missing control.

- [ ] **Step 2: Add or correct contract/API helpers**

  Add only helpers for existing backend routes first. Where a backend route is absent, add the route with strict Zod input, admin authorization, optimistic version checking, and an activity event before adding its frontend control.

- [ ] **Step 3: Implement the forms with pending/error states**

  Keep forms colocated with their domain components, reload or update local state after success, and render server validation messages in `role="alert"` elements.

- [ ] **Step 4: Implement password and invitation flows**

  Add reset-token request, token consumption, authenticated password change, and resend-invitation UI. Do not expose whether an email exists in unauthenticated reset requests.

- [ ] **Step 5: Run focused and full frontend/backend tests**

  ```bash
  cd apps/web && npm test -- --run
  cd ../../packages/backend && npm test -- --run
  ```

### Task 4: Profile tabs and admin activity completeness

**Files:**
- Modify: `apps/web/app/profiles/[profileId]/[tab]/page.tsx`
- Modify: `apps/web/components/profiles/profile-workspace.tsx`
- Modify: `packages/backend/src/notifications/notifications.service.ts`
- Modify: `packages/contracts/src/notifications.ts`
- Test: `apps/web/components/profiles/profile-workspace.test.tsx`
- Test: `packages/backend/src/notifications/notifications.service.test.ts`

**Interfaces:**
- Consumes: Existing profile, lead, interview, task, document, activity, and analytics APIs.
- Produces: Functional Leads, Interviews, Tasks, Documents, Activity, and Analytics tabs with profile filtering and correct admin authorization.

- [ ] **Step 1: Write tab contract tests**

  For each tab, render a profile with one representative record and assert the record appears; render an empty response and assert the correct empty state. Confirm the current implementation fails for any nonfunctional tab.

- [ ] **Step 2: Implement tab-specific data loading**

  Keep tab route loading server-side, pass only validated profile-scoped data to the client workspace, and preserve the existing document-upload deferral by displaying existing records without adding new upload behavior.

- [ ] **Step 3: Verify activity filtering**

  Ensure admin activity queries are filtered by profile ownership/related lead ids and never leak another profile’s events. Add a backend regression test for two profiles with interleaved events.

- [ ] **Step 4: Run profile tests**

  ```bash
  cd apps/web && npm test -- --run components/profiles/profile-workspace.test.tsx
  cd ../../packages/backend && npm test -- --run src/notifications/notifications.service.test.ts
  ```

### Task 5: OpenAPI specification and generated client

**Files:**
- Create: `docs/openapi/orbit.yaml`
- Create: `scripts/generate-api-client.mjs`
- Create: `packages/api-client/src/index.ts`
- Create: `packages/api-client/package.json`
- Modify: `package.json`, `turbo.json`, and workspace package configuration
- Modify: `apps/web/lib/api-client.ts`
- Test: `scripts/openapi-validation.test.ts`

**Interfaces:**
- Consumes: NestJS routes and Zod contracts.
- Produces: Valid OpenAPI 3.1 document and generated TypeScript client package consumed by web API helpers.

- [ ] **Step 1: Write the OpenAPI validation test**

  Validate `docs/openapi/orbit.yaml` parses as OpenAPI 3.1 and contains paths for auth, users, companies, imports, leads, interviews, offers, tasks, profiles, activity, and calendars. Run it and confirm failure because the document/package is absent or incomplete.

- [ ] **Step 2: Add the specification**

  Document request/response schemas from the contracts, cookie authentication, error envelopes, pagination, optimistic version fields, and all admin routes. Do not invent routes not present in NestJS.

- [ ] **Step 3: Add deterministic generation**

  Make `npm run api:generate` regenerate `packages/api-client/src/generated.ts` from the checked-in YAML and fail on schema errors. Keep generated output deterministic.

- [ ] **Step 4: Switch web helpers to the generated types/client**

  Preserve the existing public helper signatures while using generated request/response types internally, then run the OpenAPI validation and frontend typecheck.

### Task 6: Full Playwright admin E2E suite

**Files:**
- Modify: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/admin-data-workflows.spec.ts`
- Create: `apps/web/e2e/admin-profile-workflows.spec.ts`
- Create: `apps/web/e2e/admin-auth-workflows.spec.ts`
- Create: `apps/web/e2e/admin-client-workspaces.spec.ts`
- Modify: `scripts/seed-demo.mjs` or existing seed fixture

**Interfaces:**
- Consumes: Ports 3100/3101, seeded admin credentials, demo client, and isolated browser contexts.
- Produces: Repeatable browser coverage for every admin navigation item and every approved workflow.

- [ ] **Step 1: Add deterministic seed assertions**

  Ensure the seed contains one client, one assigned closer, one lead, one offer, one interview, one task, one profile, and activity records. Assert the seed command completes without duplicate failures.

- [ ] **Step 2: Write failing E2E journeys**

  Cover admin login, client create/edit, client assignment/calendar view, lead import, candidate import, communication/comment create/edit, offer edit, interview edit, task complete/cancel, resend invitation, password change, profile tabs, and CSV export. Run each journey and record the first failing selector/assertion.

- [ ] **Step 3: Fix accessibility and flow defects**

  Prefer role/name selectors, add labels to controls, isolate each test context, and fix application defects rather than weakening assertions.

- [ ] **Step 4: Run the full browser suite**

  ```bash
  cd apps/web
  set -a; source ../../.env; set +a
  ORBIT_E2E_WEB_ORIGIN=http://localhost:3100 ORBIT_E2E_API_ORIGIN=http://localhost:3101 npm run test:e2e
  ```

  Expected: all admin journeys pass with no use of ports 3000 or 3001.

### Task 7: Final verification and handoff

**Files:**
- Modify: `README.md` and relevant runbook documentation
- Test: repository-wide checks

- [ ] **Step 1: Run all automated checks**

  ```bash
  npm test -- --run
  npm run lint
  cd apps/web && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json
  cd ../.. && git diff --check
  ```

- [ ] **Step 2: Verify running services**

  ```bash
  curl -fsS http://localhost:3100 >/dev/null
  curl -fsS http://localhost:3101/health/live
  ```

- [ ] **Step 3: Review scope line by line**

  Confirm each of the four requested areas has a code path, automated test, and browser journey. Explicitly report any item blocked by an external provider or missing user credential instead of marking it complete.

- [ ] **Step 4: Document remaining deferred work**

  State that production hardening and file uploads/malware scanning remain outside this approved scope unless separately authorized.
