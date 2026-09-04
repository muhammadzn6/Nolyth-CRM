import {
  OutboxProcessor,
  type EmailProvider,
  type NotificationProvider,
  type OutboxDatabase,
} from "@orbit/backend";
import { loadServerEnv } from "@orbit/config";
import { database } from "@orbit/database";
import { Queue, Worker } from "bullmq";

import {
  BullMqOutboxQueueAdapter,
  OUTBOX_DEAD_LETTER_QUEUE,
  OUTBOX_QUEUE,
  OutboxDispatcher,
  createOutboxJobHandler,
  type BullMqQueueBoundary,
  type OutboxJobData,
} from "./outbox/outbox.processor";
import { createWorkerRuntime, type WorkerRuntime } from "./worker.module";

type RedisConnection = { url: string };
type WorkerQueueOptions = { connection: RedisConnection };

type WorkerJobBoundary = {
  data: OutboxJobData;
  attemptsMade: number;
  moveToDelayed?(timestamp: number, token?: string): Promise<void>;
  updateData?(data: OutboxJobData): Promise<void>;
};

type WorkerHandler = (job: WorkerJobBoundary, token?: string) => Promise<void>;

type WorkerConsumerBoundary = {
  close(): Promise<void>;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(
    event: "failed",
    listener: (job: WorkerJobBoundary | undefined, error: Error) => void,
  ): unknown;
  waitUntilReady(): Promise<unknown>;
};

export type WorkerInfrastructureFactories = {
  queue(name: string, options: WorkerQueueOptions): BullMqQueueBoundary;
  worker(
    name: string,
    processor: WorkerHandler,
    options: WorkerQueueOptions,
  ): WorkerConsumerBoundary;
};

export type WorkerLogger = {
  error(event: string, fields?: Record<string, string | number | boolean>): void;
  info(event: string, fields?: Record<string, string | number | boolean>): void;
};

export type WorkerProcessBoundary = {
  exitCode: string | number | null | undefined;
  once(signal: "SIGINT" | "SIGTERM", listener: () => Promise<void>): unknown;
};

type WorkerDatabase = OutboxDatabase & {
  $disconnect(): Promise<void>;
  outboxEvent: OutboxDatabase["outboxEvent"] & {
    findMany(args: unknown): Promise<Array<{ id: string }>>;
  };
  notification: {
    findUnique(args: { where: { idempotencyKey: string } }): Promise<{ id: string } | null>;
    create(args: { data: { idempotencyKey: string; recipientId: string; type: string; title: string; message: string; relatedEntityType?: string; relatedEntityId?: string } }): Promise<{ id: string }>;
  };
};

type WorkerProviders = {
  email: EmailProvider;
  notifications: NotificationProvider;
};

type WorkerApplicationOptions = {
  config: { redisUrl: string };
  database: WorkerDatabase;
  factories?: WorkerInfrastructureFactories;
  logger?: WorkerLogger;
  pollIntervalMs?: number;
  providers?: WorkerProviders;
};

const defaultFactories: WorkerInfrastructureFactories = {
  queue: (name, options) => new Queue(name, options),
  worker: (name, processor, options) =>
    new Worker(name, processor as never, options) as unknown as WorkerConsumerBoundary,
};

const defaultLogger: WorkerLogger = {
  error: (event, fields = {}) => {
    process.stderr.write(`${JSON.stringify({ event, ...fields })}\n`);
  },
  info: (event, fields = {}) => {
    process.stdout.write(`${JSON.stringify({ event, ...fields })}\n`);
  },
};

