# Job Placement CRM Phase 1 Design

## Scope

This document defines Phase 1 of an internal Job Placement / Lead Management CRM for a staffing company. Phase 1 delivers the application foundation only: project setup, MongoDB and Mongoose integration, Auth.js authentication, role-based authorization, core schemas, service-layer mutations and queries, thin route handlers, centralized activity events, base UI primitives, authenticated shell pages, development seed data, and tests for critical business rules.

This phase explicitly excludes the detailed lead spreadsheet workspace, Kanban board, advanced interview workflow UI, analytics dashboard, advanced search UI, and all other later-phase product features.

## Product Model

The system centers on a `Profile`, which represents a candidate whose job applications are being managed.

The Phase 1 hierarchy is:

- `Profile`
- one assigned `BD`
- one assigned `Closer`
- many `JobLead`

Assignments are intentionally singular in V1. The schema and service boundaries should be clean enough to evolve later, but the implementation should enforce exactly one BD and one Closer per Profile today.

## Technical Approach

The application will be a single Next.js project using the App Router. Backend APIs will be implemented with Next.js Route Handlers running on the Node.js runtime so Mongoose can be used safely. UI pages will be React Server Components by default, with Client Components reserved for interactive controls such as forms, navigation toggles, and sign-in actions.

The backend architecture will follow a layered flow:

1. UI page or form
2. Route Handler
3. Authentication + authorization guard
4. Zod validation
5. Service function
6. Mongoose model
7. MongoDB

Route Handlers remain thin. Business rules such as assignment validation, role checks, dead-lead enforcement, interview round sequencing, and activity creation live in the service and authorization layers.

## Authentication

Authentication will use Auth.js with a credentials provider backed by MongoDB users stored in Mongoose. Passwords are hashed with `bcryptjs`. Sessions use the JWT strategy so the authenticated user's id, role, name, email, and `isActive` status are available server-side without trusting any client-supplied values.

Phase 1 user provisioning will be admin-driven. An admin creates users with an initial password through the admin API. This keeps the authentication flow self-contained and easy to verify without adding password reset workflows in this phase.

Inactive users are rejected during authentication and on subsequent session access. If a user's account is deactivated after login, server-side session checks invalidate normal access.

## Authorization

Authorization is centralized in reusable server utilities rather than scattered role checks.

Core rules:

- `ADMIN` can manage users, create and update profiles, view all profiles, view all leads, and view all activity.
- `BD` can access only profiles assigned to them via `assignedBD`.
- `CLOSER` can access only profiles assigned to them via `assignedCloser`.
- `BD` and `ADMIN` can create leads for accessible profiles in Phase 1.
- `BD`, `CLOSER`, and `ADMIN` can update leads only when they have profile access and the field-level mutation is allowed by service rules.
- Activity events are immutable from ordinary APIs.

Access helpers should include:

- `requireUser()`
- `requireActiveUser()`
- `requireAdmin()`
- `canAccessProfile()`
- `requireProfileAccess()`
- `canCreateLeadForProfile()`
- `requireLeadAccess()`

These helpers will be used by both pages and APIs.

## Domain Models

### User

Fields:

- `name`
- `email`
- `passwordHash`
- `role`
- `isActive`
- `createdAt`
- `updatedAt`

Constraints:

- email is unique and normalized
- role is a controlled enum: `ADMIN`, `BD`, `CLOSER`

### Profile

Fields:

- `name`
- `assignedBD`
- `assignedCloser`
- `isActive`
- `createdBy`
- `createdAt`
- `updatedAt`

Service rules:

- `assignedBD` must reference an active user whose role is `BD`
- `assignedCloser` must reference an active user whose role is `CLOSER`

### JobLead

Fields:

- `profileId`
- `createdBy`
- `updatedBy`
- `companyName`
- `jobTitle`
- `jobUrl`
- `jobDescription`
- `recruiterName`
- `recruiterContact`
- `rateAmount`
- `rateUnit`
- `contractType`
- `jobType`
- `status`
- `appliedDate`
- `deadReason`
- `deadNotes`
- `isImportant`
- `createdAt`
- `updatedAt`

Default rules:

- `status` defaults to `APPLIED`
- `appliedDate` defaults to current date/time
- `isImportant` defaults to `false`

Validation rules:

- `companyName` is required
- `jobUrl` is required and validated as a URL
- `deadReason` is required when status is `DEAD`
- `deadReason` should be cleared when status is not `DEAD`

### InterviewRound

Interview rounds will use a separate collection rather than embedded subdocuments.

Reasoning:

- rounds are mutable over time by both BD and Closer
- round activity needs its own query and audit trail
- future filtering and pagination by lead is cleaner with a separate collection
- it avoids rewriting the full lead document for round updates

Fields:

- `leadId`
- `profileId`
- `roundNumber`
- `roundType`
- `scheduledAt`
- `interviewerName`
- `meetingLink`
- `result`
- `notes`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

Service rules:

- round numbers are assigned by the service based on the current highest round for the lead
- only accessible profile members can create or update rounds

### ActivityEvent

There is a single immutable activity collection for all audit use cases.

Fields:

