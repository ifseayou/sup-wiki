-- 赛事模块「前瞻化」P0 地基：为 sup_events 增加往届关联 + 报名/奖金字段，并新增按组别明细表。
-- 纯加列/建表（可逆、幂等）。不做任何数据回填——往届关联(series/edition)语义复杂，
-- 后续由人工/录入管线精确建立。
-- 运行：cd sup-wiki && node scripts/run-migration.js database/migrate-event-future-fields-2026-06-11.sql
USE sport_hacker;

-- 赛事系列名（同一赛事跨届归并的依据，如「天子湖桨板公开赛」）
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='series_name');
SET @ddl = IF(@c=0, "ALTER TABLE sup_events ADD COLUMN series_name VARCHAR(200) NULL COMMENT '赛事系列名(跨届归并)' AFTER slug", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 届号（如第四届=4）
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='edition_number');
SET @ddl = IF(@c=0, "ALTER TABLE sup_events ADD COLUMN edition_number INT NULL COMMENT '届号' AFTER series_name", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 关联上一届赛事 event_id（往届联动）
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='parent_event_id');
SET @ddl = IF(@c=0, "ALTER TABLE sup_events ADD COLUMN parent_event_id BIGINT NULL COMMENT '上一届赛事 event_id' AFTER edition_number", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 报名开始日期（已有 registration_deadline 截止）
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='registration_start_date');
SET @ddl = IF(@c=0, "ALTER TABLE sup_events ADD COLUMN registration_start_date DATE NULL COMMENT '报名开始日期' AFTER registration_deadline", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 总奖金概述（如「总奖金 ¥50,000」）
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='prize_pool');
SET @ddl = IF(@c=0, "ALTER TABLE sup_events ADD COLUMN prize_pool VARCHAR(120) NULL COMMENT '总奖金概述' AFTER price_range", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 奖项设置详述
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='prize_description');
SET @ddl = IF(@c=0, "ALTER TABLE sup_events ADD COLUMN prize_description TEXT NULL COMMENT '奖项设置详述' AFTER prize_pool", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 索引：按系列+届号、按上一届
SET @i = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND INDEX_NAME='idx_events_series_edition');
SET @ddl = IF(@i=0, "ALTER TABLE sup_events ADD INDEX idx_events_series_edition (series_name, edition_number)", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @i = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND INDEX_NAME='idx_events_parent');
SET @ddl = IF(@i=0, "ALTER TABLE sup_events ADD INDEX idx_events_parent (parent_event_id)", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 按组别明细：每个赛事的组别/项目对应的报名费、奖金、名额（比 price_range 字符串可统计）
CREATE TABLE IF NOT EXISTS sup_event_categories (
  category_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL COMMENT '组别/项目展示名，如「男子公开组 10公里」',
  discipline VARCHAR(100) NULL COMMENT '项目，如 10公里 / 200米',
  gender_group VARCHAR(50) NULL COMMENT '性别/组别，如 男子公开组',
  board_class VARCHAR(50) NULL COMMENT '板型',
  fee VARCHAR(60) NULL COMMENT '报名费展示文本，如 ¥300',
  fee_amount DECIMAL(10,2) NULL COMMENT '报名费数值(可统计)',
  prize VARCHAR(200) NULL COMMENT '该组奖金/奖品',
  quota INT NULL COMMENT '名额',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_categories_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
