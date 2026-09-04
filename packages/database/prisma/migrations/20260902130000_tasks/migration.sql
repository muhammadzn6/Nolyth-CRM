CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "TaskType" AS ENUM ('FOLLOW_UP', 'PREPARE_INTERVIEW', 'GENERAL');
CREATE TABLE "tasks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "profile_id" UUID NOT NULL, "lead_id" UUID,
  "assignee_id" UUID NOT NULL, "creator_id" UUID NOT NULL, "type" "TaskType" NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM', "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "due_at" TIMESTAMPTZ(6) NOT NULL, "completed_at" TIMESTAMPTZ(6), "completed_notes" TEXT,
  "canceled_at" TIMESTAMPTZ(6), "canceled_reason" TEXT, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "tasks_profile_id_status_due_at_idx" ON "tasks"("profile_id", "status", "due_at");
CREATE INDEX "tasks_assignee_id_status_due_at_idx" ON "tasks"("assignee_id", "status", "due_at");
CREATE INDEX "tasks_lead_id_idx" ON "tasks"("lead_id");
