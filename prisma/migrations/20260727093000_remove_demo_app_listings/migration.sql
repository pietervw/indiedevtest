-- Remove only the five demo app listings created by the former seed script.
-- Related tester assignments are removed by their ON DELETE CASCADE relation.
DELETE FROM "app_listings"
WHERE "name" IN (
  'HabitQuest',
  'TaskForge',
  'TideTimer',
  'PixelRanch',
  'FocusLane'
)
AND "user_id" IN (
  SELECT "id"
  FROM "users"
  WHERE "clerk_id" IN (
    'seed_clerk_mira',
    'seed_clerk_jonas',
    'seed_clerk_sofia',
    'seed_clerk_devon',
    'seed_clerk_aisha'
  )
);
