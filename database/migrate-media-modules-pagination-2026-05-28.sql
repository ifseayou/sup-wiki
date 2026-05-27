-- Add business modules to the admin media library.
-- folder remains the OSS directory; module is the admin/business grouping.

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_media_assets'
    AND COLUMN_NAME = 'module'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE sup_media_assets ADD COLUMN module VARCHAR(40) NOT NULL DEFAULT ''system'' AFTER folder',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE sup_media_assets
SET module = CASE
  WHEN LOWER(CONCAT(IFNULL(folder, ''), ' ', IFNULL(source_context, ''))) LIKE '%athlete%' THEN 'athlete'
  WHEN LOWER(CONCAT(IFNULL(folder, ''), ' ', IFNULL(source_context, ''))) LIKE '%club%' THEN 'club'
  WHEN LOWER(CONCAT(IFNULL(folder, ''), ' ', IFNULL(source_context, ''))) LIKE '%professional%' THEN 'professional'
  WHEN LOWER(CONCAT(IFNULL(folder, ''), ' ', IFNULL(source_context, ''))) LIKE '%coach%' THEN 'professional'
  WHEN LOWER(CONCAT(IFNULL(folder, ''), ' ', IFNULL(source_context, ''))) LIKE '%referee%' THEN 'professional'
  WHEN LOWER(CONCAT(IFNULL(folder, ''), ' ', IFNULL(source_context, ''))) LIKE '%certificate%' THEN 'professional'
  WHEN LOWER(CONCAT(IFNULL(folder, ''), ' ', IFNULL(source_context, ''))) LIKE '%license%' THEN 'professional'
  ELSE 'system'
END
WHERE @column_exists = 0 OR module IS NULL OR module = '';

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_media_assets'
    AND INDEX_NAME = 'idx_media_module_status_created'
);

SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE sup_media_assets ADD INDEX idx_media_module_status_created (module, status, created_at, asset_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
