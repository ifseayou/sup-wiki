-- =====================================================================
-- migrate-creators.sql
-- 扩展 sup_creators.platform 枚举，新增 'instagram' 选项
-- 执行顺序：先跑此文件，再跑 seed-creators.sql
-- =====================================================================

ALTER TABLE sup_creators
  MODIFY COLUMN platform
    ENUM('douyin', 'xiaohongshu', 'bilibili', 'youtube', 'weibo', 'instagram')
    NOT NULL;
