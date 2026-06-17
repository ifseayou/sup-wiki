-- 公众号监控：抓取记录/去重表 + 提报正文素材列。
-- 幂等。运行：cd sup-wiki && node scripts/run-migration.js database/migrate-wechat-articles-2026-06-11.sql
USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_wechat_articles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  account VARCHAR(60) NOT NULL DEFAULT 'china_sup' COMMENT '公众号标识',
  article_url VARCHAR(700) NOT NULL COMMENT '文章 URL（去重唯一）',
  title VARCHAR(300) COMMENT '文章标题',
  publish_time DATETIME NULL COMMENT '文章发布时间',
  cover_url VARCHAR(700) COMMENT '封面图',
  status ENUM('new','processed','skipped','failed') NOT NULL DEFAULT 'new',
  process_note VARCHAR(500) COMMENT '处理/跳过/失败原因',
  submission_id BIGINT NULL COMMENT '生成的赛事提报 id',
  event_id BIGINT NULL COMMENT '自动发布的赛事 id',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_article_url (article_url),
  INDEX idx_wechat_status (status),
  INDEX idx_wechat_account (account)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 提报正文素材（供后台查看 / 本地解析备用通道）
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_submissions' AND COLUMN_NAME='source_text');
SET @ddl = IF(@c=0, "ALTER TABLE sup_event_submissions ADD COLUMN source_text MEDIUMTEXT NULL COMMENT '来源文章正文素材' AFTER user_note", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 提报来源标记（manual 用户提报 / wechat 公众号抓取）
SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_event_submissions' AND COLUMN_NAME='source');
SET @ddl2 = IF(@c2=0, "ALTER TABLE sup_event_submissions ADD COLUMN source VARCHAR(40) NOT NULL DEFAULT 'manual' COMMENT '提报来源' AFTER submission_type", 'SELECT 1');
PREPARE s2 FROM @ddl2; EXECUTE s2; DEALLOCATE PREPARE s2;
