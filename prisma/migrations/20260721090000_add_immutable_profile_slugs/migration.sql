-- Public profile URLs must not contain Clerk IDs or change when GitHub is
-- connected later. Existing GitHub usernames stay available for legacy URL
-- lookups; every user receives a new opaque, permanent public slug.
ALTER TABLE "users" ADD COLUMN "profile_slug" TEXT;

UPDATE "users"
SET "profile_slug" = 'member-' || substring(md5(random()::text || "id") from 1 for 24)
WHERE "profile_slug" IS NULL;

ALTER TABLE "users" ALTER COLUMN "profile_slug" SET NOT NULL;
CREATE UNIQUE INDEX "users_profile_slug_key" ON "users"("profile_slug");
