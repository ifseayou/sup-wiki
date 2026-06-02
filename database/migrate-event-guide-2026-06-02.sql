-- Add structured participant guide data for events.
-- This stores race-day information such as check-in, start/finish, route maps,
-- traffic notes, and equipment reminders. Result books remain in result tables.

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sup_events'
    AND COLUMN_NAME = 'event_guide'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE sup_events ADD COLUMN event_guide JSON NULL AFTER result_source_links',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
