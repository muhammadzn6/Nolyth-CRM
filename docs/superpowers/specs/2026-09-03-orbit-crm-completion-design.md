# Orbit CRM Completion Design

**Status:** Approved for specification; implementation begins after spec review.

**Goal:** Complete the functional Orbit CRM MVP while preserving the existing modular monolith, role boundaries, and local ports; production hardening is deferred.

## Scope

This design covers the remaining work grouped into independently testable sub-projects:

1. Workflow user interfaces: lead detail, profile sections, interviews, tasks, offers, placements, and availability.
2. Data movement: validated bulk imports and CSV exports.
3. Audit and notifications: activity events for mutations and document notifications.
4. Authentication completion: password reset/change and invitation resend.
5. API contracts: OpenAPI output and generated typed client.
6. Browser verification: critical role-based E2E journeys.

Deferred until after the functional MVP: file upload behavior, observability, rate limiting, malware scanning, backup/restore, deployment, production email/storage providers, and other production hardening.

Production-only integrations will have explicit interfaces, local adapters, configuration validation, and failure tests. They will not claim production verification without provider credentials.

## Existing Boundaries

- Web: Next.js App Router in `apps/web`, served locally on port `3100`.
- API: NestJS modular monolith in `apps/api`, served locally on port `3101`.
- Domain services/contracts: `packages/backend` and `packages/contracts`.
- Persistence: PostgreSQL/Prisma in `packages/database`, using host port `55432` locally.
- Async processing: BullMQ worker in `apps/worker`, Redis on `6379`.
- Object storage: S3-compatible MinIO locally on `9000`; server-only credentials.
- Authentication: cookie-backed sessions with Admin, BD, and Closer roles.
- Concurrency: optimistic `version` fields on mutable entities.

Ports `3000` and `3001` are reserved for unrelated services and must not be started, stopped, or reconfigured.

## Architecture Decisions

### Workflow UI

Use server-rendered route pages for initial data and focused client components for mutations. Existing API client functions remain the browser/server boundary; no global state library is added. Profile section navigation becomes real routes under `/profiles/[profileId]/...`, with the profile access check enforced by the API on every request.

Lead detail owns lead lifecycle, collaboration, offers, and related activity. Calendar owns interview scheduling. Tasks owns open/completed/canceled work. Profile documents remain the source for file operations. Analytics remains read-only.

### Imports and exports

Imports use a preview/commit flow. The preview parses bounded CSV input, validates every row against contracts, reports row-level errors, and does not write data. Commit accepts a preview token or deterministic import key and writes only valid, explicitly confirmed rows. Exports are role-scoped server-generated CSV streams with fixed columns and no arbitrary query execution.

### Audit and notifications

Every domain mutation emits one activity event with actor snapshot, entity, before/after metadata where safe, and request ID. Notification creation uses idempotent keys. Synchronous business writes and outbox records share a transaction where the existing service boundary supports it; provider delivery is asynchronous and retryable.

### Authentication

Password reset uses single-use, hashed, expiring tokens and never reveals whether an email exists. Password change requires an authenticated current password and revokes other sessions. Invitation resend rotates the prior invitation token and keeps only a bounded active invitation state.

### API contracts

OpenAPI is generated from the NestJS route contract and Zod schemas at build time. The generated client is derived from the checked-in contract, not handwritten independently. API errors retain the existing envelope, request ID, and stable error codes.

### Deferred production hardening

These concerns are intentionally deferred until after the functional MVP. Existing health checks and basic security headers remain in place.

## Security and Reliability Invariants

- API authorization is the source of truth; frontend role checks are only UX.
- No object-storage, email, or scanner secret reaches browser code or logs.
- CSV imports have maximum file size, row count, field length, and error-count limits.
- Idempotency keys are required for retried imports, notifications, and provider side effects.
- Mutations use optimistic versions and return a conflict when the submitted version is stale.
- External provider calls have timeouts, bounded retries, and no retry for validation/auth failures.
- Health endpoints do not disclose secrets or PII.

## Verification Criteria

Completion requires:

- Unit and integration tests for every new contract, authorization rule, mutation, import/export parser, provider adapter, and retry path.
- Prisma validation and disposable migration reset using `orbit_task3_test`.
- API, backend, worker, and web typechecks plus lint.
- Browser E2E coverage for Admin, BD, and Closer login/role scope; lead lifecycle; interview scheduling; task completion; document upload/download; offer-to-placement; import preview/commit; and password recovery.
- Local health checks on `3100`, `3101`, Redis, PostgreSQL, and MinIO without using `3000` or `3001`.
- Production hardening is explicitly out of scope for this MVP and will be handled in a later phase.

## Delivery Order

Implement in this order so each stage produces a usable product:

1. Lead/profile workflow routes and mutation UI.
2. Interviews, tasks, offers, placements, and availability UI.
3. Import preview/commit and CSV exports.
4. Complete audit event generation and document notifications.
5. Password and invitation lifecycle.
6. OpenAPI and generated client.
7. Full browser E2E and final verification.

## Explicit Non-Goals

- No microservices split.
- No new frontend state-management framework.
- No arbitrary user-defined SQL/report builder.
- No production deployment or external provider activation without credentials and an approved target environment.
- File upload behavior and production hardening are deferred until after the functional MVP.
