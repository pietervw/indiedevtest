-- Recalculate reviews_written_count from complete evidence only.
-- Migrated free-text reviews kept their prior credit but have zero screenshots,
-- so they must not keep (or double-count on repair) Helpful Dev / leaderboard credit.
UPDATE "users" AS u
SET "reviews_written_count" = COALESCE(c.complete_count, 0)
FROM (
  SELECT
    r.tester_user_id,
    COUNT(*)::int AS complete_count
  FROM "reviews" r
  WHERE length(btrim(r.improvement_suggestion)) >= 10
    AND (
      SELECT COUNT(*)::int
      FROM "review_screenshots" s
      WHERE s.review_id = r.id
    ) >= 4
  GROUP BY r.tester_user_id
) AS c
WHERE c.tester_user_id = u.id;

UPDATE "users"
SET "reviews_written_count" = 0
WHERE id NOT IN (
  SELECT DISTINCT r.tester_user_id
  FROM "reviews" r
  WHERE length(btrim(r.improvement_suggestion)) >= 10
    AND (
      SELECT COUNT(*)::int
      FROM "review_screenshots" s
      WHERE s.review_id = r.id
    ) >= 4
)
AND "reviews_written_count" <> 0;

-- Drop Helpful Dev when the recalculated count falls below the threshold (6).
DELETE FROM "user_badges" ub
USING "users" u
WHERE ub.user_id = u.id
  AND ub.badge_type = 'helpful_dev'
  AND u.reviews_written_count < 6;
