# Companies and Leads Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core lead pipeline over profiles: companies, contacts, job leads, ownership, status transitions, closer assignment, important flags, archive/restore, and lead workspace UI.

**Architecture:** Extend the existing Prisma modular monolith and current Profile/assignment foundation with normalized company/contact references and lead lifecycle data. Shared Zod contracts define commands and responses; a backend service scopes reads and mutations by actor role, profile assignment, and lead ownership; the Next.js UI consumes the typed API. Mutations write audit/history records transactionally.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Zod, Next.js 16, React 19, Tailwind CSS, Vitest, Supertest, Playwright.

**Spec:** `/Users/mzohaibnasir/Downloads/2026-09-01-orbit-crm-design.md` sections 4.2, 5.2–5.4, 7.3, 7.7, 7.10, 8.4–8.5, 9.5, 10.5–10.8, 14, 17, and 19.

## Global Constraints

- Never use ports 3000 or 3001; local Orbit runs on web 3100 and API 3101.
- Leads belong to exactly one profile and have exactly one owner BD.
- The creating/assigned BD becomes the owner; only Admin can transfer ownership.
- Only active BDs assigned to a profile may create leads for it.
- Only Admin or the lead owner may edit lead fields/status/important state.
- Closers see only explicitly assigned interview-stage context; this slice exposes no pre-interview closer lead data.
- Canonical URL duplicates are rejected for non-archived leads within the same profile.
- Closure/status changes require a reason where the design requires one and always preserve transition history.
- Archive/restore is reversible and audited; no destructive lead deletion.
- Every write validates shared schemas and uses optimistic `version` checks.

### Task 1: Company, Contact, and Lead Persistence/Contracts

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260902110000_companies_contacts_leads/migration.sql`
- Create: `packages/contracts/src/leads.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/profiles.ts`
- Test: `packages/database/src/leads-persistence.test.ts`
- Test: `packages/contracts/src/leads.test.ts`

**Interfaces:**
- Company fields: canonical name, website/domain, industry, location, timestamps.
- Contact fields: company, name, title, email, phone, LinkedIn URL, notes.
- Lead fields: profile, company/contact references, owner BD, optional responsible Closer, title/description, raw/canonical URL/hash, location/workplace/employment/contract data, compensation range, applied date, status, important flag, closure/archive/start fields, and version.
- Statuses: `APPLIED`, `RESPONSE_RECEIVED`, `INTERVIEWING`, `OFFER_RECEIVED`, `OFFER_ACCEPTED`, `PLACED`, `STARTED`, `CLOSED`.
- Contracts include company/contact CRUD inputs, `createLeadSchema`, `updateLeadSchema`, `leadListQuerySchema`, `leadStatusTransitionSchema`, ownership/closer/archive commands, and typed summaries/details.

- [ ] Write failing contract tests for URL canonicalization inputs, required profile/company/owner fields, status/reason rules, and invalid compensation/date values.
- [ ] Run the focused contract test and confirm failure.
- [ ] Add Prisma models/relations/indexes and a forward migration that preserves existing JobLead rows by backfilling company data where needed.
- [ ] Add shared schemas/types and export them.
- [ ] Add persistence tests for company/contact relations, profile-scoped canonical duplicates, transition/assignment history, and archive flags.
- [ ] Run Prisma validation/generation and focused tests.
- [ ] Commit `feat: add company contact and lead persistence`.

### Task 2: Lead Services and Authorization

**Files:**
- Create: `packages/backend/src/leads/leads.service.ts`
- Create: `packages/backend/src/leads/leads.service.test.ts`
- Modify: `packages/backend/src/index.ts`

**Interfaces:**
- `listCompanies(actor, query)`, `createCompany(actor, input)`, `updateCompany(actor, id, input, expectedVersion)`
- `listContacts(actor, companyId, query)`, `createContact(actor, companyId, input)`, `updateContact(actor, id, input, expectedVersion)`
- `listLeads(actor, query)`, `createLead(actor, profileId, input)`, `getLead(actor, leadId)`, `updateLead(actor, leadId, input, expectedVersion)`
- `transitionLead(actor, leadId, toStatus, reason, expectedVersion)`, `transferOwnership(actor, leadId, newOwnerId, reason, expectedVersion)`, `assignCloser(actor, leadId, closerId)`, `setImportant(actor, leadId, important, expectedVersion)`, `archiveLead(actor, leadId, reason, expectedVersion)`, `restoreLead(actor, leadId, expectedVersion)`

- [ ] Write service tests for Admin, profile-assigned owner BD, assigned non-owner BD, unassigned BD, Closer, inactive actor, duplicate URL, invalid transitions, ownership transfer, closer eligibility, and version conflicts.
- [ ] Run the focused service tests and confirm failure.
- [ ] Implement canonicalization, scoped queries, role/ownership checks, transition matrix, required reasons, transactional audit/history records, and Prisma conflict mapping.
- [ ] Run service tests, backend typecheck, and lint.
- [ ] Commit `feat: add lead pipeline services`.

### Task 3: Lead API

**Files:**
- Create: `apps/api/src/modules/leads/leads.controller.ts`
- Create: `apps/api/src/modules/leads/leads.module.ts`
- Create: `apps/api/src/modules/leads/leads.controller.test.ts`
- Create: `apps/api/src/modules/leads/leads.e2e.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- `GET/POST/PATCH /companies` and `GET/POST/PATCH /companies/:companyId/contacts`
- `GET /leads`, `GET /leads/table`, `GET /leads/search`, `GET /leads/duplicates`
- `POST /profiles/:profileId/leads`
- `GET/PATCH /leads/:leadId`
- `POST /leads/:leadId/status-transitions`
- `POST /leads/:leadId/ownership-transfers`
- `POST /leads/:leadId/closer-assignments`
- `POST/DELETE /leads/:leadId/important`
- `POST /leads/:leadId/archive|restore`

