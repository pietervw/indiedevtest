CREATE TYPE "TesterActivityType" AS ENUM ('requested', 'approved', 'invitation_resent', 'joined', 'completed', 'withdrew', 'declined', 'decline_reversed');
CREATE TYPE "TesterFeedbackSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

ALTER TABLE "app_listings"
  ADD COLUMN "auto_closed_for_capacity" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tester_requests"
  ADD COLUMN "withdrawn_at" TIMESTAMP(3);

CREATE TABLE "tester_activities" (
  "id" TEXT NOT NULL,
  "app_listing_id" TEXT NOT NULL,
  "tester_request_id" TEXT NOT NULL,
  "tester_user_id" TEXT NOT NULL,
  "type" "TesterActivityType" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_activities_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "tester_activities" ADD CONSTRAINT "tester_activities_app_listing_id_fkey" FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tester_activities" ADD CONSTRAINT "tester_activities_tester_request_id_fkey" FOREIGN KEY ("tester_request_id") REFERENCES "tester_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tester_activities" ADD CONSTRAINT "tester_activities_tester_user_id_fkey" FOREIGN KEY ("tester_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "tester_activities_app_listing_id_created_at_idx" ON "tester_activities"("app_listing_id", "created_at");
CREATE INDEX "tester_activities_tester_request_id_created_at_idx" ON "tester_activities"("tester_request_id", "created_at");

CREATE TABLE "tester_feedback" (
  "id" TEXT NOT NULL,
  "app_listing_id" TEXT NOT NULL,
  "tester_user_id" TEXT NOT NULL,
  "severity" "TesterFeedbackSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "steps" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_feedback_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "tester_feedback" ADD CONSTRAINT "tester_feedback_app_listing_id_fkey" FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tester_feedback" ADD CONSTRAINT "tester_feedback_tester_user_id_fkey" FOREIGN KEY ("tester_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "tester_feedback_app_listing_id_created_at_idx" ON "tester_feedback"("app_listing_id", "created_at");
CREATE INDEX "tester_feedback_tester_user_id_created_at_idx" ON "tester_feedback"("tester_user_id", "created_at");
