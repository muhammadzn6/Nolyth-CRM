export const OUTBOX_EVENT_TYPES = [
  "email.send_requested",
  "notification.create_requested",
] as const;

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];

export type EmailSendRequestedPayload = {
  recipientUserId: string;
  to: string;
  subject: string;
  text: string;
};

export type NotificationCreateRequestedPayload = {
  recipientUserId: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

type OutboxEventEnvelope = {
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
};

export type OutboxEventInput = OutboxEventEnvelope &
  (
    | {
        eventType: "email.send_requested";
        payload: EmailSendRequestedPayload;
      }
    | {
        eventType: "notification.create_requested";
        payload: NotificationCreateRequestedPayload;
      }
  );

export type StoredOutboxEvent = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  idempotencyKey: string;
  payload: unknown;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
  attempts: number;
  claimedAt: Date | null;
  lastError: string | null;
  processedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
};

export type TypedStoredOutboxEvent = StoredOutboxEvent & OutboxEventInput;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid outbox field: ${field}`);
  }

  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field);
}

export function parseStoredOutboxEvent(event: StoredOutboxEvent): TypedStoredOutboxEvent {
  if (!isRecord(event.payload)) {
    throw new Error("Invalid outbox field: payload");
  }

  const envelope = {
    ...event,
    aggregateType: requiredString(event.aggregateType, "aggregateType"),
    aggregateId: requiredString(event.aggregateId, "aggregateId"),
    idempotencyKey: requiredString(event.idempotencyKey, "idempotencyKey"),
  };

  if (event.eventType === "email.send_requested") {
    return {
      ...envelope,
      eventType: event.eventType,
      payload: {
        recipientUserId: requiredString(event.payload.recipientUserId, "recipientUserId"),
        to: requiredString(event.payload.to, "to"),
        subject: requiredString(event.payload.subject, "subject"),
        text: requiredString(event.payload.text, "text"),
      },
    };
  }

  if (event.eventType === "notification.create_requested") {
    return {
      ...envelope,
      eventType: event.eventType,
      payload: {
        recipientUserId: requiredString(event.payload.recipientUserId, "recipientUserId"),
        title: requiredString(event.payload.title, "title"),
        message: requiredString(event.payload.message, "message"),
        relatedEntityType: optionalString(
          event.payload.relatedEntityType,
          "relatedEntityType",
        ),
        relatedEntityId: optionalString(event.payload.relatedEntityId, "relatedEntityId"),
      },
    };
  }

  throw new Error(`Unsupported outbox event type: ${event.eventType}`);
}
