import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorkerRuntime, type WorkerRuntimeDependencies } from "./worker.module";

describe("worker runtime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches pending outbox rows on startup and closes owned resources", async () => {
    const lifecycle: string[] = [];
    const dependencies = {
      dispatcher: {
        dispatchPending: async () => {
          lifecycle.push("dispatch");
          return 0;
        },
      },
      performanceSlaEvaluator: {
        evaluateOverdueSlas: async () => {
          lifecycle.push("performance.evaluate");
          return { reassignmentOverdue: 0, reviewOverdue: 0 };
        },
      },
      consumer: {
        close: async () => {
          lifecycle.push("consumer.close");
        },
        waitUntilReady: async () => undefined,
      },
      queue: {
        close: async () => {
          lifecycle.push("queue.close");
        },
        isReady: async () => true,
        waitUntilReady: async () => undefined,
      },
      pollIntervalMs: 60_000,
    } satisfies WorkerRuntimeDependencies;
    const runtime = createWorkerRuntime(dependencies);

    await runtime.start();
    expect(await runtime.health()).toEqual({ live: true, ready: true });

    await runtime.close();

    expect(lifecycle).toEqual(["dispatch", "performance.evaluate", "consumer.close", "queue.close"]);
  });

  it("runs the overdue-SLA evaluator at startup and on the production polling interval", async () => {
    vi.useFakeTimers();
    const evaluateOverdueSlas = vi.fn().mockResolvedValue({ reassignmentOverdue: 0, reviewOverdue: 0 });
    const runtime = createWorkerRuntime({
      dispatcher: { dispatchPending: vi.fn().mockResolvedValue(0) },
      performanceSlaEvaluator: { evaluateOverdueSlas },
      consumer: { close: vi.fn().mockResolvedValue(undefined), waitUntilReady: vi.fn().mockResolvedValue(undefined) },
      queue: {
        close: vi.fn().mockResolvedValue(undefined),
        isReady: vi.fn().mockResolvedValue(true),
        waitUntilReady: vi.fn().mockResolvedValue(undefined),
      },
      pollIntervalMs: 60_000,
    });

    await runtime.start();
    expect(evaluateOverdueSlas).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(evaluateOverdueSlas).toHaveBeenCalledTimes(2);

    await runtime.close();
  });
});
