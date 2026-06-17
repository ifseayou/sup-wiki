-- 成绩个人/团体单一事实源：sup_event_results 加 entry_type。
-- 'team' = 团体/龙板/接力/家庭/混双(discipline_family='team' 或 ≥2 名队员)；其余 'individual'。
-- 幂等：列已存在则跳过。
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sup_event_results' AND COLUMN_NAME = 'entry_type');
SET @ddl := IF(@col = 0,
  "ALTER TABLE sup_event_results ADD COLUMN entry_type ENUM('individual','team') NOT NULL DEFAULT 'individual' AFTER discipline_family",
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sup_event_results' AND INDEX_NAME = 'idx_event_results_entry_type');
SET @ddl2 := IF(@idx = 0,
  "ALTER TABLE sup_event_results ADD INDEX idx_event_results_entry_type (event_id, entry_type)",
  'SELECT 1');
PREPARE s2 FROM @ddl2; EXECUTE s2; DEALLOCATE PREPARE s2;
