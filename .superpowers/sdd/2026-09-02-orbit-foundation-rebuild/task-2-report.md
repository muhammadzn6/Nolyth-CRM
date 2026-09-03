# Task 2 Report: Local infrastructure and environment configuration

## Delivered

- Added Zod-backed `loadServerEnv` and `loadWebEnv` parsers with typed camelCase outputs and clear validation errors.
- Kept server-only values out of `WebEnv`; browser configuration reads only `NEXT_PUBLIC_APP_BASE_URL`.
- Made API and worker entrypoints validate server configuration at startup.
- Added `.env.example` with local PostgreSQL, Redis, MinIO, API, and browser settings.
- Added `docker-compose.yml` with PostgreSQL on `5432`, Redis on `6379`, MinIO on `9000`/`9001`, health checks, and named data volumes.
- Added Zod to `@orbit/config` and refreshed `pnpm-lock.yaml`.

## Verification

- `npx --yes pnpm@10.15.1 exec vitest run packages/config/src/env.test.ts` — 4 tests passed.
- `npx --yes pnpm@10.15.1 typecheck` — 9 workspace tasks passed.
- `npx --yes pnpm@10.15.1 test` — 14 workspace tasks passed.
- `npx --yes pnpm@10.15.1 lint` — 9 workspace tasks passed.
- `docker compose config` — valid configuration; all requested services, ports, health checks, and named volumes present.
- `git diff --check` — clean.

## Scope and concerns

- No database schema, worker processing, migrations, bucket initialization, or application behavior was added.
- API and worker startup now intentionally fail fast when any required server variable is missing or invalid.
- Compose uses fixed local credentials from `.env.example`; these are for local development only and must not be reused in deployed environments.

## Fix-round follow-up

- Restricted `DATABASE_URL` validation to well-formed `postgres://` and `postgresql://` URLs.
- Added a regression test proving an `https://` database URL is rejected.
- Aligned `.env.example` `S3_SECRET_KEY` with the local MinIO `MINIO_ROOT_PASSWORD` (`orbit-secret`) in `docker-compose.yml`.

## Fix-round verification

- `npx --yes pnpm@10.15.1 exec vitest run packages/config/src/env.test.ts` — 5 tests passed.
- `npx --yes pnpm@10.15.1 test` — 14 workspace tasks passed.
- `npx --yes pnpm@10.15.1 typecheck` — 9 workspace tasks passed.
- `npx --yes pnpm@10.15.1 lint` — 9 workspace tasks passed.
- `docker compose config` — valid configuration; local MinIO credentials remain aligned.
- `git diff --check` — clean.
