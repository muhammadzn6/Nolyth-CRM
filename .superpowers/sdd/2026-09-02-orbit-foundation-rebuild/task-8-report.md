# Task 8 report — completed checkpoint

## Status

The checkpoint completion request is implemented. BullMQ is installed in the worker workspace, and the previously missing worker module and outbox processor are present with focused tests.

## Delivered

- Added `bullmq` `^5.81.4` to `@orbit/worker` and updated `pnpm-lock.yaml` through pnpm 10.15.1.
- Added a typed BullMQ queue boundary and adapter for outbox and dead-letter jobs.
- Added bounded processing options: five total attempts, exponential backoff starting at 1 second, and event-ID job deduplication.
- Added pending-row dispatch that records `publishedAt` only after queue acceptance.
- Added final-attempt handling that leaves retryable errors for BullMQ until the retry budget is exhausted, then invokes the backend permanent-failure/dead-letter transition.
- Added a worker runtime that performs an initial dispatch, polls without leaking rejected promises, reports liveness/readiness, and closes the consumer before queue resources.
- Preserved the checkpoint's backend outbox implementation for transactional append, processing idempotency, authorization-sensitive recipient rechecks, retry release, and permanent failure.

## TDD evidence

- RED: the focused worker run failed because `apps/worker/src/worker.module.ts` and `apps/worker/src/outbox/outbox.processor.ts` did not exist.
- GREEN: the outbox processor test passed 5/5 after its minimal implementation.
- GREEN: the worker module test passed 1/1 after its minimal implementation.
- The existing backend outbox baseline passed 6/6 before worker implementation.

## Final bounded verification

- Focused backend/worker Vitest run: PASS, 3 files and 12/12 tests.
- Worker TypeScript check (`tsc --noEmit -p apps/worker/tsconfig.json`): PASS.
- Targeted worker ESLint run: PASS.
- `git diff --check`: PASS before this report update.
- No pnpm, Vitest, TypeScript, or ESLint process remained running before final verification.

## Scope note

No Redis integration test or provider integration test was run. The queue boundary is covered with deterministic in-memory recording queues, and the worker lifecycle is covered with injected dependencies.

## Review-finding fixes

- Replaced the `main.ts` placeholder with real BullMQ `Queue`/`Worker` construction using `REDIS_URL`, database-backed dispatch, provider-port composition, readiness checks, structured safe logging, and SIGINT/SIGTERM cleanup.
- Added an explicit `claimedAt` lease and migration so expired or legacy null `PROCESSING` claims are atomically recoverable after a worker crash.
- Made final-attempt dead-letter publication failures retryable: the row becomes unpublished, the BullMQ job records `deadLetterPending`, and the same job is delayed so retries do not repeat provider work. Immediate failed-job removal leaves dispatcher recovery available if delaying cannot be persisted.
- Added fake-backed wiring tests because a disposable Redis service was not available; no real-Redis integration result is claimed.

## Review-fix verification

- Focused backend/worker Vitest: PASS, 4 files and 17/17 tests.
- Backend and worker TypeScript checks: PASS.
- Targeted worker/backend ESLint: PASS.
- `git diff --check`: PASS before this report append.

## Remaining lease-contention review fix

- Changed an atomic claim miss from a successful no-op to `RetryableOutboxError("outbox_lease_contended")`, so a BullMQ delivery cannot disappear while another worker owns an unexpired `PROCESSING` lease.
- On the configured final BullMQ attempt, lease contention moves the same job back to delayed state instead of dead-lettering the live owner's event. BullMQ's delayed transition skips attempt consumption, allowing the job to observe a terminal result or reclaim the row after lease expiry.
- Preserved provider idempotency: an unexpired lease performs no provider work, while stale and legacy null leases remain atomically reclaimable and execute one provider call in the focused tests.

## Remaining-fix TDD and verification

- RED: the two focused files reported 2 failing tests because live lease contention resolved successfully and final-attempt contention was treated as retry exhaustion.
- GREEN: focused backend/worker Vitest passed 4 files and 20/20 tests, including unexpired, stale, and null lease cases.
- Backend and worker TypeScript checks: PASS.
- Targeted worker/backend ESLint: PASS.
- `git diff --check`: PASS before this report append.
