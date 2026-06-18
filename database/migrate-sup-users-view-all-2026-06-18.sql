-- 权限模块：管理后台可授予指定用户「查询全部成绩」权限
-- =1 时该用户查成绩/积分不限次、无需绑定运动员、未认领国内选手显示全名（仍尊重本人显式隐私隐藏/黑名单）。
-- 幂等：会话变量守卫，列已存在则跳过。兼容 scripts/run-migration.js 与原生 mysql。
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_users' AND COLUMN_NAME='can_view_all_results');
SET @ddl = IF(@c=0, 'ALTER TABLE sup_users ADD COLUMN can_view_all_results TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''可查询全部成绩（不限次/免绑定/不脱敏）''', 'SELECT 1');
PREPARE s FROM @ddl;
EXECUTE s;
DEALLOCATE PREPARE s;
