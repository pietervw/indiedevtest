-- CreateTable
CREATE TABLE "app_listing_screenshot_uploads" (
    "id" TEXT NOT NULL,
    "app_listing_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_listing_screenshot_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_listing_screenshot_uploads_object_key_key" ON "app_listing_screenshot_uploads"("object_key");

-- CreateIndex
CREATE INDEX "app_listing_screenshot_uploads_app_listing_id_expires_at_idx" ON "app_listing_screenshot_uploads"("app_listing_id", "expires_at");

-- AddForeignKey
ALTER TABLE "app_listing_screenshot_uploads" ADD CONSTRAINT "app_listing_screenshot_uploads_app_listing_id_fkey" FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
