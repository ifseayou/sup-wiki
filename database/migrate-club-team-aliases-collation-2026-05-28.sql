-- Keep club team alias matching compatible with sup_event_results.team_name_normalized.

ALTER TABLE sup_club_team_aliases
  MODIFY normalized_name VARCHAR(220) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  MODIFY team_name_raw VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;
