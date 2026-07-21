-- Clerk user IDs are the primary local identity. GitHub is optional so users
-- who sign up through Clerk email/password can still create a local profile.
ALTER TABLE "users"
  ALTER COLUMN "github_id" DROP NOT NULL;
