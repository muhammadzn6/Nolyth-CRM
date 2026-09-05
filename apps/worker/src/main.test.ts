import { describe, expect, it, vi } from "vitest";

import type { OutboxEventInput } from "@orbit/backend";

import {
  createWorkerApplication,
  runWorkerProcess,
  type WorkerInfrastructureFactories,
  type WorkerLogger,
  type WorkerProcessBoundary,
} from "./main";

const eventId = "20000000-0000-4000-8000-000000000001";
const recipientUserId = "10000000-0000-4000-8000-000000000001";

describe("worker application wiring", () => {
  it("connects BullMQ queues, the dispatcher, and provider ports without real Redis", async () => {
    const lifecycle: string[] = [];
    const queueCalls: Array<{ name: string; options: unknown }> = [];
    let workerCall:
      | {
          name: string;
          processor: (job: { data: { eventId: string }; attemptsMade: number }) => Promise<void>;
          options: unknown;
        }
      | undefined;
    const factories = {
      queue: (name, options) => {
        queueCalls.push({ name, options });
        return {
          add: async () => undefined,
          close: async () => {
            lifecycle.push(`${name}.close`);
          },
          waitUntilReady: async () => {
            lifecycle.push(`${name}.ready`);
          },
        };
      },
      worker: (name, processor, options) => {
        workerCall = { name, processor, options };
        return {
          close: async () => {
            lifecycle.push("worker.close");
          },
          on: () => undefined,
          waitUntilReady: async () => {
            lifecycle.push("worker.ready");
          },
        };
      },
    } satisfies WorkerInfrastructureFactories;
    const event: OutboxEventInput & {
      id: string;
      attempts: number;
      claimedAt: Date | null;
      createdAt: Date;
      lastError: string | null;
      processedAt: Date | null;
      publishedAt: Date | null;
      status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
    } = {
      aggregateType: "user",
      aggregateId: recipientUserId,
      attempts: 0,
      claimedAt: null,
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      eventType: "email.send_requested",
      id: eventId,
      idempotencyKey: `invite:${recipientUserId}`,
      lastError: null,
      payload: {
        recipientUserId,
        subject: "Invitation",
        text: "Open Orbit.",
        to: "person@orbit.test",
      },
      processedAt: null,
      publishedAt: new Date("2026-09-02T00:00:00.000Z"),
      status: "PENDING",
    };
    const database = {
      $disconnect: async () => {
        lifecycle.push("database.close");
      },
      outboxEvent: {
        findMany: async () => [],
        findUnique: async () => event,
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          if ("attempts" in data) event.attempts += 1;
          Object.assign(event, data, { attempts: event.attempts });
          return { count: 1 };
        },
      },
      user: {
        findUnique: async () => ({ id: recipientUserId, isActive: true }),
      },
    };
    const email = { send: vi.fn().mockResolvedValue({ providerMessageId: "email-1" }) };
    const performanceSlaEvaluator = { evaluateOverdueSlas: vi.fn().mockResolvedValue({ reassignmentOverdue: 0, reviewOverdue: 0 }) };
    const application = createWorkerApplication({
      config: { redisUrl: "redis://worker-redis:6379/2" },
      database: database as never,
      factories,
      logger: { error: vi.fn(), info: vi.fn() },
      providers: {
        email,
        notifications: {
          createInApp: vi.fn().mockResolvedValue({ notificationId: "notification-1" }),
        },
      },
      performanceSlaEvaluator,
      pollIntervalMs: 60_000,
    });

    await application.start();
    await workerCall?.processor({ data: { eventId }, attemptsMade: 0 });
    await application.close();

    expect(queueCalls).toEqual([
      { name: "outbox", options: { connection: { url: "redis://worker-redis:6379/2" } } },
      {
        name: "outbox-dead-letter",
        options: { connection: { url: "redis://worker-redis:6379/2" } },
      },
    ]);
    expect(workerCall).toMatchObject({
      name: "outbox",
      options: { connection: { url: "redis://worker-redis:6379/2" } },
    });
    expect(email.send).toHaveBeenCalledOnce();
    expect(performanceSlaEvaluator.evaluateOverdueSlas).toHaveBeenCalledOnce();
    expect(lifecycle).toEqual([
      "outbox.ready",
      "outbox-dead-letter.ready",
      "worker.ready",
      "worker.close",
      "outbox.close",
      "outbox-dead-letter.close",
      "database.close",
    ]);
  });
});

describe("worker process lifecycle", () => {
  it("closes on SIGTERM and logs only safe structured failure metadata", async () => {
    const listeners = new Map<string, () => Promise<void>>();
    const processBoundary = {
      exitCode: undefined,
      once: (signal, listener) => {
        listeners.set(signal, listener);
      },
    } satisfies WorkerProcessBoundary;
    const logger = { error: vi.fn(), info: vi.fn() } satisfies WorkerLogger;
    const application = {
      close: vi.fn().mockResolvedValue(undefined),
      health: vi.fn(),
      start: vi.fn().mockRejectedValue(new Error("redis://user:secret@internal")),
    };

    await runWorkerProcess(application, processBoundary, logger);

    expect(application.close).toHaveBeenCalledOnce();
    expect(processBoundary.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith("worker.start_failed", {
      errorType: "Error",
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("secret");

    application.start.mockResolvedValueOnce(undefined);
    await runWorkerProcess(application, processBoundary, logger);
    await listeners.get("SIGTERM")?.();

    expect(application.close).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith("worker.stopped", { signal: "SIGTERM" });
  });
});
