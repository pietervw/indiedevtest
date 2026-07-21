CREATE TYPE "ListingModerationStatus" AS ENUM ('visible', 'hidden', 'removed');
CREATE TYPE "ListingReportReason" AS ENUM ('spam_or_scam', 'inappropriate_content', 'broken_or_misleading_link', 'impersonation', 'other');
CREATE TYPE "ListingReportStatus" AS ENUM ('open', 'dismissed');

ALTER TABLE "app_listings"
  ADD COLUMN "moderation_status" "ListingModerationStatus" NOT NULL DEFAULT 'visible';

CREATE TABLE "listing_reports" (
  "id" TEXT NOT NULL,
  "app_listing_id" TEXT NOT NULL,
  "reporter_id" TEXT NOT NULL,
  "reason" "ListingReportReason" NOT NULL,
  "details" TEXT,
  "status" "ListingReportStatus" NOT NULL DEFAULT 'open',
  "resolved_at" TIMESTAMP(3),
  "resolved_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "listing_reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "listing_reports"
  ADD CONSTRAINT "listing_reports_app_listing_id_fkey"
  FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_reports"
  ADD CONSTRAINT "listing_reports_reporter_id_fkey"
  FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_reports"
  ADD CONSTRAINT "listing_reports_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "listing_reports_app_listing_id_status_idx" ON "listing_reports"("app_listing_id", "status");
CREATE INDEX "listing_reports_reporter_id_created_at_idx" ON "listing_reports"("reporter_id", "created_at");
CREATE INDEX "listing_reports_status_created_at_idx" ON "listing_reports"("status", "created_at");
CREATE UNIQUE INDEX "listing_reports_one_open_per_reporter_listing"
  ON "listing_reports"("app_listing_id", "reporter_id") WHERE "status" = 'open';
