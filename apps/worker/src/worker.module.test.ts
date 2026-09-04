import { describe, expect, it } from "vitest";

import { createWorkerRuntime, type WorkerRuntimeDependencies } from "./worker.module";

describe("worker runtime", () => {
  it("dispatches pending outbox rows on startup and closes owned resources", async () => {
    const lifecycle: string[] = [];
    const dependencies = {
      dispatcher: {
        dispatchPending: async () => {
          lifecycle.push("dispatch");
          return 0;
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

    expect(lifecycle).toEqual(["dispatch", "consumer.close", "queue.close"]);
  });
});
