-- Backfill badges for users who already meet MVP thresholds / milestones
-- before the award hooks shipped. Thresholds match src/lib/badges.ts (6).
-- Idempotent via unique (user_id, badge_type).

INSERT INTO "user_badges" ("id", "user_id", "badge_type", "earned_at")
SELECT
  md5(random()::text || clock_timestamp()::text || u.id || 'super_tester'),
  u.id,
  'super_tester'::"BadgeType",
  NOW()
FROM "users" u
WHERE u.profile_score_completed >= 6
ON CONFLICT ("user_id", "badge_type") DO NOTHING;

INSERT INTO "user_badges" ("id", "user_id", "badge_type", "earned_at")
SELECT
  md5(random()::text || clock_timestamp()::text || u.id || 'helpful_dev'),
  u.id,
  'helpful_dev'::"BadgeType",
  NOW()
FROM "users" u
WHERE u.reviews_written_count >= 6
ON CONFLICT ("user_id", "badge_type") DO NOTHING;

INSERT INTO "user_badges" ("id", "user_id", "badge_type", "earned_at")
SELECT
  md5(random()::text || clock_timestamp()::text || al.user_id || 'first_12'),
  al.user_id,
  'first_12'::"BadgeType",
  MIN(ta.completed_at)
FROM "test_assignments" ta
INNER JOIN "app_listings" al ON al.id = ta.app_listing_id
WHERE ta.status = 'completed'
  AND ta.completed_at IS NOT NULL
GROUP BY al.user_id
ON CONFLICT ("user_id", "badge_type") DO NOTHING;
