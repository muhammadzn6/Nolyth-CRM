import { describe, expect, it, vi } from "vitest";

import { RetryableOutboxError } from "@orbit/backend";
import { DelayedError } from "bullmq";

import {
  BullMqOutboxQueueAdapter,
  OUTBOX_DEAD_LETTER_JOB,
  OUTBOX_JOB,
  OUTBOX_JOB_OPTIONS,
  OutboxDispatcher,
  createOutboxJobHandler,
  type BullMqQueueBoundary,
  type OutboxQueuePort,
} from "./outbox.processor";

const eventId = "20000000-0000-4000-8000-000000000001";

class RecordingBullMqQueue implements BullMqQueueBoundary {
  readonly jobs: Array<{
    name: string;
    data: unknown;
    options: Record<string, unknown> | undefined;
  }> = [];

  async add(name: string, data: unknown, options?: Record<string, unknown>) {
    this.jobs.push({ name, data, options });
  }

  async close() {}

  async waitUntilReady() {}
}

describe("BullMQ outbox boundary", () => {
  it("enqueues event IDs with bounded exponential retry and deduplication", async () => {
    const jobs = new RecordingBullMqQueue();
    const deadLetters = new RecordingBullMqQueue();
    const queue = new BullMqOutboxQueueAdapter(jobs, deadLetters);

    await queue.enqueue(eventId);

    expect(jobs.jobs).toEqual([
      {
        name: OUTBOX_JOB,
        data: { eventId },
        options: { ...OUTBOX_JOB_OPTIONS, jobId: eventId },
      },
    ]);
  });

  it("publishes permanent failures to a separate dead-letter queue", async () => {
    const jobs = new RecordingBullMqQueue();
    const deadLetters = new RecordingBullMqQueue();
    const queue = new BullMqOutboxQueueAdapter(jobs, deadLetters);

    await queue.publish({
      eventId,
      eventType: "email.send_requested",
      failureCode: "recipient_unavailable",
    });

    expect(deadLetters.jobs).toEqual([
      {
        name: OUTBOX_DEAD_LETTER_JOB,
        data: {
          eventId,
          eventType: "email.send_requested",
          failureCode: "recipient_unavailable",
        },
        options: { jobId: eventId },
      },
    ]);
  });
});

describe("outbox dispatch and retry policy", () => {
  it("marks an event published only after the queue accepts it", async () => {
    const events = [{ id: eventId, publishedAt: null as Date | null }];
    const database = {
      outboxEvent: {
        findMany: async () => events.filter((event) => event.publishedAt === null),
        updateMany: async ({ where, data }: { where: { id: string }; data: { publishedAt: Date } }) => {
          const event = events.find((candidate) => candidate.id === where.id);
          if (!event) return { count: 0 };
          event.publishedAt = data.publishedAt;
          return { count: 1 };
        },
      },
    };
    const enqueued: string[] = [];
    const queue = {
      enqueue: async (id: string) => {
        enqueued.push(id);
      },
    } as OutboxQueuePort;

    const count = await new OutboxDispatcher(database, queue).dispatchPending();

    expect(count).toBe(1);
    expect(enqueued).toEqual([eventId]);
    expect(events[0]?.publishedAt).toBeInstanceOf(Date);
  });

  it("leaves an event unpublished when queue publication fails", async () => {
    const events = [{ id: eventId, publishedAt: null as Date | null }];
    const database = {
      outboxEvent: {
        findMany: async () => events,
        updateMany: async ({ data }: { data: { publishedAt: Date } }) => {
          events[0]!.publishedAt = data.publishedAt;
          return { count: 1 };
        },
      },
    };
    const queue = {
      enqueue: async () => {
        throw new Error("redis unavailable");
      },
    } as OutboxQueuePort;

    await expect(new OutboxDispatcher(database, queue).dispatchPending()).rejects.toThrow(
      "redis unavailable",
    );
    expect(events[0]?.publishedAt).toBeNull();
  });

  it("dead-letters a retryable event only after the configured final attempt", async () => {
    const exhausted: Array<{ eventId: string; failureCode: string }> = [];
    const processor = {
      process: async () => {
        throw new RetryableOutboxError("provider_unavailable");
      },
      failPermanently: async (id: string, failureCode: string) => {
        exhausted.push({ eventId: id, failureCode });
      },
    };
    const handle = createOutboxJobHandler(processor);

    await expect(
      handle({ data: { eventId }, attemptsMade: OUTBOX_JOB_OPTIONS.attempts - 2 }),
    ).rejects.toThrow(RetryableOutboxError);
    expect(exhausted).toEqual([]);

    await handle({ data: { eventId }, attemptsMade: OUTBOX_JOB_OPTIONS.attempts - 1 });

    expect(exhausted).toEqual([{ eventId, failureCode: "retry_exhausted" }]);
  });

  it("delays final lease contention instead of dead-lettering the live owner", async () => {
    const processor = {
      process: vi
        .fn()
        .mockRejectedValueOnce(new RetryableOutboxError("outbox_lease_contended"))
        .mockResolvedValueOnce(undefined),
      failPermanently: vi.fn().mockResolvedValue(undefined),
    };
    const delayedUntil: Array<{ timestamp: number; token?: string }> = [];
    const job = {
      data: { eventId },
      attemptsMade: OUTBOX_JOB_OPTIONS.attempts - 1,
      moveToDelayed: async (timestamp: number, token?: string) => {
        delayedUntil.push({ timestamp, token });
      },
    };
    const handle = createOutboxJobHandler(
      processor,
      () => new Date("2026-09-02T00:00:00.000Z"),
    );

    await expect(handle(job, "worker-lock")).rejects.toBeInstanceOf(DelayedError);
    expect(delayedUntil).toEqual([
      { timestamp: new Date("2026-09-02T00:00:05.000Z").getTime(), token: "worker-lock" },
    ]);
    expect(processor.failPermanently).not.toHaveBeenCalled();

    await handle(job, "worker-lock");

    expect(processor.process).toHaveBeenCalledTimes(2);
    expect(processor.failPermanently).not.toHaveBeenCalled();
  });

  it("delays final dead-letter publication failures without repeating provider work", async () => {
    const processor = {
      process: vi.fn().mockRejectedValue(new RetryableOutboxError("provider_unavailable")),
      failPermanently: vi
        .fn()
        .mockRejectedValueOnce(new RetryableOutboxError("dead_letter_unavailable"))
        .mockResolvedValueOnce(undefined),
    };
    const delayedUntil: Array<{ timestamp: number; token?: string }> = [];
    const job = {
      data: { eventId, deadLetterPending: false },
      attemptsMade: OUTBOX_JOB_OPTIONS.attempts - 1,
      moveToDelayed: async (timestamp: number, token?: string) => {
        delayedUntil.push({ timestamp, token });
      },
      updateData: async (data: { eventId: string; deadLetterPending?: boolean }) => {
        job.data = { ...job.data, ...data };
      },
    };
    const handle = createOutboxJobHandler(
      processor,
      () => new Date("2026-09-02T00:00:00.000Z"),
    );

    await expect(handle(job, "worker-lock")).rejects.toBeInstanceOf(DelayedError);
    expect(delayedUntil).toEqual([
      { timestamp: new Date("2026-09-02T00:00:05.000Z").getTime(), token: "worker-lock" },
    ]);
    expect(job.data.deadLetterPending).toBe(true);

    await handle(job, "worker-lock");

    expect(processor.process).toHaveBeenCalledOnce();
    expect(processor.failPermanently).toHaveBeenCalledTimes(2);
  });
});
