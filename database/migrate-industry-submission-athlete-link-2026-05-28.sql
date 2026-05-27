-- Link professional onboarding submissions to an existing athlete profile.

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_industry_submissions'
    AND COLUMN_NAME = 'athlete_id'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE sup_industry_submissions ADD COLUMN athlete_id INT NULL AFTER club_name',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_industry_submissions'
    AND INDEX_NAME = 'idx_sup_industry_submissions_athlete'
);

SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE sup_industry_submissions ADD INDEX idx_sup_industry_submissions_athlete (athlete_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
