-- 赛事 P1 增强：结构化逐名次奖金、技术官员名单、报名二维码。
-- 纯加列/建表（可逆、幂等）。
-- 运行：cd sup-wiki && node scripts/run-migration.js database/migrate-event-prizes-officials-qr-2026-06-11.sql
USE sport_hacker;

-- 报名二维码图（小程序/扫码报名入口；报名截止后前端不展示）
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sup_events' AND COLUMN_NAME='registration_qr_image');
SET @ddl = IF(@c=0, "ALTER TABLE sup_events ADD COLUMN registration_qr_image VARCHAR(500) NULL COMMENT '报名二维码图 URL' AFTER registration_url", 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 逐名次奖金（组别×名次结构化，便于数据分析）
CREATE TABLE IF NOT EXISTS sup_event_category_prizes (
  prize_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  rank_position INT NOT NULL COMMENT '名次',
  amount DECIMAL(10,2) NOT NULL COMMENT '奖金金额(税前)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_cat_rank (category_id, rank_position),
  INDEX idx_prize_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 技术官员名单（仲裁/裁判/编排/解说等；前端可不展示，管理后台与数据分析使用）
CREATE TABLE IF NOT EXISTS sup_event_officials (
  official_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  role_category VARCHAR(40) COMMENT '类别：仲裁/裁判/编排/计时/解说等',
  role_title VARCHAR(60) COMMENT '职务：主任/委员/技术代表/总裁判长/副裁判长/路跑裁判/桨板裁判/换项区/解说等',
  name VARCHAR(80) NOT NULL COMMENT '姓名',
  region VARCHAR(80) COMMENT '地区/单位',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_officials_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
