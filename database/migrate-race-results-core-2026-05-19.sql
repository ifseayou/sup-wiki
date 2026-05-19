USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_event_result_sources (
  source_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id BIGINT NULL,
  asset_id BIGINT NULL,
  original_path VARCHAR(700) NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type ENUM('pdf','excel','image','text','unknown') DEFAULT 'unknown',
  source_url VARCHAR(700) NULL,
  parser_name VARCHAR(100) NULL,
  parser_status ENUM('pending_review','parsed','imported','ignored','failed') DEFAULT 'pending_review',
  parser_note TEXT NULL,
  extracted_rows INT DEFAULT 0,
  reviewed_rows INT DEFAULT 0,
  imported_rows INT DEFAULT 0,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_result_sources_event (event_id),
  INDEX idx_result_sources_status (parser_status),
  INDEX idx_result_sources_type (file_type),
  CONSTRAINT fk_result_sources_event FOREIGN KEY (event_id) REFERENCES sup_events(event_id) ON DELETE SET NULL,
  CONSTRAINT fk_result_sources_asset FOREIGN KEY (asset_id) REFERENCES sup_media_assets(asset_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sup_athlete_identity_links (
  link_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  athlete_id BIGINT NULL,
  normalized_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  gender_hint VARCHAR(50) NULL,
  team_hint VARCHAR(200) NULL,
  nationality_hint VARCHAR(50) NULL,
  confidence DECIMAL(4,3) DEFAULT 0.500,
  status ENUM('pending','confirmed','rejected') DEFAULT 'pending',
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_identity_candidate (normalized_name, display_name, gender_hint, team_hint),
  INDEX idx_identity_athlete (athlete_id),
  INDEX idx_identity_status (status),
  CONSTRAINT fk_identity_athlete FOREIGN KEY (athlete_id) REFERENCES sup_athletes(athlete_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS add_col_if_missing;
DELIMITER //
CREATE PROCEDURE add_col_if_missing(IN p_table_name VARCHAR(64), IN p_column_name VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table_name AND COLUMN_NAME = p_column_name
  ) THEN
    SET @sql = p_ddl;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL add_col_if_missing('sup_event_results', 'bib_number', 'ALTER TABLE sup_event_results ADD COLUMN bib_number VARCHAR(50) NULL AFTER athlete_name_snapshot');
CALL add_col_if_missing('sup_event_results', 'board_class', 'ALTER TABLE sup_event_results ADD COLUMN board_class VARCHAR(100) NULL AFTER discipline');
CALL add_col_if_missing('sup_event_results', 'points', 'ALTER TABLE sup_event_results ADD COLUMN points DECIMAL(10,2) NULL AFTER time_seconds');
CALL add_col_if_missing('sup_event_results', 'source_id', 'ALTER TABLE sup_event_results ADD COLUMN source_id BIGINT NULL AFTER source_type');
CALL add_col_if_missing('sup_event_results', 'source_locator', 'ALTER TABLE sup_event_results ADD COLUMN source_locator VARCHAR(100) NULL AFTER source_title');
CALL add_col_if_missing('sup_event_results', 'parse_confidence', 'ALTER TABLE sup_event_results ADD COLUMN parse_confidence DECIMAL(4,3) DEFAULT 1.000 AFTER source_note');
CALL add_col_if_missing('sup_event_results', 'review_status', 'ALTER TABLE sup_event_results ADD COLUMN review_status ENUM(''pending'',''confirmed'',''needs_review'') DEFAULT ''confirmed'' AFTER parse_confidence');

DROP PROCEDURE IF EXISTS add_col_if_missing;

DROP PROCEDURE IF EXISTS add_idx_if_missing;
DELIMITER //
CREATE PROCEDURE add_idx_if_missing(IN p_index_name VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sup_event_results' AND INDEX_NAME = p_index_name
  ) THEN
    SET @sql = p_ddl;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL add_idx_if_missing('idx_event_results_gender_discipline', 'ALTER TABLE sup_event_results ADD INDEX idx_event_results_gender_discipline (gender_group, discipline)');
CALL add_idx_if_missing('idx_event_results_time', 'ALTER TABLE sup_event_results ADD INDEX idx_event_results_time (time_seconds)');
CALL add_idx_if_missing('idx_event_results_review', 'ALTER TABLE sup_event_results ADD INDEX idx_event_results_review (review_status)');
CALL add_idx_if_missing('idx_event_results_source', 'ALTER TABLE sup_event_results ADD INDEX idx_event_results_source (source_id)');

DROP PROCEDURE IF EXISTS add_idx_if_missing;

DROP PROCEDURE IF EXISTS add_fk_if_missing;
DELIMITER //
CREATE PROCEDURE add_fk_if_missing()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sup_event_results' AND CONSTRAINT_NAME = 'fk_event_results_source'
  ) THEN
    ALTER TABLE sup_event_results
      ADD CONSTRAINT fk_event_results_source FOREIGN KEY (source_id) REFERENCES sup_event_result_sources(source_id) ON DELETE SET NULL;
  END IF;
END//
DELIMITER ;

CALL add_fk_if_missing();
DROP PROCEDURE IF EXISTS add_fk_if_missing;
