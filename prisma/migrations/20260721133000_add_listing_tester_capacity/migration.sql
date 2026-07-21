ALTER TABLE "app_listings"
  ADD COLUMN "tester_capacity" INTEGER;

ALTER TABLE "app_listings"
  ADD CONSTRAINT "app_listings_tester_capacity_positive"
  CHECK ("tester_capacity" IS NULL OR "tester_capacity" > 0);
