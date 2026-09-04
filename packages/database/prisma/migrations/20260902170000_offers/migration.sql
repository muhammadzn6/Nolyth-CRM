CREATE TYPE "OfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED');
CREATE TABLE "offers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "lead_id" UUID NOT NULL, "status" "OfferStatus" NOT NULL DEFAULT 'OFFERED',
  "compensation_amount" DECIMAL(14,2) NOT NULL, "compensation_currency" VARCHAR(3) NOT NULL, "employment_type" TEXT NOT NULL,
  "details" TEXT NOT NULL, "decision_deadline" TIMESTAMPTZ(6), "accepted_at" TIMESTAMPTZ(6), "start_date" DATE, "started_at" TIMESTAMPTZ(6),
  "created_by_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1, CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "offers" ADD CONSTRAINT "offers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "offers_lead_id_status_idx" ON "offers"("lead_id", "status");
