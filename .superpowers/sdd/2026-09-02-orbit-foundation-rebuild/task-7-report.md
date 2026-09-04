# Task 7 report — Orbit web shell and Tailwind UI foundation

## Delivered

- Replaced the placeholder Next.js App Router layout/page with a server-first authenticated dashboard route and public login route.
- Added semantic Tailwind v4 tokens, PostCSS integration, responsive light-theme foundations, and package source scanning.
- Added shared `@orbit/ui` button, card, field/input, loading, empty, error, and unauthorized primitives.
- Added a responsive, collapsible role-aware sidebar; searchable top bar; notifications/user menu; and Admin/BD/Closer navigation rules.
- Added role-specific summary cards, operational focus, upcoming interview context, and recent activity.
- Added a contract-validated HTTP API boundary for login and current-session lookup. The web package imports `@orbit/contracts` only and does not import backend/database code.
- Added route-level loading, error, login, and unauthorized screens.
- Added focused shell/API tests using a RED/GREEN cycle.

## TDD evidence

- RED: `./node_modules/.bin/vitest run apps/web/components/layout/app-shell.test.tsx apps/web/lib/api-client.test.ts` failed because the new shell, login, feedback, dashboard, and API client modules did not exist.
- First GREEN attempt exposed two implementation issues: JSX transform configuration and envelope data extraction. Both root causes were corrected.
- Final GREEN: the same focused command passed 2 files and 10 tests.

## Verification

- `./node_modules/.bin/vitest run apps/web/components/layout/app-shell.test.tsx apps/web/lib/api-client.test.ts` — PASS, 10/10 tests.
- `./node_modules/.bin/tsc --noEmit -p packages/ui/tsconfig.json` — PASS.
- `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` — PASS.
- `./node_modules/.bin/eslint --config eslint.config.mjs apps/web packages/ui` — PASS.
- `git diff --check` — PASS.
- `./node_modules/.bin/next build --webpack` from `apps/web` — PASS; compilation, TypeScript, page generation, and route optimization completed.

## Exact limitations

- The default Turbopack build was attempted and failed because the sandbox denied a PostCSS worker from binding a local port (`Operation not permitted`). The webpack production build completed successfully against the same source tree.
- A redundant broad `vitest run packages/ui apps/web` invocation emitted no output and was terminated after its bounded wait. Focused Task 7 tests are the recorded test evidence; the repository-wide suite was not run in this pass.
- No browser-based visual regression, Playwright E2E, or live API session test was run. Those remain Task 9/runtime-integration work.
- Dashboard values and activity are representative foundation data until the dashboard API contract is introduced. Authentication/session calls use the typed HTTP boundary now.

## Follow-up verification — logout/session correction

- Replaced the user-menu navigation-only sign-out action with the existing API session revocation flow: `POST /auth/logout` with credentials, followed by a `/login` redirect only after success. A failed request leaves the user on the current page and exposes a retryable error.
- Confirmed by inspection that the existing API logout controller revokes the server-side session and clears the `orbit_session` cookie; the follow-up remains scoped to the web header and API client boundary.
- `./node_modules/.bin/vitest run apps/web/components/layout/app-shell.test.tsx apps/web/lib/api-client.test.ts` — PASS, 2 files and 11/11 tests, including the logout endpoint regression.
- `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` — PASS.
- `./node_modules/.bin/eslint --config eslint.config.mjs apps/web/components/layout/app-header.tsx apps/web/lib/api-client.ts apps/web/lib/api-client.test.ts` — PASS.
- `git diff --check` — PASS before staging.
- No browser E2E or live API session test was added or run in this follow-up; verification stayed bounded to the affected web boundary.

## Reviewer findings correction

- Lifted desktop sidebar collapse state into `AppShell`, so the sidebar width and content padding now switch together between 248px and 76px. A jsdom interaction regression covers both states.
- Extended `@orbit/config` web environment validation with required `NEXT_PUBLIC_API_BASE_URL`, wired the API client through that browser-safe typed loader, removed the server-only/localhost fallback, and documented the required value in `.env.example`.
- Implemented user-menu focus transfer, ArrowUp/ArrowDown cycling, Escape dismissal with trigger focus return, ARIA control naming, and retry focus restoration after logout failure.
- Added explicit logout UI coverage for pending, failure, retry, and redirect-after-success behavior. Successful logout now redirects through the Next.js client router only after API revocation resolves.

### TDD and bounded verification

- RED: shell interaction test failed because collapsed navigation retained `lg:pl-[248px]`; API/config tests failed because the public API URL was neither required nor consumed; menu tests failed on focus/Arrow/Escape behavior; logout tests failed on failure focus restoration and success routing.
- GREEN: `./node_modules/.bin/vitest run apps/web/components/layout/app-shell.test.tsx apps/web/components/layout/app-shell-interactions.test.tsx apps/web/components/layout/app-header.test.tsx apps/web/lib/api-client.test.ts packages/config/src/env.test.ts` — PASS, 5 files and 27/27 tests.
- `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` — PASS.
- `./node_modules/.bin/tsc --noEmit -p packages/config/tsconfig.json` — PASS.
- `./node_modules/.bin/eslint --config eslint.config.mjs apps/web/components/layout apps/web/lib packages/config/src` — PASS.
- `git diff --check` — PASS before report append.
- Per the requested bounded stop, no production build, browser E2E, live API session test, or repository-wide suite was run in this correction pass.
