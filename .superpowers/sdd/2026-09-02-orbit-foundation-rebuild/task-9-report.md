# Task 9 report — CI, documentation, and foundation verification

## Delivered

- Added GitHub Actions foundation CI with a frozen pnpm install, disposable PostgreSQL/Redis services, Prisma generation/validation/migration/seed, formatting integrity, lint, strict typecheck, tests, workspace build, Chromium installation, and API/browser E2E execution.
- Replaced the obsolete MongoDB prototype README with truthful pnpm/PostgreSQL/Prisma setup, runtime commands, ports, seed behavior, verification links, and explicit current-versus-target scope.
- Added architecture, local-development, security-boundary, and verification documentation. Remaining target-domain, hardening, deployment, observability, scale, backup/recovery, and UAT work is clearly labeled as unimplemented.
- Added Playwright configuration and smoke coverage for the login route, API liveness, and seeded authenticated Admin shell. The smoke launcher starts web, API, and worker together through package-local binaries on isolated ports.
- Replaced the web E2E placeholder with Playwright, added direct root database wrappers, per-runtime development scripts, formatting integrity, Playwright artifact ignores, and Vitest exclusion for Playwright specs.
- Added an `API_PORT` override for isolated smoke orchestration while preserving the existing `PORT`/3001 behavior.
- Added the missing standard success envelope at the Nest API boundary so the live API matches shared contracts and the typed web client.

## TDD evidence

- Documentation RED: `packages/testing/src/documentation.test.ts` failed because the prior README omitted the canonical pnpm/Compose/Prisma commands.
- Port isolation RED: `apps/api/src/main.test.ts` failed 2/2 because `resolveApiPort` did not exist.
- Success-envelope RED: the focused health test failed because liveness returned raw `{ status: "ok" }` instead of the shared `{ success, data, meta.requestId }` contract.
- Focused GREEN: API bootstrap/health, identity E2E, port configuration, and documentation tests passed 4 files and 17/17 tests.

## Verification completed

- `docker compose config --quiet` — PASS.
- `docker compose up -d` — PASS; PostgreSQL, Redis, and MinIO reported healthy at inspection time.
- Prisma client generation — PASS.
- Prisma schema validation — PASS.
- Manual local-binary TypeScript checks for all nine workspace projects — PASS before the final API-envelope change; API and web were rerun after that change and passed.
- Broad local-binary ESLint over `apps`, `packages`, and the smoke launcher — exit 0; a separately included Vitest config path produced one non-failing “no matching configuration” warning. Final targeted Task 9 lint passed without output.
- Focused final tests — PASS: 4 files, 17 tests.
- CI workflow YAML parse — PASS.
- Changed package-manifest JSON parse — PASS.
- `git diff --check` — PASS before the final focused integration/report append.
- The tracked historical design hash remained `07cd91d68180201626726429e130553a1586e194d92a6c44495ca652d74d1a22` at final inspection.
- The approved target design hash remained `dea4cd953a609eebeb2b122c3c194c51d15dacab45405c9ad1f6c47e865adf20` at final inspection.

## Exact limitations

- `pnpm install --frozen-lockfile` was not runnable because neither pnpm nor Corepack is installed in this shell (`command not found`). The lockfile was updated only for the already-resolved RxJS package used by Nest.
- Root Turbo lint/typecheck orchestration was blocked because Turbo could not locate the package-manager binary. Equivalent underlying local binaries were used as described above.
- The broad Vitest run was interrupted by the user after approximately five seconds and produced no valid suite result. Remaining worktree Vitest processes were terminated.
- Per the final user instruction, no production build or final Playwright browser smoke was run, and no further broad checks were attempted.
- Database migration and seed were not rerun during the final bounded pass.
- CI has been configured but was not executed in GitHub Actions from this environment.
- Existing unrelated Playwright MCP browser processes were not stopped or modified.

## Commit-focused correction pass

- Added explicit Nest injection tokens for `IdentityService` and `SessionService`. This preserves dependency resolution when the focused Vitest/Nest testing module does not provide reliable reflected constructor tokens for imported workspace classes.
- Aligned the smoke test's fallback API origin with the Playwright launcher's isolated API port (`3101`) and changed Playwright workspace-root resolution to the CommonJS-compatible `__dirname` form used by the config loader.
- Followed the bundled Next.js 16.3.3 TypeScript guide by ignoring and untracking generated `apps/web/next-env.d.ts`. The web typecheck passed from source without that generated shim.
- Preserved the Next-generated `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` files because the installed Next generator and repository-level instruction both state that development regenerates them and that committing them keeps the worktree clean.
- Removed only the ignored Playwright `test-results/.last-run.json` marker. No `.next` build/development output or unrelated browser process was removed.

