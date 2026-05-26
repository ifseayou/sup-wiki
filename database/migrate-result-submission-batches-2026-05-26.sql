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

CALL add_column_if_missing(
  'sup_event_result_submissions',
  'batch_id',
  'ALTER TABLE sup_event_result_submissions ADD COLUMN batch_id VARCHAR(40) NULL AFTER submission_id'
);
CALL add_column_if_missing(
  'sup_event_result_submissions',
  'batch_file_index',
  'ALTER TABLE sup_event_result_submissions ADD COLUMN batch_file_index INT NOT NULL DEFAULT 1 AFTER batch_id'
);
CALL add_column_if_missing(
  'sup_event_result_submissions',
  'batch_total',
  'ALTER TABLE sup_event_result_submissions ADD COLUMN batch_total INT NOT NULL DEFAULT 1 AFTER batch_file_index'
);
CALL add_column_if_missing(
  'sup_event_result_submissions',
  'batch_label',
  'ALTER TABLE sup_event_result_submissions ADD COLUMN batch_label VARCHAR(180) NULL AFTER batch_total'
);

UPDATE sup_event_result_submissions
SET
  batch_id = CONCAT('legacy-', submission_id),
  batch_file_index = 1,
  batch_total = 1,
  batch_label = event_name
WHERE batch_id IS NULL OR batch_id = '';

CALL add_index_if_missing(
  'sup_event_result_submissions',
  'idx_result_submissions_batch',
  'ALTER TABLE sup_event_result_submissions ADD INDEX idx_result_submissions_batch (batch_id, batch_file_index)'
);
CALL add_index_if_missing(
  'sup_event_result_submissions',
  'idx_result_submissions_status_created_id',
  'ALTER TABLE sup_event_result_submissions ADD INDEX idx_result_submissions_status_created_id (status, created_at, submission_id)'
);

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
