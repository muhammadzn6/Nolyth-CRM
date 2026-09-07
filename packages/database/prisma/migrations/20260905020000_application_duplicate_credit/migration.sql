ALTER TABLE "job_leads"
  ADD COLUMN IF NOT EXISTS "duplicate_classification" "DuplicateClassification" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "qualified_credit" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "job_leads_active_profile_canonical_url_key";
CREATE INDEX IF NOT EXISTS "job_leads_duplicate_classification_qualified_credit_idx"
  ON "job_leads"("duplicate_classification", "qualified_credit");
