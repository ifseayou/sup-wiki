USE sport_hacker;

ALTER TABLE sup_event_result_submissions
  MODIFY COLUMN status ENUM('pending','reviewing','imported','rejected','ignored') NOT NULL DEFAULT 'pending';

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_event_result_sources'
    AND COLUMN_NAME = 'result_submission_id'
);
SET @ddl = IF(@column_exists = 0, 'ALTER TABLE sup_event_result_sources ADD COLUMN result_submission_id BIGINT NULL AFTER asset_id', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_event_result_sources'
    AND COLUMN_NAME = 'result_submission_batch_id'
);
SET @ddl = IF(@column_exists = 0, 'ALTER TABLE sup_event_result_sources ADD COLUMN result_submission_batch_id VARCHAR(40) NULL AFTER result_submission_id', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_event_result_sources'
    AND INDEX_NAME = 'idx_result_sources_submission'
);
SET @ddl = IF(@index_exists = 0, 'ALTER TABLE sup_event_result_sources ADD INDEX idx_result_sources_submission (result_submission_id)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_event_result_sources'
    AND INDEX_NAME = 'idx_result_sources_submission_batch'
);
SET @ddl = IF(@index_exists = 0, 'ALTER TABLE sup_event_result_sources ADD INDEX idx_result_sources_submission_batch (result_submission_batch_id)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
