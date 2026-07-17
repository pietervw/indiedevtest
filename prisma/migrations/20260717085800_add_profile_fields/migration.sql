-- AlterTable
ALTER TABLE "users" ADD COLUMN "github_username" TEXT;
ALTER TABLE "users" ADD COLUMN "image_url" TEXT;

-- Backfill existing rows (dev placeholders until next Clerk sync)
UPDATE "users"
SET "github_username" = 'user-' || "github_id"
WHERE "github_username" IS NULL;

ALTER TABLE "users" ALTER COLUMN "github_username" SET NOT NULL;

CREATE UNIQUE INDEX "users_github_username_key" ON "users"("github_username");
