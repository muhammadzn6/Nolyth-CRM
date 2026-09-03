CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'RESCHEDULE_REQUIRED', 'CANCELLED', 'NO_SHOW', 'COMPLETED', 'WAITING_FEEDBACK', 'PASSED', 'FAILED');
CREATE TYPE "InterviewRoundType" AS ENUM ('PRE_SCREEN', 'RECRUITER', 'HR', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'HIRING_MANAGER', 'FINAL', 'OTHER');
CREATE TYPE "InterviewAttendance" AS ENUM ('ATTENDED', 'MISSED', 'UNKNOWN');
CREATE TABLE "interview_rounds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "lead_id" UUID NOT NULL, "round_number" INTEGER NOT NULL,
  "round_type" "InterviewRoundType" NOT NULL, "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
  "closer_id" UUID NOT NULL, "creator_id" UUID NOT NULL, "starts_at" TIMESTAMPTZ(6) NOT NULL, "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "timezone" TEXT NOT NULL, "original_datetime_text" TEXT NOT NULL, "interviewer" TEXT, "meeting_link" TEXT, "location" TEXT,
  "preparation_notes" TEXT, "closer_notes" TEXT, "official_feedback" TEXT, "official_result" TEXT, "attendance" "InterviewAttendance",
  "completed_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1, CONSTRAINT "interview_rounds_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "interview_rounds" ADD CONSTRAINT "interview_rounds_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_rounds" ADD CONSTRAINT "interview_rounds_closer_id_fkey" FOREIGN KEY ("closer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_rounds" ADD CONSTRAINT "interview_rounds_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "interview_rounds_lead_id_round_number_key" ON "interview_rounds"("lead_id", "round_number");
CREATE INDEX "interview_rounds_closer_id_starts_at_idx" ON "interview_rounds"("closer_id", "starts_at");
CREATE INDEX "interview_rounds_lead_id_starts_at_idx" ON "interview_rounds"("lead_id", "starts_at");
