-- CreateTable
CREATE TABLE "app_listing_screenshots" (
    "id" TEXT NOT NULL,
    "app_listing_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_listing_screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_listing_screenshots_object_key_key" ON "app_listing_screenshots"("object_key");

-- CreateIndex
CREATE INDEX "app_listing_screenshots_app_listing_id_sort_order_idx" ON "app_listing_screenshots"("app_listing_id", "sort_order");

-- AddForeignKey
ALTER TABLE "app_listing_screenshots" ADD CONSTRAINT "app_listing_screenshots_app_listing_id_fkey" FOREIGN KEY ("app_listing_id") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
