USE sport_hacker;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_col_if_missing $$
CREATE PROCEDURE add_col_if_missing(
  IN p_table VARCHAR(64),
  IN p_col VARCHAR(64),
  IN p_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col
  ) THEN
    SET @ddl = p_sql;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_col_if_missing(
  'sup_athlete_profile_claims',
  'submitted_birth_date',
  "ALTER TABLE sup_athlete_profile_claims ADD COLUMN submitted_birth_date DATE NULL AFTER submitted_birth_year"
);

DROP PROCEDURE IF EXISTS add_col_if_missing;
