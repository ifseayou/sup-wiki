-- migrate-creators-region.sql: 为 sup_creators 添加 region 字段
-- 执行服务器: hk_aliyun_ecs (8.217.233.65), 数据库: sport_hacker

ALTER TABLE sup_creators
  ADD COLUMN region ENUM('domestic', 'international') NOT NULL DEFAULT 'domestic'
  AFTER content_style;

-- 按平台自动推断：国内平台 → domestic（默认），国际平台 → international
UPDATE sup_creators SET region = 'international'
WHERE platform IN ('youtube', 'instagram');
