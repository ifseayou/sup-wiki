-- 成绩标准化落库 + 赛事组别打通（Phase 2）
-- 为 sup_event_results 增加标准化 key / 组别 family / 置信度 / 报名组别 category_id。
-- 幂等：用会话变量守卫，列/索引已存在则跳过。兼容 scripts/run-migration.js 与原生 mysql。
-- 不加硬外键（避免大表加 FK 锁表风险），category_id 完整性由应用层匹配维护。

-- ===== 列 =====
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_results' AND COLUMN_NAME='normalized_discipline_key');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_event_results ADD COLUMN normalized_discipline_key VARCHAR(50) NULL COMMENT ''标准化项目key，如 sprint_200m''', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_results' AND COLUMN_NAME='discipline_family');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_event_results ADD COLUMN discipline_family VARCHAR(20) NULL COMMENT ''项目族：sprint/technical/distance/marathon/team/special''', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_results' AND COLUMN_NAME='normalized_group_key');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_event_results ADD COLUMN normalized_group_key VARCHAR(80) NULL COMMENT ''标准化组别key：gender_age_tier_teamtype''', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_results' AND COLUMN_NAME='norm_confidence');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_event_results ADD COLUMN norm_confidence DECIMAL(4,3) NULL COMMENT ''标准化置信度=min(项目,组别)，低于0.6需人工复核''', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_results' AND COLUMN_NAME='category_id');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_event_results ADD COLUMN category_id BIGINT NULL COMMENT ''关联报名组别 sup_event_categories.category_id（按标准化key匹配，无报名组别留空）''', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;

-- ===== 索引 =====
SET @i = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_results' AND INDEX_NAME='idx_results_norm_discipline');
SET @ddl = IF(@i=0, 'ALTER TABLE sup_event_results ADD INDEX idx_results_norm_discipline (normalized_discipline_key)', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_results' AND INDEX_NAME='idx_results_norm_group');
SET @ddl = IF(@i=0, 'ALTER TABLE sup_event_results ADD INDEX idx_results_norm_group (normalized_group_key)', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_results' AND INDEX_NAME='idx_results_category');
SET @ddl = IF(@i=0, 'ALTER TABLE sup_event_results ADD INDEX idx_results_category (category_id)', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;
