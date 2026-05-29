DROP PROCEDURE IF EXISTS add_athlete_gender_column;
DELIMITER //
CREATE PROCEDURE add_athlete_gender_column(
  IN p_column_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sup_athletes'
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE sup_athletes ADD COLUMN ', p_column_name, ' ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL add_athlete_gender_column('gender', "ENUM('male','female','mixed','unknown') NOT NULL DEFAULT 'unknown' AFTER name_en");
CALL add_athlete_gender_column('gender_source', "ENUM('manual','result_inferred','unknown') NOT NULL DEFAULT 'unknown' AFTER gender");
CALL add_athlete_gender_column('gender_confidence', "DECIMAL(4,3) NULL AFTER gender_source");

DROP PROCEDURE IF EXISTS add_athlete_gender_column;

DROP PROCEDURE IF EXISTS add_athlete_gender_index;
DELIMITER //
CREATE PROCEDURE add_athlete_gender_index()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sup_athletes'
      AND INDEX_NAME = 'idx_athletes_gender'
  ) THEN
    CREATE INDEX idx_athletes_gender ON sup_athletes (gender, status);
  END IF;
END //
DELIMITER ;

CALL add_athlete_gender_index();
DROP PROCEDURE IF EXISTS add_athlete_gender_index;
