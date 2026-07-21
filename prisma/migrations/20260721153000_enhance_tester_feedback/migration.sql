CREATE TYPE "TesterFeedbackStatus" AS ENUM ('unresolved', 'fixed', 'skipped');

ALTER TABLE "tester_feedback"
  ADD COLUMN "device" TEXT,
  ADD COLUMN "status" "TesterFeedbackStatus" NOT NULL DEFAULT 'unresolved',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "tester_feedback_status_idx" ON "tester_feedback"("status");
