USE sport_hacker;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = p_sql;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND INDEX_NAME = p_index
  ) THEN
    SET @ddl = p_sql;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

ALTER TABLE sup_event_result_submissions
  MODIFY COLUMN status ENUM('pending','reviewing','imported','rejected','ignored') NOT NULL DEFAULT 'pending';

CALL add_column_if_missing(
  'sup_event_result_sources',
  'result_submission_id',
  'ALTER TABLE sup_event_result_sources ADD COLUMN result_submission_id BIGINT NULL AFTER asset_id'
);

CALL add_column_if_missing(
  'sup_event_result_sources',
  'result_submission_batch_id',
  'ALTER TABLE sup_event_result_sources ADD COLUMN result_submission_batch_id VARCHAR(40) NULL AFTER result_submission_id'
);

CALL add_index_if_missing(
  'sup_event_result_sources',
  'idx_result_sources_submission',
  'ALTER TABLE sup_event_result_sources ADD INDEX idx_result_sources_submission (result_submission_id)'
);

CALL add_index_if_missing(
  'sup_event_result_sources',
  'idx_result_sources_submission_batch',
  'ALTER TABLE sup_event_result_sources ADD INDEX idx_result_sources_submission_batch (result_submission_batch_id)'
);

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
