-- One completed review earns one spendable point. Accepting a tester spends it.
ALTER TABLE "users"
ADD COLUMN "review_points" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "reviews"
ADD COLUMN "point_awarded_at" TIMESTAMP(3);

ALTER TABLE "tester_requests"
ADD COLUMN "point_consumed_at" TIMESTAMP(3);

-- Existing complete evidence has already earned its one lifetime point.
UPDATE "reviews" AS r
SET "point_awarded_at" = r.updated_at
WHERE length(btrim(r.improvement_suggestion)) >= 10
  AND (
    SELECT COUNT(*)::int
    FROM "review_screenshots" s
    WHERE s.review_id = r.id
  ) >= 4;

-- Treat every historical approval as already paid for, including requests
-- that were later withdrawn or completed.
UPDATE "tester_requests" AS tr
SET "point_consumed_at" = COALESCE(
  (
    SELECT MIN(ta.created_at)
    FROM "tester_activities" ta
    WHERE ta.tester_request_id = tr.id
      AND ta.type = 'approved'
  ),
  tr.updated_at
)
WHERE tr.status = 'accepted'
   OR tr.test_assignment_id IS NOT NULL
   OR EXISTS (
     SELECT 1
     FROM "tester_activities" ta
     WHERE ta.tester_request_id = tr.id
       AND ta.type = 'approved'
   );

-- Start existing users at earned lifetime points minus historical approvals.
UPDATE "users" AS u
SET "review_points" = GREATEST(
  (
    SELECT COUNT(*)::int
    FROM "reviews" r
    WHERE r.tester_user_id = u.id
      AND r.point_awarded_at IS NOT NULL
  ) - (
    SELECT COUNT(*)::int
    FROM "tester_requests" tr
    JOIN "app_listings" al ON al.id = tr.app_listing_id
    WHERE al.user_id = u.id
      AND tr.point_consumed_at IS NOT NULL
  ),
  0
);

ALTER TABLE "users"
ADD CONSTRAINT "users_review_points_nonnegative"
CHECK ("review_points" >= 0) NOT VALID;
-- Existing rows were clamped above; NOT VALID avoids a long write lock.
-- New writes are still enforced immediately.

ALTER TABLE "app_listings"
ALTER COLUMN "max_testers_per_platform" SET DEFAULT 12;