- `actorId`
- `actorNameSnapshot`
- `actorRoleSnapshot`
- `profileId`
- `leadId`
- `entityType`
- `entityId`
- `action`
- `oldValue`
- `newValue`
- `metadata`
- `createdAt`

This structure supports:

- lead-level views by filtering `leadId`
- profile-level views by filtering `profileId`
- platform-level views by omitting entity filters
- actor-based views by filtering `actorId`

Activity events are created server-side from service mutations and not directly writable by ordinary users.

## Activity Consistency Strategy

Mutating services that change profiles, leads, interview rounds, or users will create activity events in the same service flow. For important multi-document writes, the service will use MongoDB sessions and transactions when available so the business mutation and activity event creation succeed or fail together.

The transaction pattern will be applied to:

- profile creation and profile updates that change assignments
- lead creation and updates
- interview round creation and updates
- user creation and admin user changes

This keeps audit creation close to the mutation and avoids trusting downstream asynchronous handlers in Phase 1.

## Validation and Error Handling

Zod will validate request payloads, route params, enums, ObjectIds, emails, URLs, and numeric rate values. Route Handlers will whitelist input through specific schemas and never pass raw request bodies directly into Mongoose create or update operations.

Custom application errors will standardize responses:

- `AuthenticationError`
- `AuthorizationError`
- `ValidationError`
- `NotFoundError`
- `ConflictError`
- `InternalServerError`

Route handlers return a consistent JSON envelope:

- success: `{ success: true, data: ... }`
- error: `{ success: false, error: { code, message } }`

## API Surface

Phase 1 routes will include:

- Auth.js auth endpoints
- `GET /api/users`
- `POST /api/users`
- `GET /api/profiles`
- `POST /api/profiles`
- `GET /api/profiles/[profileId]`
- `PATCH /api/profiles/[profileId]`
- `GET /api/profiles/[profileId]/leads`
- `POST /api/profiles/[profileId]/leads`
- `GET /api/leads/[leadId]`
- `PATCH /api/leads/[leadId]`
- `GET /api/profiles/[profileId]/activity`
- `GET /api/leads/[leadId]/activity`
- `GET /api/activity`

Interview round APIs are not required for full UI coverage in this phase, but the model, service layer, and audit wiring should be ready so the next phase can expose them safely.

## UI Foundation

Phase 1 UI will provide:

- login page
- authenticated app shell
- sidebar navigation
- profile list page
- activity page
- admin user page
- admin profile page
- basic profile detail page with simple lead list
- empty, loading, and error states

The visual system will be a restrained light theme with dense, readable enterprise styling. Shared tokens and components will cover buttons, inputs, selects, badges, cards, tables, skeletons, empty states, page headers, and layout containers. The design will favor subtle borders, compact typography, and predictable spacing over marketing-style visuals.

## Indexing Strategy

Indexes will be added only for real Phase 1 access patterns.

Planned indexes:

- `User.email` unique
- `Profile.assignedBD + isActive`
- `Profile.assignedCloser + isActive`
- `JobLead.profileId + status + appliedDate`
- `JobLead.profileId + isImportant + appliedDate`
- `JobLead.profileId + createdAt`
- `JobLead.jobUrl`
- `JobLead.companyName`
- `InterviewRound.leadId + roundNumber` unique
- `ActivityEvent.leadId + createdAt`
- `ActivityEvent.profileId + createdAt`
- `ActivityEvent.actorId + createdAt`
- `ActivityEvent.action + createdAt`
- `ActivityEvent.createdAt`

Text search infrastructure beyond pragmatic indexed fields is deferred.

## Seed Data

A manual seed script will create:

- one admin user
- one BD user
- one closer user
- two sample profiles
- several sample leads spanning `APPLIED`, `IN_PROCESS`, `FINAL_ROUND`, `CLOSED`, and `DEAD`
- activity events resulting from service-created mutations

The script will document development credentials and will never run automatically in production.

## Testing Strategy

Phase 1 tests will focus on service-layer business rules and access boundaries rather than shallow component coverage.

Key tests:

- admin can retrieve all profiles
- BD only receives assigned profiles
- Closer only receives assigned profiles
- unauthorized users cannot access unrelated profiles
- profile assignments reject wrong roles
- new leads default to `APPLIED`
- new leads receive `appliedDate`
- new leads are bound to the correct profile
- dead leads require `deadReason`
- unauthorized users cannot mutate leads
- activity events are created on key mutations
- platform activity access is admin-only

## Environment

Required environment variables:

- `MONGODB_URI`
- `AUTH_SECRET`
- `AUTH_URL` or `NEXTAUTH_URL` depending on current Auth.js conventions

Optional development seed variables may include a flag to confirm destructive reseeding behavior, but production secrets must never be committed.

## Out of Scope

This phase intentionally does not implement:

- detailed lead spreadsheet workspace
- Kanban board
- interview workflow screens
- advanced search UI
- analytics dashboard
- reminders or follow-ups
- notifications
- external integrations
- candidate or recruiter portals
- multi-tenancy
- multiple BDs or closers per profile

## Possible Future Considerations

- field-level lead mutation policies by role once the detailed workspace exists
- search endpoints built on indexed MongoDB queries
- password reset and invite flows
- more granular activity metadata snapshots for richer diffs
