import { describe, expect, it, vi } from "vitest";

import {
  OutboxProcessor,
  OutboxService,
  RetryableOutboxError,
  type OutboxDatabase,
  type OutboxDeadLetterPort,
  type OutboxEventInput,
} from "./outbox.service";
import type { EmailProvider } from "../providers/email.port";
import type { NotificationProvider } from "../providers/notification.port";

type StoredEvent = OutboxEventInput & {
  id: string;
  attempts: number;
  claimedAt: Date | null;
  createdAt: Date;
  lastError: string | null;
  processedAt: Date | null;
  publishedAt: Date | null;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
};

const recipientUserId = "10000000-0000-4000-8000-000000000001";

const emailEvent: OutboxEventInput = {
  aggregateType: "user",
  aggregateId: recipientUserId,
  eventType: "email.send_requested",
  idempotencyKey: "user-invitation:10000000-0000-4000-8000-000000000001",
  payload: {
    recipientUserId,
    to: "new-user@orbit.test",
    subject: "Your Orbit invitation",
    text: "Open Orbit to accept your invitation.",
  },
};

const notificationEvent: OutboxEventInput = {
  aggregateType: "user",
  aggregateId: recipientUserId,
  eventType: "notification.create_requested",
  idempotencyKey: "profile-assignment:10000000-0000-4000-8000-000000000001",
  payload: {
    recipientUserId,
    title: "Profile assigned",
    message: "A profile was assigned to you.",
    relatedEntityType: "profile",
    relatedEntityId: "30000000-0000-4000-8000-000000000001",
  },
};

function createPersistence() {
  const events: StoredEvent[] = [];
  const users = new Map([[recipientUserId, { id: recipientUserId, isActive: true }]]);

  const outboxEvent = {
    upsert: async ({
      where,
      create,
    }: {
      where: { idempotencyKey: string };
      create: OutboxEventInput;
      update: Record<string, never>;
    }) => {
      const existing = events.find(
        (candidate) => candidate.idempotencyKey === where.idempotencyKey,
      );

      if (existing) {
        return existing;
      }

      const event: StoredEvent = {
        ...create,
        id: `20000000-0000-4000-8000-${String(events.length + 1).padStart(12, "0")}`,
        attempts: 0,
        claimedAt: null,
        createdAt: new Date("2026-09-02T00:00:00.000Z"),
        lastError: null,
        processedAt: null,
        publishedAt: null,
        status: "PENDING",
      };
      events.push(event);
      return event;
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      events.find((event) => event.id === where.id) ?? null,
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        id: string;
        status?: StoredEvent["status"];
        OR?: Array<
          | { status: "PENDING" }
          | { status: "PROCESSING"; claimedAt: null | { lt: Date } }
        >;
      };
      data: {
        attempts?: { increment: number };
        claimedAt?: Date | null;
        lastError?: string | null;
        processedAt?: Date | null;
        publishedAt?: Date | null;
        status?: StoredEvent["status"];
      };
    }) => {
      const event = events.find((candidate) => {
        if (candidate.id !== where.id) return false;
        if (where.status && candidate.status !== where.status) return false;
        if (!where.OR) return true;

        return where.OR.some((condition) => {
          if (candidate.status !== condition.status) return false;
          if (!("claimedAt" in condition)) return true;
          if (condition.claimedAt === null) return candidate.claimedAt === null;
          return candidate.claimedAt !== null && candidate.claimedAt < condition.claimedAt.lt;
        });
      });

      if (!event) {
        return { count: 0 };
      }

      if (data.attempts) {
        event.attempts += data.attempts.increment;
      }
      Object.assign(event, {
        ...data,
        attempts: event.attempts,
      });
      return { count: 1 };
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<StoredEvent>;
    }) => {
      const event = events.find((candidate) => candidate.id === where.id);

      if (!event) {
        throw new Error("Outbox event not found");
      }

      Object.assign(event, data);
      return event;
    },
  };

  const database = {
    outboxEvent,
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
    },
  } as unknown as OutboxDatabase;

  return { database, events, outboxEvent, users };
}

