-- Re-apply reviews_written_count using the full suggestion length window (10–500).
UPDATE "users" AS u
SET "reviews_written_count" = COALESCE(c.complete_count, 0)
FROM (
  SELECT
    r.tester_user_id,
    COUNT(*)::int AS complete_count
  FROM "reviews" r
  WHERE length(btrim(r.improvement_suggestion)) BETWEEN 10 AND 500
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
  WHERE length(btrim(r.improvement_suggestion)) BETWEEN 10 AND 500
    AND (
      SELECT COUNT(*)::int
      FROM "review_screenshots" s
      WHERE s.review_id = r.id
    ) >= 4
)
AND "reviews_written_count" <> 0;

DELETE FROM "user_badges" ub
USING "users" u
WHERE ub.user_id = u.id
  AND ub.badge_type = 'helpful_dev'
  AND u.reviews_written_count < 6;
