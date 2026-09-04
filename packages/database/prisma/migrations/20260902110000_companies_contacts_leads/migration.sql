CREATE TYPE "LeadStatus" AS ENUM (
  'APPLIED',
  'RESPONSE_RECEIVED',
  'INTERVIEWING',
  'OFFER_RECEIVED',
  'OFFER_ACCEPTED',
  'PLACED',
  'STARTED',
  'CLOSED'
);

CREATE TYPE "LeadContactRole" AS ENUM (
  'RECRUITER',
  'HR',
  'HIRING_MANAGER',
  'INTERVIEWER'
);

CREATE TABLE "companies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "canonical_name" CITEXT NOT NULL,
  "website" TEXT,
  "domain" TEXT,
  "industry" TEXT,
  "location" TEXT,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT,
  "email" CITEXT,
  "phone" TEXT,
  "linkedin_url" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_sources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" CITEXT NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "job_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_contacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "role" "LeadContactRole" NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_contacts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "job_leads"
  ADD COLUMN "company_id" UUID,
  ADD COLUMN "source_id" UUID,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "raw_url" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "workplace_type" TEXT,
  ADD COLUMN "employment_type" TEXT,
  ADD COLUMN "contract_type" TEXT,
  ADD COLUMN "compensation_min" DECIMAL(14,2),
  ADD COLUMN "compensation_max" DECIMAL(14,2),
  ADD COLUMN "compensation_period" "CompensationPeriod",
  ADD COLUMN "applied_date" DATE,
  ADD COLUMN "is_important" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "closure_notes" TEXT,
  ADD COLUMN "started_at" TIMESTAMPTZ(6);

INSERT INTO "companies" ("canonical_name", "created_by_id")
SELECT "canonical_name", "created_by_id"
FROM (
  SELECT DISTINCT ON (LOWER("canonical_name"))
    "canonical_name",
    "created_by_id"
  FROM (
    SELECT
      CASE
        WHEN BTRIM("company_name") = '' THEN 'Legacy company ' || "id"::text
        ELSE BTRIM("company_name")
      END AS "canonical_name",
      "created_by_id",
      "created_at",
      "id"
    FROM "job_leads"
  ) AS "normalized_leads"
  ORDER BY LOWER("canonical_name"), "created_at", "id"
) AS "deduplicated_companies";

WITH "normalized_leads" AS (
  SELECT
    "id",
    CASE
      WHEN BTRIM("company_name") = '' THEN 'Legacy company ' || "id"::text
      ELSE BTRIM("company_name")
    END AS "canonical_name"
  FROM "job_leads"
)
UPDATE "job_leads" AS "lead"
SET "company_id" = "company"."id"
FROM "normalized_leads"
JOIN "companies" AS "company"
  ON "company"."canonical_name" = "normalized_leads"."canonical_name"
WHERE "lead"."id" = "normalized_leads"."id";

INSERT INTO "job_sources" ("name")
SELECT DISTINCT LOWER(COALESCE(NULLIF(BTRIM("source"), ''), 'manual'))
FROM "job_leads" AS "lead"
WHERE NOT EXISTS (
  SELECT 1 FROM "job_sources" AS "existing"
  WHERE LOWER("existing"."name") = LOWER(COALESCE(NULLIF(BTRIM("lead"."source"), ''), 'manual'))
);

UPDATE "job_leads" AS "lead"
SET "source_id" = "source"."id"
FROM "job_sources" AS "source"
WHERE "source"."name" = COALESCE(NULLIF(BTRIM("lead"."source"), ''), 'manual');

UPDATE "job_leads"
SET
  "job_title" = COALESCE(NULLIF(BTRIM("job_title"), ''), BTRIM("company_name") || ' opportunity'),
  "raw_url" = COALESCE(
    NULLIF(BTRIM("canonical_url"), ''),
    'https://legacy.orbit.invalid/job-leads/' || "id"::text
  ),
  "applied_date" = "created_at"::date,
  "compensation_min" = CASE
    WHEN "compensation_amount" >= 0 THEN "compensation_amount"
    ELSE NULL
  END;

ALTER TABLE "job_leads"
  ALTER COLUMN "company_id" SET NOT NULL,
  ALTER COLUMN "source_id" SET NOT NULL,
  ALTER COLUMN "job_title" SET NOT NULL,
  ALTER COLUMN "raw_url" SET NOT NULL,
  ALTER COLUMN "applied_date" SET NOT NULL,
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "job_leads"
  ALTER COLUMN "status" TYPE "LeadStatus"
  USING (
    CASE UPPER(REPLACE("status", '-', '_'))
      WHEN 'RESPONSE_RECEIVED' THEN 'RESPONSE_RECEIVED'
      WHEN 'INTERVIEWING' THEN 'INTERVIEWING'
      WHEN 'IN_PROCESS' THEN 'INTERVIEWING'
      WHEN 'FINAL_ROUND' THEN 'INTERVIEWING'
      WHEN 'OFFER_RECEIVED' THEN 'OFFER_RECEIVED'
      WHEN 'OFFER_ACCEPTED' THEN 'OFFER_ACCEPTED'
      WHEN 'PLACED' THEN 'PLACED'
      WHEN 'STARTED' THEN 'STARTED'
      WHEN 'CLOSED' THEN 'CLOSED'
      WHEN 'DEAD' THEN 'CLOSED'
      ELSE 'APPLIED'
    END
  )::"LeadStatus";

