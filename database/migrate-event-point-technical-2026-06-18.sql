-- Add technical-race point fields for event-level standings.
-- Used by 2026 China SUP Open Hanzhong result-book import.

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_event_point_standings'
    AND COLUMN_NAME = 'technical_rank'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE sup_event_point_standings ADD COLUMN technical_rank VARCHAR(20) NULL AFTER sprint_points',
  'SELECT ''technical_rank already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_event_point_standings'
    AND COLUMN_NAME = 'technical_points'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE sup_event_point_standings ADD COLUMN technical_points DECIMAL(10,2) NULL AFTER technical_rank',
  'SELECT ''technical_points already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
