import type { OutboxDeadLetter, OutboxProcessor } from "@orbit/backend";
import { RetryableOutboxError } from "@orbit/backend";
import { DelayedError, type JobsOptions } from "bullmq";

export const OUTBOX_QUEUE = "outbox";
export const OUTBOX_DEAD_LETTER_QUEUE = "outbox-dead-letter";
export const OUTBOX_JOB = "outbox.process";
export const OUTBOX_DEAD_LETTER_JOB = "outbox.dead-letter";
const OUTBOX_RETRY_DELAY_MS = 5_000;

export const OUTBOX_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: 1_000,
  removeOnFail: true,
} satisfies JobsOptions;

export type OutboxJobData = { eventId: string; deadLetterPending?: boolean };

export interface BullMqQueueBoundary<Data = unknown> {
  add(name: string, data: Data, options?: JobsOptions): Promise<unknown>;
  close(): Promise<void>;
  waitUntilReady(): Promise<unknown>;
}

export interface OutboxQueuePort {
  enqueue(eventId: string): Promise<void>;
}

export class BullMqOutboxQueueAdapter implements OutboxQueuePort {
  constructor(
    private readonly queue: BullMqQueueBoundary<OutboxJobData>,
    private readonly deadLetterQueue: BullMqQueueBoundary<OutboxDeadLetter>,
  ) {}

  async enqueue(eventId: string): Promise<void> {
    await this.queue.add(OUTBOX_JOB, { eventId }, { ...OUTBOX_JOB_OPTIONS, jobId: eventId });
  }

  async publish(deadLetter: OutboxDeadLetter): Promise<void> {
    await this.deadLetterQueue.add(OUTBOX_DEAD_LETTER_JOB, deadLetter, {
      jobId: deadLetter.eventId,
    });
  }
}

type OutboxDispatchDatabase = {
  outboxEvent: {
    findMany(args: {
      where: { publishedAt: null; status: "PENDING" };
      orderBy: { createdAt: "asc" };
      select: { id: true };
      take: number;
    }): Promise<Array<{ id: string }>>;
    updateMany(args: {
      where: { id: string; publishedAt: null; status: "PENDING" };
      data: { publishedAt: Date };
    }): Promise<{ count: number }>;
  };
};

export class OutboxDispatcher {
  constructor(
    private readonly database: OutboxDispatchDatabase,
    private readonly queue: OutboxQueuePort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async dispatchPending(): Promise<number> {
    const events = await this.database.outboxEvent.findMany({
      where: { publishedAt: null, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
      take: 100,
    });
    let published = 0;

    for (const event of events) {
      await this.queue.enqueue(event.id);
      const result = await this.database.outboxEvent.updateMany({
        where: { id: event.id, publishedAt: null, status: "PENDING" },
        data: { publishedAt: this.now() },
      });
      published += result.count;
    }

    return published;
  }
}

type OutboxProcessorPort = Pick<OutboxProcessor, "failPermanently" | "process">;

type OutboxJob = {
  data: OutboxJobData;
  attemptsMade: number;
  moveToDelayed?(timestamp: number, token?: string): Promise<void>;
  updateData?(data: OutboxJobData): Promise<void>;
};

export function createOutboxJobHandler(
  processor: OutboxProcessorPort,
  now: () => Date = () => new Date(),
) {
  const failPermanently = async (job: OutboxJob, token?: string): Promise<void> => {
    try {
      await processor.failPermanently(job.data.eventId, "retry_exhausted");
    } catch (error) {
      if (
        !(error instanceof RetryableOutboxError) ||
        !job.moveToDelayed ||
        !job.updateData
      ) {
        throw error;
      }

      const data = { ...job.data, deadLetterPending: true };
      await job.updateData(data);
      job.data = data;
      await job.moveToDelayed(now().getTime() + OUTBOX_RETRY_DELAY_MS, token);
      throw new DelayedError();
    }
  };

  return async (job: OutboxJob, token?: string): Promise<void> => {
    if (job.data.deadLetterPending) {
      await failPermanently(job, token);
      return;
    }

    try {
      await processor.process(job.data.eventId);
    } catch (error) {
      const finalAttempt = job.attemptsMade >= OUTBOX_JOB_OPTIONS.attempts - 1;

      if (
        error instanceof RetryableOutboxError &&
        error.failureCode === "outbox_lease_contended" &&
        finalAttempt
      ) {
        if (job.moveToDelayed) {
          await job.moveToDelayed(now().getTime() + OUTBOX_RETRY_DELAY_MS, token);
          throw new DelayedError();
        }

        throw error;
      }

      if (!(error instanceof RetryableOutboxError) || !finalAttempt) {
        throw error;
      }

      await failPermanently(job, token);
    }
  };
}
