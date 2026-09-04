CREATE TYPE "AvailabilityExceptionType" AS ENUM ('AVAILABLE_OVERRIDE', 'UNAVAILABLE', 'LEAVE');
CREATE TABLE "availability_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "closer_id" UUID NOT NULL, "day_of_week" INTEGER NOT NULL,
  "local_start" TEXT NOT NULL, "local_end" TEXT NOT NULL, "timezone" TEXT NOT NULL, "effective_from" TIMESTAMPTZ(6), "effective_to" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "availability_exceptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "closer_id" UUID NOT NULL, "starts_at" TIMESTAMPTZ(6) NOT NULL, "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "type" "AvailabilityExceptionType" NOT NULL, "reason" TEXT,
  CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_closer_id_fkey" FOREIGN KEY ("closer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_closer_id_fkey" FOREIGN KEY ("closer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "availability_rules_closer_id_day_of_week_idx" ON "availability_rules"("closer_id", "day_of_week");
CREATE INDEX "availability_exceptions_closer_id_starts_at_ends_at_idx" ON "availability_exceptions"("closer_id", "starts_at", "ends_at");
