ALTER TABLE "notifications" ADD COLUMN "idempotency_key" TEXT;
UPDATE "notifications" SET "idempotency_key" = 'legacy:' || "id"::text WHERE "idempotency_key" IS NULL;
ALTER TABLE "notifications" ALTER COLUMN "idempotency_key" SET NOT NULL;
CREATE UNIQUE INDEX "notifications_idempotency_key_key" ON "notifications"("idempotency_key");
