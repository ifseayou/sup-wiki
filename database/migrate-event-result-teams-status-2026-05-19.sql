DELIMITER $$

DROP PROCEDURE IF EXISTS add_event_result_col_if_missing $$
CREATE PROCEDURE add_event_result_col_if_missing(IN p_col VARCHAR(64), IN p_sql TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sup_event_results'
      AND COLUMN_NAME = p_col
  ) THEN
    SET @ddl = p_sql;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_event_result_col_if_missing(
  'result_status_code',
  'ALTER TABLE sup_event_results ADD COLUMN result_status_code VARCHAR(20) NULL AFTER finish_time'
);

CALL add_event_result_col_if_missing(
  'result_status_note',
  'ALTER TABLE sup_event_results ADD COLUMN result_status_note VARCHAR(255) NULL AFTER result_status_code'
);

DROP PROCEDURE IF EXISTS add_event_result_col_if_missing;

CREATE TABLE IF NOT EXISTS sup_event_result_members (
  member_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  result_id BIGINT NOT NULL,
  athlete_id BIGINT NULL,
  member_name VARCHAR(100) NOT NULL,
  member_order INT DEFAULT 0,
  role_label VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_result_member_name (result_id, member_name),
  INDEX idx_result_members_result (result_id),
  INDEX idx_result_members_athlete (athlete_id),
  INDEX idx_result_members_name (member_name),
  CONSTRAINT fk_result_members_result FOREIGN KEY (result_id) REFERENCES sup_event_results(result_id) ON DELETE CASCADE,
  CONSTRAINT fk_result_members_athlete FOREIGN KEY (athlete_id) REFERENCES sup_athletes(athlete_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE sup_event_results
SET team_name = '个人'
WHERE team_name IS NULL OR team_name = '';

UPDATE sup_event_results
SET result_status_code = UPPER(TRIM(finish_time))
WHERE result_status_code IS NULL
  AND UPPER(TRIM(finish_time)) IN ('DNS', 'DNF', 'DQ', 'DSQ', 'DNQ', 'OTL');

UPDATE sup_event_results
SET result_status_note = CASE result_status_code
  WHEN 'DNS' THEN '未出发'
  WHEN 'DNF' THEN '未完赛'
  WHEN 'DQ' THEN '取消成绩'
  WHEN 'DSQ' THEN '取消成绩'
  WHEN 'DNQ' THEN '未晋级'
  WHEN 'OTL' THEN '超过关门时间'
  ELSE result_status_note
END
WHERE result_status_code IS NOT NULL
  AND (result_status_note IS NULL OR result_status_note = '');
