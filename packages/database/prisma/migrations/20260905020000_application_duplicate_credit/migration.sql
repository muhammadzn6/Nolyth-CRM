ALTER TYPE "DuplicateClassification" RENAME TO "DuplicateClassification_old";
CREATE TYPE "DuplicateClassification" AS ENUM ('NONE', 'LIKELY', 'CONFIRMED');

ALTER TABLE "duplicate_reviews"
  ALTER COLUMN "classification" DROP DEFAULT,
  ALTER COLUMN "classification" TYPE "DuplicateClassification"
    USING "classification"::text::"DuplicateClassification",
  ALTER COLUMN "classification" SET DEFAULT 'LIKELY';

ALTER TABLE "job_leads"
  ADD COLUMN "duplicate_classification" "DuplicateClassification" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "qualified_credit" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "job_leads_active_profile_canonical_url_key";
CREATE INDEX "job_leads_duplicate_classification_qualified_credit_idx"
  ON "job_leads"("duplicate_classification", "qualified_credit");

DROP TYPE "DuplicateClassification_old";