- [ ] Add controller tests for authentication, validation, trusted Origin on mutations, envelopes, and status/error mapping.
- [ ] Add API E2E tests for lead creation, duplicate rejection, scoped BD access, status transitions, ownership transfer, closer assignment, and archive/restore.
- [ ] Implement thin handlers using shared schemas and service methods.
- [ ] Run API tests, typecheck, lint, and diff check.
- [ ] Commit `feat: expose lead pipeline api`.

### Task 4: Lead Workspace UI

**Files:**
- Create: `apps/web/app/leads/page.tsx`
- Create: `apps/web/app/leads/[leadId]/page.tsx`
- Create: `apps/web/components/leads/lead-table.tsx`
- Create: `apps/web/components/leads/lead-form.tsx`
- Create: `apps/web/components/leads/lead-detail.tsx`
- Create: `apps/web/components/leads/company-contact-form.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/lib/api-client.ts`
- Test: `apps/web/components/leads/*.test.tsx`
- Test: `apps/web/e2e/leads.spec.ts`

- [ ] Add typed client methods and response parsing for company/contact/lead endpoints.
- [ ] Build profile-filtered lead table with status/important/owner columns, search, empty/loading/error states, and profile/lead links.
- [ ] Build lead creation/detail forms with status transitions, important toggle, archive/restore, and ownership/Closer controls gated by role.
- [ ] Add Playwright smoke for Admin/BD lead creation and scoped list/detail behavior.
- [ ] Run web tests, lint, typecheck, and Playwright smoke on 3100/3101.
- [ ] Commit `feat: add lead pipeline workspace`.

### Task 5: Documentation and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/local-development.md`
- Modify: `docs/architecture/foundation.md`
- Modify: `docs/verification/foundation.md`
- Test: `packages/testing/src/documentation.test.ts`

- [ ] Document company/contact/lead workflow, duplicate URL behavior, status transitions, and role boundaries.
- [ ] Run the full focused verification suite, Prisma migration deploy on the local database, authenticated API/UI smoke, and final diff check.
- [ ] Record remaining modules: communications/comments, bulk imports, interviews/availability, documents/files, tasks/notifications, offers/placements, analytics/exports, and production hardening.
- [ ] Commit `docs: document lead pipeline workflow`.
