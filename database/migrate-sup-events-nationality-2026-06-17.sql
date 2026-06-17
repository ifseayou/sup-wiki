-- 赛事举办国（与运动员国籍同一套体系，存中文国名）
-- 幂等：会话变量守卫，列已存在则跳过。
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='nationality');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_events ADD COLUMN nationality VARCHAR(50) NULL COMMENT ''赛事举办国（与运动员国籍同口径，中文国名）'' AFTER city', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;
