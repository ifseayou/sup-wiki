-- 赛事提报（P2）：用户提报赛事海报图/链接 → AI 抽取 → 后台审核录入。
-- 幂等建表。运行：cd sup-wiki && node scripts/run-migration.js database/migrate-event-submissions-2026-06-11.sql
USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_event_submissions (
  submission_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  submission_type ENUM('poster','link','mixed') NOT NULL DEFAULT 'poster',
  image_urls JSON COMMENT '海报图 OSS URL 数组',
  link_url VARCHAR(700) COMMENT '公众号/官网链接',
  user_note TEXT COMMENT '提报者备注',
  extracted_json JSON COMMENT 'AI 抽取的结构化赛事 JSON',
  extract_status ENUM('pending','extracting','extracted','failed') NOT NULL DEFAULT 'pending',
  extract_error VARCHAR(500) COMMENT 'AI 抽取失败原因',
  review_status ENUM('pending','reviewing','ingested','rejected') NOT NULL DEFAULT 'pending',
  event_id BIGINT NULL COMMENT '录入后关联的赛事 event_id',
  admin_note TEXT COMMENT '审核备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_sub_user (user_id),
  INDEX idx_event_sub_review (review_status),
  INDEX idx_event_sub_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
