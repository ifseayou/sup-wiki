-- Backfill structured hometown fields for mini-program athlete profile claims.
-- Some submissions stored hometown only in submitted_profile_json.hometown.

UPDATE sup_athlete_profile_claims
SET
  submitted_hometown_province = COALESCE(
    NULLIF(submitted_hometown_province, ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(submitted_profile_json, '$.hometown.province')), '')
  ),
  submitted_hometown_city = COALESCE(
    NULLIF(submitted_hometown_city, ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(submitted_profile_json, '$.hometown.city')), '')
  )
WHERE submitted_profile_json IS NOT NULL
  AND JSON_VALID(submitted_profile_json)
  AND (
    submitted_hometown_province IS NULL
    OR submitted_hometown_province = ''
    OR submitted_hometown_city IS NULL
    OR submitted_hometown_city = ''
  )
  AND (
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(submitted_profile_json, '$.hometown.province')), '') IS NOT NULL
    OR NULLIF(JSON_UNQUOTE(JSON_EXTRACT(submitted_profile_json, '$.hometown.city')), '') IS NOT NULL
  );