### Bounded verification

- `./node_modules/.bin/vitest run apps/api/src/modules/identity/identity.e2e.test.ts apps/api/src/main.test.ts apps/api/src/modules/health/health.controller.test.ts packages/testing/src/documentation.test.ts` — PASS, 4 files and 17/17 tests.
- `./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json` — PASS.
- `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` — PASS with `apps/web/next-env.d.ts` absent.
- `./node_modules/.bin/eslint --config eslint.config.mjs apps/api/src/modules/identity/identity.controller.ts apps/api/src/modules/identity/identity.guard.ts apps/web/e2e/smoke.spec.ts apps/web/playwright.config.ts` — PASS.
- `git diff --check` — PASS before this report update.

### Correction-pass limitations

- Per the commit-focused instruction, this pass did not run Playwright, a production build, root Turbo orchestration, repository-wide Vitest/typecheck/lint, Docker/Compose, Prisma migration/seed, or GitHub Actions.
- The authenticated shell, browser startup orchestration, and live PostgreSQL/Redis integration therefore retain the earlier Task 9 evidence and CI configuration; this correction pass adds no fresh runtime-browser or database evidence.

## Final review correction — deterministic E2E integration

- Root cause: `pnpm test:e2e` expanded to an unconstrained Turbo fan-out across all nine workspaces. Six shared-package E2E scripts re-ran the root Vitest configuration, including the schema-rebuilding PostgreSQL persistence suite, concurrently with Playwright against the same inherited `DATABASE_URL`. This could delete the seeded admin in CI and rejected the documented local `orbit` database through the persistence-suite guard.
- Root E2E now has two explicit ordered stages: API/worker checks, then web Playwright smoke. Shared packages, including `@orbit/database`, are excluded from both E2E stages; the destructive persistence suite remains under `pnpm test` with its existing `orbit_task3_test` guard.
- CI mirrors the split with separate API/worker and browser steps and seeds the administrator immediately before browser smoke.
- README, foundation verification, and the local-development runbook now distinguish the disposable database used by `pnpm test` from the migrated and seeded normal local `orbit` database used by `pnpm test:e2e`.

### Regression evidence

- RED: `./node_modules/.bin/vitest run packages/testing/src/workspace.test.ts` — FAIL, 1/3 tests, because root `test:e2e` was the unconstrained `turbo run test:e2e` command.
- GREEN: the same command — PASS, 3/3 tests, after adding the ordered service/smoke script contract.
- `./node_modules/.bin/turbo run test:e2e --filter=@orbit/api --filter=@orbit/worker --dry=text` — PASS; only `@orbit/api` and `@orbit/worker` were in scope.
- `./node_modules/.bin/turbo run test:e2e --filter=@orbit/web --dry=text` — PASS; only `@orbit/web` was in scope.

### Bounded verification

- `../../node_modules/.bin/vitest run --config vitest.e2e.config.ts` from `apps/api` — PASS, 5 files and 30/30 tests; Vite emitted its pre-existing future native-config-loader warning.
- `../../node_modules/.bin/vitest run --config vitest.e2e.config.ts` from `apps/worker` — PASS, 3 files and 10/10 tests; the same Vite warning was emitted.
- `./node_modules/.bin/vitest run packages/testing/src/documentation.test.ts packages/testing/src/workspace.test.ts` — PASS, 2 files and 4/4 tests.
- Focused ESLint for `packages/testing/src/workspace.test.ts` and TypeScript for `packages/testing` — PASS.
- Root `package.json` JSON parse and `.github/workflows/ci.yml` YAML parse — PASS.
- `./apps/web/node_modules/.bin/playwright test --config apps/web/playwright.config.ts --list` — PASS; three Chromium smoke tests were discovered without starting runtime processes.

### Final-correction limitations

- The root staged Turbo execution could not run because this shell still has no pnpm/Corepack binary (`Unable to find package manager binary`). The exact underlying API and worker commands were run directly as recorded above.
- To avoid destructive local database changes, this correction did not run `pnpm test`, the PostgreSQL persistence suite, migrations, seed, or live Playwright smoke. It made no database changes.
- GitHub Actions was not executed from this environment.
