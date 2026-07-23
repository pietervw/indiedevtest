-- AlterTable
ALTER TABLE "app_listings" ADD COLUMN "show_tester_feedback" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: rename review free-text to improvement suggestion + updated_at
ALTER TABLE "reviews" RENAME COLUMN "content" TO "improvement_suggestion";
ALTER TABLE "reviews" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "review_screenshots" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_screenshot_uploads" (
    "id" TEXT NOT NULL,
    "app_listing_id" TEXT NOT NULL,
    "tester_user_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_screenshot_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_screenshots_object_key_key" ON "review_screenshots"("object_key");

-- CreateIndex
CREATE INDEX "review_screenshots_review_id_sort_order_idx" ON "review_screenshots"("review_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "review_screenshot_uploads_object_key_key" ON "review_screenshot_uploads"("object_key");

-- CreateIndex
CREATE INDEX "review_screenshot_uploads_app_listing_id_tester_user_id_expires_at_idx" ON "review_screenshot_uploads"("app_listing_id", "tester_user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "review_screenshots" ADD CONSTRAINT "review_screenshots_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_screenshot_uploads" ADD CONSTRAINT "review_screenshot_uploads_app_listing_id_fkey" FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
