CREATE TABLE "company_closer_assignments" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "assigned_by_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  CONSTRAINT "company_closer_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_closer_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_closer_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "company_closer_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "company_closer_assignments_company_id_user_id_key" ON "company_closer_assignments"("company_id", "user_id");
CREATE INDEX "company_closer_assignments_user_id_ended_at_idx" ON "company_closer_assignments"("user_id", "ended_at");
