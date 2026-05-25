USE sport_hacker;

DELIMITER $$

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

CALL add_index_if_missing('sup_athletes', 'idx_athletes_status', 'ALTER TABLE sup_athletes ADD INDEX idx_athletes_status (status)');
CALL add_index_if_missing('sup_athletes', 'idx_athletes_status_discipline', 'ALTER TABLE sup_athletes ADD INDEX idx_athletes_status_discipline (status, discipline)');
CALL add_index_if_missing('sup_athletes', 'idx_athletes_status_nationality', 'ALTER TABLE sup_athletes ADD INDEX idx_athletes_status_nationality (status, nationality)');

CALL add_index_if_missing('sup_event_results', 'idx_results_public_athlete', 'ALTER TABLE sup_event_results ADD INDEX idx_results_public_athlete (athlete_id, review_status, is_verified, source_id, rank_position)');
CALL add_index_if_missing('sup_event_results', 'idx_results_public_event', 'ALTER TABLE sup_event_results ADD INDEX idx_results_public_event (event_id, review_status, is_verified, source_id, rank_position)');
CALL add_index_if_missing('sup_event_results', 'idx_results_public_group', 'ALTER TABLE sup_event_results ADD INDEX idx_results_public_group (review_status, is_verified, source_id, gender_group, discipline, rank_position)');

CALL add_index_if_missing('sup_techniques', 'idx_techniques_admin_list', 'ALTER TABLE sup_techniques ADD INDEX idx_techniques_admin_list (status, stage, level, category, sort_order, technique_id)');

DROP PROCEDURE IF EXISTS add_index_if_missing;
