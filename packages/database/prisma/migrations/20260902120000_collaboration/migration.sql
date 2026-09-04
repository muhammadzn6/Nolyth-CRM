CREATE TYPE "CommunicationType" AS ENUM ('EMAIL', 'PHONE', 'LINKEDIN', 'JOB_PLATFORM', 'NOTE');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
CREATE TYPE "CollaborationVisibility" AS ENUM ('INTERNAL_TEAM', 'SHARED_WITH_CLOSER');
CREATE TABLE "communications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "lead_id" UUID NOT NULL, "contact_id" UUID,
  "author_id" UUID NOT NULL, "type" "CommunicationType" NOT NULL, "direction" "CommunicationDirection" NOT NULL,
  "subject" TEXT, "body" TEXT NOT NULL, "occurred_at" TIMESTAMPTZ(6) NOT NULL, "outcome" TEXT,
  "visibility" "CollaborationVisibility" NOT NULL, "next_action_summary" TEXT, "next_action_due_at" TIMESTAMPTZ(6),
  "archived_at" TIMESTAMPTZ(6), "archive_reason" TEXT, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "comments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "lead_id" UUID NOT NULL, "author_id" UUID NOT NULL, "body" TEXT NOT NULL,
  "visibility" "CollaborationVisibility" NOT NULL, "archived_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "communications" ADD CONSTRAINT "communications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "communications_lead_id_occurred_at_idx" ON "communications"("lead_id", "occurred_at");
CREATE INDEX "communications_contact_id_idx" ON "communications"("contact_id");
CREATE INDEX "comments_lead_id_created_at_idx" ON "comments"("lead_id", "created_at");
