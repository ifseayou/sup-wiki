USE sport_hacker;

-- SUP Wiki — archived WeChat annual points (2022-2024)

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
  'sup_annual_point_standings',
  'team_name',
  'ALTER TABLE sup_annual_point_standings ADD COLUMN team_name VARCHAR(160) NULL AFTER athlete_name_snapshot'
);
CALL add_column_if_missing(
  'sup_annual_point_standings',
  'team_name_normalized',
  'ALTER TABLE sup_annual_point_standings ADD COLUMN team_name_normalized VARCHAR(160) NULL AFTER team_name'
);
CALL add_index_if_missing(
  'sup_annual_point_standings',
  'idx_annual_points_year',
  'ALTER TABLE sup_annual_point_standings ADD INDEX idx_annual_points_year (year)'
);
CALL add_index_if_missing(
  'sup_annual_point_standings',
  'idx_annual_points_team',
  'ALTER TABLE sup_annual_point_standings ADD INDEX idx_annual_points_team (team_name_normalized)'
);

CREATE TABLE IF NOT EXISTS sup_annual_club_point_standings (
  standing_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_id BIGINT NOT NULL,
  year INT NOT NULL,
  rank_position INT NULL,
  club_id INT NULL,
  club_name_snapshot VARCHAR(160) NOT NULL,
  club_name_normalized VARCHAR(160) NULL,
  total_points DECIMAL(12,3) NULL,
  source_record_id VARCHAR(100) NOT NULL,
  raw_json JSON NULL,
  match_status ENUM('unmatched','candidate','confirmed','conflict') DEFAULT 'unmatched',
  match_confidence DECIMAL(4,3) DEFAULT 0.500,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_annual_club_points_record (source_id, source_record_id),
  INDEX idx_annual_club_points_year_rank (year, rank_position),
  INDEX idx_annual_club_points_name (club_name_snapshot),
  INDEX idx_annual_club_points_club (club_id),
  INDEX idx_annual_club_points_match (match_status),
  CONSTRAINT fk_annual_club_points_source FOREIGN KEY (source_id) REFERENCES sup_annual_point_sources(source_id) ON DELETE CASCADE,
  CONSTRAINT fk_annual_club_points_club FOREIGN KEY (club_id) REFERENCES sup_clubs(club_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
