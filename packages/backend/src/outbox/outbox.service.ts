import type { EmailProvider } from "../providers/email.port";
import type { NotificationProvider } from "../providers/notification.port";
import {
  parseStoredOutboxEvent,
  type OutboxEventInput,
  type StoredOutboxEvent,
  type TypedStoredOutboxEvent,
} from "./outbox.types";

type OutboxStatus = StoredOutboxEvent["status"];

type OutboxUpdate = {
  attempts?: { increment: number };
  claimedAt?: Date | null;
  lastError?: string | null;
  processedAt?: Date | null;
  publishedAt?: Date | null;
  status?: OutboxStatus;
};

type OutboxWhere = {
  id: string;
  status?: OutboxStatus;
  OR?: Array<
    | { status: "PENDING" }
    | { status: "PROCESSING"; claimedAt: null | { lt: Date } }
  >;
};

type OutboxEventPersistence = {
  upsert(args: {
    where: { idempotencyKey: string };
    create: OutboxEventInput;
    update: Record<string, never>;
  }): Promise<StoredOutboxEvent>;
  findUnique(args: { where: { id: string } }): Promise<StoredOutboxEvent | null>;
  updateMany(args: {
    where: OutboxWhere;
    data: OutboxUpdate;
  }): Promise<{ count: number }>;
};

export type OutboxAppendTransaction = {
  outboxEvent: Pick<OutboxEventPersistence, "upsert">;
};

export type OutboxDatabase = {
  outboxEvent: OutboxEventPersistence;
  user: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; isActive: true };
    }): Promise<{ id: string; isActive: boolean } | null>;
  };
};

export type OutboxDeadLetter = {
  eventId: string;
  eventType: string;
  failureCode: string;
};

export interface OutboxDeadLetterPort {
  publish(deadLetter: OutboxDeadLetter): Promise<void>;
}

type OutboxProcessorProviders = {
  email: EmailProvider;
  notifications: NotificationProvider;
  deadLetters: OutboxDeadLetterPort;
};

export class RetryableOutboxError extends Error {
  constructor(
    readonly failureCode: string,
    options?: ErrorOptions,
  ) {
    super(failureCode, options);
    this.name = "RetryableOutboxError";
  }
}

export class PermanentOutboxError extends Error {
  constructor(readonly failureCode: string) {
    super(failureCode);
    this.name = "PermanentOutboxError";
  }
}

export class OutboxService {
  append(tx: OutboxAppendTransaction, event: OutboxEventInput): Promise<StoredOutboxEvent> {
    return tx.outboxEvent.upsert({
      where: { idempotencyKey: event.idempotencyKey },
      create: event,
      update: {},
    });
  }
}

export class OutboxProcessor {
  constructor(
    private readonly database: OutboxDatabase,
    private readonly providers: OutboxProcessorProviders,
    private readonly now: () => Date = () => new Date(),
    private readonly leaseDurationMs = 5 * 60 * 1_000,
  ) {}

  async process(eventId: string): Promise<void> {
    const event = await this.database.outboxEvent.findUnique({ where: { id: eventId } });

    if (!event || event.status === "PROCESSED" || event.status === "FAILED") return;

    const claimedAt = this.now();
    const leaseCutoff = new Date(claimedAt.getTime() - this.leaseDurationMs);
    const claim = await this.database.outboxEvent.updateMany({
      where: {
        id: event.id,
        OR: [
          { status: "PENDING" },
          { status: "PROCESSING", claimedAt: null },
          { status: "PROCESSING", claimedAt: { lt: leaseCutoff } },
        ],
      },
      data: {
        attempts: { increment: 1 },
        claimedAt,
        lastError: null,
        status: "PROCESSING",
      },
    });

    if (claim.count === 0) {
      throw new RetryableOutboxError("outbox_lease_contended");
    }

    try {
      await this.performSideEffect(event);
      await this.requireStateTransition(event.id, "PROCESSING", {
        claimedAt: null,
        lastError: null,
        processedAt: this.now(),
        status: "PROCESSED",
      });
    } catch (error) {
      if (error instanceof PermanentOutboxError) {
        await this.failClaimedEvent(event, error.failureCode);
        return;
      }

      const retryable =
        error instanceof RetryableOutboxError
          ? error
          : new RetryableOutboxError("provider_error", { cause: error });

      await this.releaseForRetry(event.id, retryable.failureCode);
      throw retryable;
    }
  }

  async failPermanently(eventId: string, failureCode: string): Promise<void> {
    const event = await this.database.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status === "PROCESSED" || event.status === "FAILED") return;

    try {
      await this.providers.deadLetters.publish({
        eventId: event.id,
        eventType: event.eventType,
        failureCode,
      });
    } catch (error) {
      await this.requireStateTransition(event.id, event.status, {
        claimedAt: null,
        lastError: "dead_letter_unavailable",
        publishedAt: null,
        status: "PENDING",
      });
      throw new RetryableOutboxError("dead_letter_unavailable", { cause: error });
    }

    await this.requireStateTransition(event.id, event.status, {
      claimedAt: null,
      lastError: failureCode,
      status: "FAILED",
    });
  }

  private async performSideEffect(storedEvent: StoredOutboxEvent): Promise<void> {
    let event: TypedStoredOutboxEvent;

    try {
      event = parseStoredOutboxEvent(storedEvent);
    } catch {
      throw new PermanentOutboxError("invalid_event_payload");
    }

    if (event.aggregateType !== "user" || event.aggregateId !== event.payload.recipientUserId) {
      throw new PermanentOutboxError("invalid_event_payload");
    }

    await this.requireActiveRecipient(event.payload.recipientUserId);

    switch (event.eventType) {
      case "email.send_requested":
        await this.providers.email.send({
          idempotencyKey: event.idempotencyKey,
          to: event.payload.to,
          subject: event.payload.subject,
          text: event.payload.text,
        });
        return;
      case "notification.create_requested":
        await this.providers.notifications.createInApp({
          ...event.payload,
          idempotencyKey: event.idempotencyKey,
        });
        return;
    }
  }

  private async requireActiveRecipient(recipientUserId: string): Promise<void> {
    const recipient = await this.database.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true, isActive: true },
    });

    if (!recipient?.isActive) {
      throw new PermanentOutboxError("recipient_unavailable");
    }
  }

  private async failClaimedEvent(
    event: StoredOutboxEvent,
    failureCode: string,
  ): Promise<void> {
    try {
      await this.providers.deadLetters.publish({
        eventId: event.id,
        eventType: event.eventType,
        failureCode,
      });
    } catch (error) {
      await this.releaseForRetry(event.id, "dead_letter_unavailable");
      throw new RetryableOutboxError("dead_letter_unavailable", { cause: error });
    }

    await this.requireStateTransition(event.id, "PROCESSING", {
      claimedAt: null,
      lastError: failureCode,
      status: "FAILED",
    });
  }

  private async releaseForRetry(eventId: string, failureCode: string): Promise<void> {
    await this.requireStateTransition(eventId, "PROCESSING", {
      claimedAt: null,
      lastError: failureCode,
      status: "PENDING",
    });
  }

  private async requireStateTransition(
    eventId: string,
    status: OutboxStatus,
    data: OutboxUpdate,
  ): Promise<void> {
    const result = await this.database.outboxEvent.updateMany({
      where: { id: eventId, status },
      data,
    });

    if (result.count !== 1) {
      throw new RetryableOutboxError("outbox_state_conflict");
    }
  }
}

export type { OutboxEventInput } from "./outbox.types";