ALTER TABLE "job_leads"
  ALTER COLUMN "status" SET DEFAULT 'APPLIED';

ALTER TABLE "lead_status_transitions"
  ALTER COLUMN "from_status" TYPE "LeadStatus"
  USING (
    CASE
      WHEN "from_status" IS NULL THEN NULL
      WHEN UPPER(REPLACE("from_status", '-', '_')) = 'RESPONSE_RECEIVED' THEN 'RESPONSE_RECEIVED'
      WHEN UPPER(REPLACE("from_status", '-', '_')) IN ('INTERVIEWING', 'IN_PROCESS', 'FINAL_ROUND') THEN 'INTERVIEWING'
      WHEN UPPER(REPLACE("from_status", '-', '_')) = 'OFFER_RECEIVED' THEN 'OFFER_RECEIVED'
      WHEN UPPER(REPLACE("from_status", '-', '_')) = 'OFFER_ACCEPTED' THEN 'OFFER_ACCEPTED'
      WHEN UPPER(REPLACE("from_status", '-', '_')) = 'PLACED' THEN 'PLACED'
      WHEN UPPER(REPLACE("from_status", '-', '_')) = 'STARTED' THEN 'STARTED'
      WHEN UPPER(REPLACE("from_status", '-', '_')) IN ('CLOSED', 'DEAD') THEN 'CLOSED'
      ELSE 'APPLIED'
    END
  )::"LeadStatus",
  ALTER COLUMN "to_status" TYPE "LeadStatus"
  USING (
    CASE UPPER(REPLACE("to_status", '-', '_'))
      WHEN 'RESPONSE_RECEIVED' THEN 'RESPONSE_RECEIVED'
      WHEN 'INTERVIEWING' THEN 'INTERVIEWING'
      WHEN 'IN_PROCESS' THEN 'INTERVIEWING'
      WHEN 'FINAL_ROUND' THEN 'INTERVIEWING'
      WHEN 'OFFER_RECEIVED' THEN 'OFFER_RECEIVED'
      WHEN 'OFFER_ACCEPTED' THEN 'OFFER_ACCEPTED'
      WHEN 'PLACED' THEN 'PLACED'
      WHEN 'STARTED' THEN 'STARTED'
      WHEN 'CLOSED' THEN 'CLOSED'
      WHEN 'DEAD' THEN 'CLOSED'
      ELSE 'APPLIED'
    END
  )::"LeadStatus";

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "contacts_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lead_contacts"
  ADD CONSTRAINT "lead_contacts_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "lead_contacts_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_leads"
  ADD CONSTRAINT "job_leads_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "job_leads_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "job_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "job_leads_compensation_range_check" CHECK (
    ("compensation_min" IS NULL OR "compensation_min" >= 0)
    AND ("compensation_max" IS NULL OR "compensation_max" >= 0)
    AND (
      "compensation_min" IS NULL
      OR "compensation_max" IS NULL
      OR "compensation_min" <= "compensation_max"
    )
  );

CREATE UNIQUE INDEX "companies_canonical_name_key" ON "companies"("canonical_name");
CREATE INDEX "companies_domain_idx" ON "companies"("domain");
CREATE INDEX "contacts_company_id_name_idx" ON "contacts"("company_id", "name");
CREATE UNIQUE INDEX "job_sources_name_key" ON "job_sources"("name");
CREATE INDEX "lead_contacts_contact_id_idx" ON "lead_contacts"("contact_id");
CREATE UNIQUE INDEX "lead_contacts_primary_lead_key"
  ON "lead_contacts"("lead_id")
  WHERE "is_primary";
CREATE INDEX "job_leads_company_id_idx" ON "job_leads"("company_id");
CREATE INDEX "job_leads_source_id_idx" ON "job_leads"("source_id");
CREATE INDEX "job_leads_profile_id_status_applied_date_idx"
  ON "job_leads"("profile_id", "status", "applied_date");
CREATE INDEX "job_leads_profile_id_is_important_applied_date_idx"
  ON "job_leads"("profile_id", "is_important", "applied_date");

ALTER TABLE "lead_contacts"
  ADD CONSTRAINT "lead_contacts_lead_id_contact_id_key" UNIQUE ("lead_id", "contact_id");
