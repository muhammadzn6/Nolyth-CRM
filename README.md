# Orbit CRM foundation

Orbit is a TypeScript modular-monolith foundation for an internal job-placement CRM. The active workspace contains a Next.js web app, NestJS API, BullMQ worker, PostgreSQL/Prisma persistence, Redis, and S3-compatible local object storage.

This repository is a runnable foundation, not the complete CRM described by the approved target-state design. See [Current scope](#current-scope) before treating a screen, schema, or API as product-complete.

## Prerequisites

- Node.js 20.9 or newer
- pnpm 10.15.1 (the version pinned in `package.json`)
- Docker with Docker Compose

## Local setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env
set -a
source .env
set +a
docker compose up -d
pnpm db:generate
pnpm db:migrate
export ORBIT_SEED_ADMIN_PASSWORD='choose-a-local-password'
pnpm db:seed
pnpm dev
```

Open `http://localhost:3100/login` and sign in as `admin@orbit.local` with the password supplied to `ORBIT_SEED_ADMIN_PASSWORD`. The seed rotates that local admin password every time it runs; no shared password is committed.

After the first admin is seeded, all normal user provisioning is admin-invitation based:

1. Sign in as `admin@orbit.local`.
2. Open `http://localhost:3100/admin/users`.
3. Create a teammate with a display name, work email, role (`ADMIN`, `BD`, or `CLOSER`), and timezone.
4. Copy the one-time invitation URL shown after creation and send it out of band.
5. The teammate opens `/invite/<token>`, chooses their own password, and then signs in.
6. Administrators can return to `/admin/users` to change roles/timezones, deactivate or reactivate accounts, and revoke a user’s active sessions.

Invitation tokens are shown only once, expire, are single-use, and are stored only as hashes. The seed remains only the bootstrap path for the first local administrator.

The local endpoints are:

| Boundary | Address |
|---|---|
| Web | `http://localhost:3100` |
| API | `http://localhost:3101/api/v1` |
| API liveness | `http://localhost:3101/health/live` |
| API readiness | `http://localhost:3101/health/ready` |
| PostgreSQL | `localhost:55432` |
| Redis | `localhost:6379` |
| MinIO API / console | `localhost:9000` / `localhost:9001` |

## Common scripts

```bash
pnpm dev                 # web, API, and worker together
pnpm dev:web             # Next.js only
pnpm dev:api             # NestJS API only
pnpm dev:worker          # BullMQ worker only
pnpm build               # workspace compilation and Next.js production build
pnpm format:check        # whitespace and conflict-marker integrity
pnpm lint
pnpm typecheck
pnpm test                # includes the guarded PostgreSQL persistence suite
pnpm test:e2e:services   # API and worker E2E checks
pnpm test:e2e:smoke      # Playwright foundation and user-management smoke
pnpm test:e2e            # services first, then browser smoke
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
```

Server processes read variables from their process environment. Run the `set -a` / `source .env` sequence in each new shell before starting the API, worker, migrations, seed, or smoke suite. Next.js also reads its environment files, but the other runtimes do not implicitly load them.

### BD performance browser checks

Use a disposable local database for performance browser checks. `pnpm db:seed:demo` fails closed unless `DATABASE_URL` names `orbit_task3_test` or `orbit_e2e`. For an intentional non-production exception only, set `ORBIT_ALLOW_DEMO_SEED=true`; the command always refuses when `NODE_ENV=production`. Never point these commands at a shared local database. Start the local stack only on web port `3100` and API port `3101`; do not use `3000` or `3001`, which may belong to other services.

```bash
set -a
source .env
set +a
export DATABASE_URL='postgresql://orbit:orbit@localhost:55432/orbit_e2e'
export ORBIT_SEED_ADMIN_PASSWORD='choose-a-local-admin-password'
export ORBIT_DEMO_PASSWORD='choose-a-local-demo-password'
pnpm db:migrate
pnpm db:seed
pnpm db:seed:demo
API_PORT=3101 PORT=3100 node scripts/start-foundation.mjs
```

In a second terminal, using the same exported environment:

```bash
ORBIT_E2E_ADMIN_PASSWORD="$ORBIT_SEED_ADMIN_PASSWORD" \
ORBIT_E2E_BD_PASSWORD="$ORBIT_DEMO_PASSWORD" \
ORBIT_E2E_WEB_ORIGIN=http://localhost:3100 \
ORBIT_E2E_API_ORIGIN=http://localhost:3101 \
pnpm --filter @orbit/web test:e2e -- e2e/bd-performance.spec.ts e2e/admin-bd-performance.spec.ts e2e/duplicate-review.spec.ts
```

The local Admin account is `admin@orbit.local` and uses the value you supply through `ORBIT_SEED_ADMIN_PASSWORD`. The disposable demo BD account is `maya.bd@orbit.local` and uses `ORBIT_DEMO_PASSWORD`. These passwords are intentionally not committed, and the demo seed must not be used in production. Browser screenshots, traces, and failure artifacts are written under `output/playwright/`.

## Verification

The full local verification order and disposable-database guard are documented in [Foundation verification](docs/verification/foundation.md). `pnpm test` owns the destructive persistence suite and requires the disposable `orbit_task3_test` database. `pnpm test:e2e` does not run that suite: it runs API/worker checks first, then starts all three runtime processes on isolated ports `3100` and `3101` for the Playwright login, liveness, seeded-authenticated-shell, and admin user-management smoke. Do not point the smoke at ports `3000` or `3001`; those are the default developer ports and may already be serving unrelated local processes.

CI performs a frozen install, Prisma generation/validation, whitespace integrity, lint, strict type checking, unit and live PostgreSQL integration tests, migrations, workspace build, API/worker E2E checks, seed, and the Chromium foundation smoke. The destructive database suite and browser smoke are separate workflow steps, and CI uses only disposable credentials and data.

## Architecture and operations

- [Foundation architecture](docs/architecture/foundation.md)
- [Local-development runbook](docs/runbooks/local-development.md)
- [Foundation security boundary](docs/security/foundation.md)
- [Foundation verification](docs/verification/foundation.md)

## Current scope

Implemented now:

- pnpm/Turborepo workspace with web, API, worker, and focused shared packages
- validated server/browser configuration and local PostgreSQL, Redis, and MinIO services
- initial Prisma schema, forward-only migrations, transaction helper, and guarded admin seed
- shared Zod contracts and application errors
- Argon2id login, hashed cookie sessions, logout, active-user checks, and basic role/profile authorization services
- admin user management with hashed one-time invitations, invitation acceptance, role/activation updates, and session revocation
- candidate records, multiple job-search profiles, BD assignments, Closer eligibility, lifecycle controls, and role-scoped profile workspace
- request IDs, strict API validation/error handling, security headers, CORS, and live/ready health routes
- responsive role-aware web shell and typed API client
- transactional outbox service, BullMQ worker runtime, retries, lease recovery, dead-letter behavior, and local no-op provider ports
- focused unit/API/integration tests and foundation CI/smoke coverage

Remaining target-domain work is explicitly not implemented by this foundation: password reset/change and resend-invitation flows; companies, contacts, and lead operations; documents/files and malware scanning; interviews, availability, and scheduling; tasks and notifications; offers, placements, analytics, and exports; broader admin/archive workflows; OpenAPI generation; production provider adapters; observability; deployment images; security hardening; scale testing; backup/restore; and launch/UAT.

Some prototype source still exists at the repository root. It is not part of the `apps/*` and `packages/*` runtime graph and must not be used as evidence that a target-domain feature is implemented.