function createLocalProviders(database: WorkerDatabase): WorkerProviders {
  return {
    email: {
      send: async () => ({ providerMessageId: "local-noop" }),
    },
    notifications: { createInApp: async (input) => { const existing = await database.notification.findUnique({ where: { idempotencyKey: input.idempotencyKey } }); if (existing) return { notificationId: existing.id }; const created = await database.notification.create({ data: { idempotencyKey: input.idempotencyKey, recipientId: input.recipientUserId, type: "IN_APP", title: input.title, message: input.message, ...(input.relatedEntityType ? { relatedEntityType: input.relatedEntityType } : {}), ...(input.relatedEntityId ? { relatedEntityId: input.relatedEntityId } : {}) } }); return { notificationId: created.id }; } },
  };
}

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export function createWorkerApplication(options: WorkerApplicationOptions): WorkerRuntime {
  const factories = options.factories ?? defaultFactories;
  const logger = options.logger ?? defaultLogger;
  const connection = { url: options.config.redisUrl };
  const queue = factories.queue(OUTBOX_QUEUE, { connection });
  const deadLetterQueue = factories.queue(OUTBOX_DEAD_LETTER_QUEUE, { connection });
  const queueAdapter = new BullMqOutboxQueueAdapter(queue, deadLetterQueue);
  const providers = options.providers ?? createLocalProviders(options.database);
  const processor = new OutboxProcessor(options.database, {
    ...providers,
    deadLetters: queueAdapter,
  });
  const consumer = factories.worker(
    OUTBOX_QUEUE,
    createOutboxJobHandler(processor),
    { connection },
  );
  const dispatcher = new OutboxDispatcher(options.database as never, queueAdapter);

  consumer.on("failed", (job, error) => {
    logger.error("worker.job_failed", {
      attemptsMade: job?.attemptsMade ?? 0,
      errorType: errorType(error),
      eventId: job?.data.eventId ?? "unknown",
    });
  });
  consumer.on("error", (error) => {
    logger.error("worker.redis_error", { errorType: errorType(error) });
  });

  const runtime = createWorkerRuntime({
    consumer,
    dispatcher,
    onDispatchError: (error) => {
      logger.error("worker.dispatch_failed", { errorType: errorType(error) });
    },
    pollIntervalMs: options.pollIntervalMs ?? 1_000,
    queue: {
      close: async () => {
        await queue.close();
        await deadLetterQueue.close();
      },
      isReady: async () => {
        await queue.waitUntilReady();
        await deadLetterQueue.waitUntilReady();
        return true;
      },
      waitUntilReady: async () => {
        await queue.waitUntilReady();
        await deadLetterQueue.waitUntilReady();
      },
    },
  });

  return {
    ...runtime,
    async close() {
      try {
        await runtime.close();
      } finally {
        await options.database.$disconnect();
      }
    },
  };
}

export async function runWorkerProcess(
  application: WorkerRuntime,
  processBoundary: WorkerProcessBoundary = process,
  logger: WorkerLogger = defaultLogger,
): Promise<void> {
  let shutdown: Promise<void> | undefined;
  const stop = (signal: "SIGINT" | "SIGTERM") => {
    shutdown ??= application
      .close()
      .then(() => {
        logger.info("worker.stopped", { signal });
      })
      .catch((error: unknown) => {
        processBoundary.exitCode = 1;
        logger.error("worker.shutdown_failed", {
          errorType: errorType(error),
          signal,
        });
      });
    return shutdown;
  };

  processBoundary.once("SIGINT", () => stop("SIGINT"));
  processBoundary.once("SIGTERM", () => stop("SIGTERM"));

  try {
    await application.start();
    logger.info("worker.started");
  } catch (error) {
    processBoundary.exitCode = 1;
    logger.error("worker.start_failed", { errorType: errorType(error) });
    await application.close().catch((closeError: unknown) => {
      logger.error("worker.shutdown_failed", { errorType: errorType(closeError) });
    });
  }
}

export async function bootstrapWorker(): Promise<void> {
  const env = loadServerEnv();
  const application = createWorkerApplication({
    config: { redisUrl: env.redisUrl },
    database: database as unknown as WorkerDatabase,
  });
  await runWorkerProcess(application);
}

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  void bootstrapWorker();
}
