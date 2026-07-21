-- Private developer-provided handoff details. These are intentionally nullable
-- so existing listings remain valid and are never exposed in public payloads.
ALTER TABLE "app_listings"
  ADD COLUMN "testing_access_url" TEXT,
  ADD COLUMN "tester_instructions" TEXT;
