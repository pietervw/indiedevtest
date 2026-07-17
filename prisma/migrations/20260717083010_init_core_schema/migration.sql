-- CreateEnum
CREATE TYPE "AppCategory" AS ENUM ('game', 'utility', 'productivity');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('android', 'ios');

-- CreateEnum
CREATE TYPE "AppListingStatus" AS ENUM ('draft', 'open_for_testing', 'closed_for_testing', 'testing_complete', 'launched');

-- CreateEnum
CREATE TYPE "TesterRequestStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "TestAssignmentStatus" AS ENUM ('active', 'completed', 'incomplete', 'cancelled');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('first_12', 'super_tester', 'helpful_dev');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "profile_score_joined" INTEGER NOT NULL DEFAULT 0,
    "profile_score_completed" INTEGER NOT NULL DEFAULT 0,
    "reviews_written_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_listings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AppCategory" NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "AppListingStatus" NOT NULL DEFAULT 'draft',
    "store_link" TEXT,
    "max_testers_per_platform" INTEGER NOT NULL DEFAULT 14,
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tester_requests" (
    "id" TEXT NOT NULL,
    "app_listing_id" TEXT NOT NULL,
    "tester_user_id" TEXT NOT NULL,
    "tester_email" TEXT NOT NULL,
    "status" "TesterRequestStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "test_assignment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tester_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_assignments" (
    "id" TEXT NOT NULL,
    "app_listing_id" TEXT NOT NULL,
    "tester_user_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "TestAssignmentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "app_listing_id" TEXT NOT NULL,
    "tester_user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_type" "BadgeType" NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE INDEX "app_listings_status_idx" ON "app_listings"("status");

-- CreateIndex
CREATE INDEX "app_listings_user_id_idx" ON "app_listings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tester_requests_test_assignment_id_key" ON "tester_requests"("test_assignment_id");

-- CreateIndex
CREATE INDEX "tester_requests_tester_user_id_idx" ON "tester_requests"("tester_user_id");

-- CreateIndex
CREATE INDEX "tester_requests_status_idx" ON "tester_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tester_requests_app_listing_id_tester_user_id_key" ON "tester_requests"("app_listing_id", "tester_user_id");

-- CreateIndex
CREATE INDEX "test_assignments_tester_user_id_idx" ON "test_assignments"("tester_user_id");

-- CreateIndex
CREATE INDEX "test_assignments_status_idx" ON "test_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_assignments_app_listing_id_tester_user_id_key" ON "test_assignments"("app_listing_id", "tester_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_app_listing_id_tester_user_id_key" ON "reviews"("app_listing_id", "tester_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_type_key" ON "user_badges"("user_id", "badge_type");

-- AddForeignKey
ALTER TABLE "app_listings" ADD CONSTRAINT "app_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tester_requests" ADD CONSTRAINT "tester_requests_app_listing_id_fkey" FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tester_requests" ADD CONSTRAINT "tester_requests_tester_user_id_fkey" FOREIGN KEY ("tester_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tester_requests" ADD CONSTRAINT "tester_requests_test_assignment_id_fkey" FOREIGN KEY ("test_assignment_id") REFERENCES "test_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_assignments" ADD CONSTRAINT "test_assignments_app_listing_id_fkey" FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_assignments" ADD CONSTRAINT "test_assignments_tester_user_id_fkey" FOREIGN KEY ("tester_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_app_listing_id_fkey" FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tester_user_id_fkey" FOREIGN KEY ("tester_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
