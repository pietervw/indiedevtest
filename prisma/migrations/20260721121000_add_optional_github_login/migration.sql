-- Keep the old username column for legacy /dev/<github-username> redirects,
-- while storing the actual linked GitHub login separately and optionally.
ALTER TABLE "users"
  ADD COLUMN "github_login" TEXT;

UPDATE "users"
SET "github_login" = "github_username"
WHERE "github_id" IS NOT NULL;

ALTER TABLE "users"
  ALTER COLUMN "github_username" DROP NOT NULL;

CREATE UNIQUE INDEX "users_github_login_key" ON "users"("github_login");
