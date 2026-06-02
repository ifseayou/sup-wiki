-- Official elite event roster markers for athletes.

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_athletes'
    AND COLUMN_NAME = 'elite_event_status'
);
SET @ddl = IF(
  @column_exists = 0,
  "ALTER TABLE sup_athletes ADD COLUMN elite_event_status ENUM('none','formal','reserve') NOT NULL DEFAULT 'none' AFTER icf_ranking",
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_type = (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_athletes'
    AND COLUMN_NAME = 'elite_event_status'
);
SET @ddl = IF(
  @column_type IS NOT NULL AND @column_type NOT LIKE "%'reserve'%",
  "ALTER TABLE sup_athletes MODIFY COLUMN elite_event_status ENUM('none','formal','reserve') NOT NULL DEFAULT 'none'",
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_athletes'
    AND COLUMN_NAME = 'elite_event_groups'
);
SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE sup_athletes ADD COLUMN elite_event_groups JSON NULL AFTER elite_event_status',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_athletes'
    AND COLUMN_NAME = 'elite_event_note'
);
SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE sup_athletes ADD COLUMN elite_event_note VARCHAR(255) NULL AFTER elite_event_groups',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_athletes'
    AND COLUMN_NAME = 'elite_event_source_title'
);
SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE sup_athletes ADD COLUMN elite_event_source_title VARCHAR(255) NULL AFTER elite_event_note',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_athletes'
    AND COLUMN_NAME = 'elite_event_updated_at'
);
SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE sup_athletes ADD COLUMN elite_event_updated_at TIMESTAMP NULL AFTER elite_event_source_title',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_athletes'
    AND INDEX_NAME = 'idx_athletes_elite_event'
);
SET @ddl = IF(
  @index_exists = 0,
  'ALTER TABLE sup_athletes ADD INDEX idx_athletes_elite_event (elite_event_status, status)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
