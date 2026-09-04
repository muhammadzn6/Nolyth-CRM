CREATE TYPE "DocumentType" AS ENUM ('CV', 'COVER_LETTER', 'SUPPORTING', 'OTHER');
CREATE TYPE "DocumentUsageType" AS ENUM ('CV', 'SUPPORTING');
CREATE TABLE "documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "profile_id" UUID NOT NULL, "type" "DocumentType" NOT NULL, "title" TEXT NOT NULL,
  "current_version_id" UUID, "archived_at" TIMESTAMPTZ(6), "archive_reason" TEXT, "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1, CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "document_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "document_id" UUID NOT NULL, "version_number" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL, "original_filename" TEXT NOT NULL, "mime_type" TEXT NOT NULL, "size_bytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL, "uploaded_by_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "lead_document_usages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "lead_id" UUID NOT NULL, "document_version_id" UUID NOT NULL,
  "usage_type" "DocumentUsageType" NOT NULL, "attached_by_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_document_usages_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "documents" ADD CONSTRAINT "documents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_document_usages" ADD CONSTRAINT "lead_document_usages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_document_usages" ADD CONSTRAINT "lead_document_usages_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_document_usages" ADD CONSTRAINT "lead_document_usages_attached_by_id_fkey" FOREIGN KEY ("attached_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "documents_profile_id_archived_at_idx" ON "documents"("profile_id", "archived_at");
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");
CREATE INDEX "lead_document_usages_lead_id_idx" ON "lead_document_usages"("lead_id");
CREATE UNIQUE INDEX "lead_document_usages_lead_id_document_version_id_usage_type_key" ON "lead_document_usages"("lead_id", "document_version_id", "usage_type");
