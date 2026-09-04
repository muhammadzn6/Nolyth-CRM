CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "recipient_id" UUID NOT NULL, "type" TEXT NOT NULL, "title" TEXT NOT NULL,
  "message" TEXT NOT NULL, "related_entity_type" TEXT, "related_entity_id" UUID, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6), CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "notification_id" UUID NOT NULL, "channel" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ(6), "delivered_at" TIMESTAMPTZ(6), "failure_reason" TEXT,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "notifications_recipient_id_read_at_created_at_idx" ON "notifications"("recipient_id", "read_at", "created_at");
CREATE INDEX "notification_deliveries_notification_id_channel_idx" ON "notification_deliveries"("notification_id", "channel");
