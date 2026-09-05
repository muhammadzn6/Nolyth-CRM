export type WorkerHealth = { live: boolean; ready: boolean };

export type WorkerRuntimeDependencies = {
  dispatcher: { dispatchPending(): Promise<number> };
  performanceSlaEvaluator?: { evaluateOverdueSlas(): Promise<unknown> };
  consumer: { close(): Promise<void>; waitUntilReady(): Promise<unknown> };
  queue: {
    close(): Promise<void>;
    isReady(): Promise<boolean>;
    waitUntilReady(): Promise<void>;
  };
  pollIntervalMs: number;
  onDispatchError?: (error: unknown) => void;
  onPerformanceEvaluationError?: (error: unknown) => void;
};

export type WorkerRuntime = {
  start(): Promise<void>;
  health(): Promise<WorkerHealth>;
  close(): Promise<void>;
};

export function createWorkerRuntime(
  dependencies: WorkerRuntimeDependencies,
): WorkerRuntime {
  let live = false;
  let closed = false;
  let poller: ReturnType<typeof setInterval> | undefined;
  let evaluatingPerformance = false;

  const evaluatePerformance = async () => {
    if (!dependencies.performanceSlaEvaluator || evaluatingPerformance) return;
    evaluatingPerformance = true;
    try {
      await dependencies.performanceSlaEvaluator.evaluateOverdueSlas();
    } catch (error) {
      dependencies.onPerformanceEvaluationError?.(error);
    } finally {
      evaluatingPerformance = false;
    }
  };

  return {
    async start() {
      if (live) return;
      if (closed) throw new Error("Worker runtime is closed");

      await dependencies.queue.waitUntilReady();
      await dependencies.consumer.waitUntilReady();
      await dependencies.dispatcher.dispatchPending();
      await evaluatePerformance();
      live = true;
      poller = setInterval(() => {
        void dependencies.dispatcher.dispatchPending().catch((error: unknown) => {
          dependencies.onDispatchError?.(error);
        });
        void evaluatePerformance();
      }, dependencies.pollIntervalMs);
      poller.unref();
    },

    async health() {
      if (!live) return { live: false, ready: false };

      try {
        return { live: true, ready: await dependencies.queue.isReady() };
      } catch {
        return { live: true, ready: false };
      }
    },

    async close() {
      if (closed) return;
      closed = true;
      live = false;

      if (poller) clearInterval(poller);
      await dependencies.consumer.close();
      await dependencies.queue.close();
    },
  };
}
