-- SUP Wiki — athlete origin province/city
SET @province_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'sup_athletes'
     AND COLUMN_NAME = 'province'
);
SET @sql := IF(
  @province_exists = 0,
  'ALTER TABLE sup_athletes ADD COLUMN province VARCHAR(50) NULL AFTER nationality',
  'SELECT "sup_athletes.province exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @city_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'sup_athletes'
     AND COLUMN_NAME = 'city'
);
SET @sql := IF(
  @city_exists = 0,
  'ALTER TABLE sup_athletes ADD COLUMN city VARCHAR(50) NULL AFTER province',
  'SELECT "sup_athletes.city exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'sup_athletes'
     AND INDEX_NAME = 'idx_athletes_region'
);
SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_athletes_region ON sup_athletes (province, city)',
  'SELECT "idx_athletes_region exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
