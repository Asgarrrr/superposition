-- Backfill usernames for accounts created before the username plugin (migration
-- 0005 added the column nullable, leaving every existing row NULL — which makes
-- their public /profile/$username unreachable and their leaderboard name a
-- non-link). Idempotent: only rows still missing a handle. Slug from name (else
-- email localpart), lowercased [a-z0-9_], min length 3, reserved handles pushed
-- off, de-duplicated by a numeric suffix within the batch.
WITH base AS (
  SELECT id, created_at,
    substr(
      regexp_replace(
        lower(coalesce(nullif(trim(name), ''), split_part(email, '@', 1))),
        '[^a-z0-9_]', '', 'g'
      ), 1, 18
    ) AS raw
  FROM "user"
  WHERE username IS NULL
),
norm AS (
  SELECT id, created_at,
    CASE
      WHEN length(raw) < 3 THEN raw || 'x' || repeat('0', greatest(0, 2 - length(raw)))
      WHEN raw IN ('me', 'admin', 'api', 'profile', 'levels', 'level', 'daily', 'align') THEN raw || '1'
      ELSE raw
    END AS slug
  FROM base
),
dedup AS (
  SELECT id, slug,
    row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM norm
)
UPDATE "user" u
SET username = CASE WHEN d.rn = 1 THEN d.slug ELSE d.slug || d.rn END,
    display_username = CASE WHEN d.rn = 1 THEN d.slug ELSE d.slug || d.rn END
FROM dedup d
WHERE u.id = d.id;