function createProviders() {
  return {
    email: {
      send: vi.fn().mockResolvedValue({ providerMessageId: "email-1" }),
    } satisfies EmailProvider,
    notifications: {
      createInApp: vi.fn().mockResolvedValue({ notificationId: "notification-1" }),
    } satisfies NotificationProvider,
    deadLetters: {
      publish: vi.fn().mockResolvedValue(undefined),
    } satisfies OutboxDeadLetterPort,
  };
}

describe("outbox service boundary", () => {
  it("keeps the business write and outbox append in the caller transaction", async () => {
    const persistence = createPersistence();
    const service = new OutboxService();
    const businessRows: string[] = [];
    const transaction = async (work: () => Promise<void>) => {
      const eventSnapshot = persistence.events.slice();
      const businessSnapshot = businessRows.slice();

      try {
        await work();
      } catch (error) {
        persistence.events.splice(0, persistence.events.length, ...eventSnapshot);
        businessRows.splice(0, businessRows.length, ...businessSnapshot);
        throw error;
      }
    };

    await expect(
      transaction(async () => {
        businessRows.push("candidate-created");
        await service.append({ outboxEvent: persistence.outboxEvent }, emailEvent);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(businessRows).toEqual([]);
    expect(persistence.events).toEqual([]);
  });

  it("returns one durable event when an idempotency key is appended twice", async () => {
    const persistence = createPersistence();
    const service = new OutboxService();
    const transaction = { outboxEvent: persistence.outboxEvent };

    const first = await service.append(transaction, emailEvent);
    const duplicate = await service.append(transaction, emailEvent);

    expect(duplicate.id).toBe(first.id);
    expect(persistence.events).toHaveLength(1);
  });

  it("performs one side effect when the same event is processed twice", async () => {
    const persistence = createPersistence();
    const providers = createProviders();
    const event = await new OutboxService().append(
      { outboxEvent: persistence.outboxEvent },
      emailEvent,
    );
    const processor = new OutboxProcessor(persistence.database, providers);

    await processor.process(event.id);
    await processor.process(event.id);

    expect(providers.email.send).toHaveBeenCalledOnce();
    expect(providers.email.send).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: emailEvent.idempotencyKey }),
    );
    expect(persistence.events[0]).toMatchObject({ attempts: 1, status: "PROCESSED" });
  });

  it("routes a typed in-app event through the notification provider", async () => {
    const persistence = createPersistence();
    const providers = createProviders();
    const event = await new OutboxService().append(
      { outboxEvent: persistence.outboxEvent },
      notificationEvent,
    );

    await new OutboxProcessor(persistence.database, providers).process(event.id);

    expect(providers.notifications.createInApp).toHaveBeenCalledWith({
      ...notificationEvent.payload,
      idempotencyKey: notificationEvent.idempotencyKey,
    });
    expect(persistence.events[0]).toMatchObject({ attempts: 1, status: "PROCESSED" });
  });

  it("releases retryable failures for bounded queue retry", async () => {
    const persistence = createPersistence();
    const providers = createProviders();
    providers.email.send.mockRejectedValueOnce(new RetryableOutboxError("provider_unavailable"));
    const event = await new OutboxService().append(
      { outboxEvent: persistence.outboxEvent },
      emailEvent,
    );
    const processor = new OutboxProcessor(persistence.database, providers);

    await expect(processor.process(event.id)).rejects.toThrow(RetryableOutboxError);
    expect(persistence.events[0]).toMatchObject({ attempts: 1, status: "PENDING" });

    await processor.process(event.id);

    expect(providers.email.send).toHaveBeenCalledTimes(2);
    expect(persistence.events[0]).toMatchObject({ attempts: 2, status: "PROCESSED" });
  });

  it("retries without provider work while another processing lease is active", async () => {
    const persistence = createPersistence();
    const providers = createProviders();
    const event = await new OutboxService().append(
      { outboxEvent: persistence.outboxEvent },
      emailEvent,
    );
    const claimedAt = new Date("2026-09-02T00:01:00.000Z");
    Object.assign(persistence.events[0]!, {
      attempts: 1,
      claimedAt,
      status: "PROCESSING" as const,
    });
    const processor = new OutboxProcessor(
      persistence.database,
      providers,
      () => new Date("2026-09-02T00:02:00.000Z"),
    );

    await expect(processor.process(event.id)).rejects.toMatchObject({
      failureCode: "outbox_lease_contended",
    });

    expect(providers.email.send).not.toHaveBeenCalled();
    expect(persistence.events[0]).toMatchObject({
      attempts: 1,
      claimedAt,
      status: "PROCESSING",
    });
  });

  it("reclaims an event after a crashed processing lease expires", async () => {
    const persistence = createPersistence();
    const providers = createProviders();
    const event = await new OutboxService().append(
      { outboxEvent: persistence.outboxEvent },
      emailEvent,
    );
    Object.assign(persistence.events[0]!, {
      attempts: 1,
      claimedAt: new Date("2026-09-02T00:00:00.000Z"),
      status: "PROCESSING" as const,
    });
    const processor = new OutboxProcessor(
      persistence.database,
      providers,
      () => new Date("2026-09-02T00:10:00.000Z"),
    );

    await processor.process(event.id);

    expect(providers.email.send).toHaveBeenCalledOnce();
    expect(persistence.events[0]).toMatchObject({
      attempts: 2,
      claimedAt: null,
      status: "PROCESSED",
    });
  });

  it("reclaims a legacy processing event with a null lease", async () => {
    const persistence = createPersistence();
    const providers = createProviders();
    const event = await new OutboxService().append(
      { outboxEvent: persistence.outboxEvent },
      emailEvent,
    );
    Object.assign(persistence.events[0]!, {
      attempts: 1,
      claimedAt: null,
      status: "PROCESSING" as const,
    });
    const processor = new OutboxProcessor(
      persistence.database,
      providers,
      () => new Date("2026-09-02T00:02:00.000Z"),
    );

    await processor.process(event.id);

    expect(providers.email.send).toHaveBeenCalledOnce();
    expect(persistence.events[0]).toMatchObject({
      attempts: 2,
      claimedAt: null,
      status: "PROCESSED",
    });
  });

  it("releases a final dead-letter publication failure for a later retry", async () => {
    const persistence = createPersistence();
    const providers = createProviders();
    providers.deadLetters.publish
      .mockRejectedValueOnce(new Error("redis unavailable"))
      .mockResolvedValueOnce(undefined);
    const event = await new OutboxService().append(
      { outboxEvent: persistence.outboxEvent },
      emailEvent,
    );
    persistence.events[0]!.publishedAt = new Date("2026-09-02T00:00:00.000Z");
    const processor = new OutboxProcessor(persistence.database, providers);

    await expect(processor.failPermanently(event.id, "retry_exhausted")).rejects.toThrow(
      RetryableOutboxError,
    );
    expect(persistence.events[0]).toMatchObject({
      lastError: "dead_letter_unavailable",
      publishedAt: null,
      status: "PENDING",
    });

    await processor.failPermanently(event.id, "retry_exhausted");

    expect(providers.deadLetters.publish).toHaveBeenCalledTimes(2);
    expect(persistence.events[0]).toMatchObject({
      lastError: "retry_exhausted",
      status: "FAILED",
    });
  });

  it("moves permanent failures to the dead-letter boundary without a side effect", async () => {
    const persistence = createPersistence();
    const providers = createProviders();
    persistence.users.set(recipientUserId, { id: recipientUserId, isActive: false });
    const event = await new OutboxService().append(
      { outboxEvent: persistence.outboxEvent },
      emailEvent,
    );
    const processor = new OutboxProcessor(persistence.database, providers);

    await processor.process(event.id);

    expect(providers.email.send).not.toHaveBeenCalled();
    expect(providers.deadLetters.publish).toHaveBeenCalledWith({
      eventId: event.id,
      eventType: emailEvent.eventType,
      failureCode: "recipient_unavailable",
    });
    expect(persistence.events[0]).toMatchObject({ attempts: 1, status: "FAILED" });
  });
});
