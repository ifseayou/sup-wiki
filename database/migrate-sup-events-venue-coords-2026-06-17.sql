-- 赛事场馆经纬度坐标（F3：地点地理编码→地图）
-- 幂等：会话变量守卫，列已存在则跳过。兼容 scripts/run-migration.js 与原生 mysql。
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='venue_lat');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_events ADD COLUMN venue_lat DECIMAL(10,7) NULL COMMENT ''场馆纬度''', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='venue_lng');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_events ADD COLUMN venue_lng DECIMAL(10,7) NULL COMMENT ''场馆经度''', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;
