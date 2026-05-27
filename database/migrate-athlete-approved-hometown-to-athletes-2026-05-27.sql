-- Backfill athlete origin from already approved profile claims.
-- Only fills athletes whose structured origin is still empty.

UPDATE sup_athletes a
INNER JOIN (
  SELECT c.athlete_id, c.submitted_hometown_province, c.submitted_hometown_city
  FROM sup_athlete_profile_claims c
  INNER JOIN (
    SELECT athlete_id, MAX(claim_id) AS claim_id
    FROM sup_athlete_profile_claims
    WHERE status = 'approved'
      AND (
        NULLIF(submitted_hometown_province, '') IS NOT NULL
        OR NULLIF(submitted_hometown_city, '') IS NOT NULL
      )
    GROUP BY athlete_id
  ) latest ON latest.claim_id = c.claim_id
) claim_origin ON claim_origin.athlete_id = a.athlete_id
SET
  a.province = COALESCE(NULLIF(a.province, ''), NULLIF(claim_origin.submitted_hometown_province, '')),
  a.city = COALESCE(NULLIF(a.city, ''), NULLIF(claim_origin.submitted_hometown_city, ''))
WHERE (
    a.province IS NULL
    OR a.province = ''
    OR a.city IS NULL
    OR a.city = ''
  )
  AND (
    NULLIF(claim_origin.submitted_hometown_province, '') IS NOT NULL
    OR NULLIF(claim_origin.submitted_hometown_city, '') IS NOT NULL
  );
