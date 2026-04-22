USE sport_hacker;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND COLUMN_NAME = 'star_level'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_events ADD COLUMN star_level VARCHAR(20) NULL AFTER max_participants",
  "SELECT 'sup_events.star_level already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND COLUMN_NAME = 'score_coefficient'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_events ADD COLUMN score_coefficient DECIMAL(3,1) NULL AFTER star_level",
  "SELECT 'sup_events.score_coefficient already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND COLUMN_NAME = 'source_scope'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_events ADD COLUMN source_scope VARCHAR(100) NULL AFTER score_coefficient",
  "SELECT 'sup_events.source_scope already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND COLUMN_NAME = 'result_status'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_events ADD COLUMN result_status ENUM('none','partial','top10_complete','extended_complete') DEFAULT 'none' AFTER source_scope",
  "SELECT 'sup_events.result_status already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND COLUMN_NAME = 'result_source_note'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_events ADD COLUMN result_source_note TEXT NULL AFTER result_status",
  "SELECT 'sup_events.result_source_note already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND COLUMN_NAME = 'result_source_links'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_events ADD COLUMN result_source_links JSON NULL AFTER result_source_note",
  "SELECT 'sup_events.result_source_links already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND COLUMN_NAME = 'result_last_verified_at'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_events ADD COLUMN result_last_verified_at TIMESTAMP NULL AFTER result_source_links",
  "SELECT 'sup_events.result_last_verified_at already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND INDEX_NAME = 'idx_events_star_level'
);
SET @sql = IF(@idx_exists = 0,
  "CREATE INDEX idx_events_star_level ON sup_events (star_level)",
  "SELECT 'idx_events_star_level already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_events' AND INDEX_NAME = 'idx_events_result_status'
);
SET @sql = IF(@idx_exists = 0,
  "CREATE INDEX idx_events_result_status ON sup_events (result_status)",
  "SELECT 'idx_events_result_status already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sup_event_results (
  result_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  athlete_id BIGINT NULL,
  athlete_name_snapshot VARCHAR(100) NOT NULL,
  gender_group VARCHAR(100) NOT NULL DEFAULT '公开组',
  discipline VARCHAR(100) NOT NULL,
  round_label VARCHAR(100) NULL,
  rank_position INT NOT NULL,
  result_label VARCHAR(100) NULL,
  finish_time VARCHAR(50) NOT NULL,
  time_seconds DECIMAL(10,3) NULL,
  team_name VARCHAR(200) NULL,
  nationality_snapshot VARCHAR(50) NULL,
  source_type ENUM('official','media','livestream','manual') DEFAULT 'official',
  source_title VARCHAR(255) NULL,
  source_url VARCHAR(500) NULL,
  source_note TEXT NULL,
  is_verified TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_result_rank (event_id, gender_group, discipline, round_label, rank_position, athlete_name_snapshot),
  INDEX idx_event_results_event (event_id),
  INDEX idx_event_results_athlete (athlete_id),
  INDEX idx_event_results_rank (rank_position),
  CONSTRAINT fk_event_results_event FOREIGN KEY (event_id) REFERENCES sup_events(event_id) ON DELETE CASCADE,
  CONSTRAINT fk_event_results_athlete FOREIGN KEY (athlete_id) REFERENCES sup_athletes(athlete_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'event results migration completed' AS result;
