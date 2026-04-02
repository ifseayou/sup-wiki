-- SUP Wiki v2 数据库迁移脚本
-- MySQL 5.7/8.0 兼容版本

USE sport_hacker;

-- ============================================================
-- 1. 为所有实体表添加 status 字段（如果不存在）
-- ============================================================

-- sup_brands
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_brands' AND COLUMN_NAME = 'status'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_brands ADD COLUMN status ENUM('draft','published') DEFAULT 'published' AFTER description",
  "SELECT 'sup_brands.status already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sup_products
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_products' AND COLUMN_NAME = 'status'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_products ADD COLUMN status ENUM('draft','published') DEFAULT 'published' AFTER description",
  "SELECT 'sup_products.status already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sup_athletes
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_athletes' AND COLUMN_NAME = 'status'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_athletes ADD COLUMN status ENUM('draft','published') DEFAULT 'published' AFTER social_links",
  "SELECT 'sup_athletes.status already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sup_creators
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'sport_hacker' AND TABLE_NAME = 'sup_creators' AND COLUMN_NAME = 'status'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE sup_creators ADD COLUMN status ENUM('draft','published') DEFAULT 'published' AFTER profile_url",
  "SELECT 'sup_creators.status already exists' AS msg"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 确保已有数据为 published
UPDATE sup_brands SET status = 'published' WHERE status IS NULL OR status = 'draft';
UPDATE sup_products SET status = 'published' WHERE status IS NULL OR status = 'draft';
UPDATE sup_athletes SET status = 'published' WHERE status IS NULL OR status = 'draft';
UPDATE sup_creators SET status = 'published' WHERE status IS NULL OR status = 'draft';

-- ============================================================
-- 2. 创建赛事表（如不存在）
-- ============================================================

CREATE TABLE IF NOT EXISTS sup_events (
    event_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    slug VARCHAR(150) UNIQUE NOT NULL,
    event_type ENUM('race','festival','training','exhibition') DEFAULT 'race',
    location VARCHAR(200),
    province VARCHAR(50),
    city VARCHAR(50),
    venue VARCHAR(200),
    start_date DATE,
    end_date DATE,
    registration_deadline DATE,
    organizer VARCHAR(200),
    description TEXT,
    requirements TEXT,
    website VARCHAR(500),
    registration_url VARCHAR(500),
    contact_info VARCHAR(300),
    images JSON,
    schedule JSON,
    disciplines JSON,
    price_range VARCHAR(100),
    max_participants INT,
    status ENUM('draft', 'published') DEFAULT 'draft',
    event_status ENUM('upcoming','ongoing','completed','cancelled') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_events_type (event_type),
    INDEX idx_events_province (province),
    INDEX idx_events_start_date (start_date),
    INDEX idx_events_status (status),
    INDEX idx_events_event_status (event_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. 删除 UGC 相关表（如存在）
-- ============================================================

DROP TABLE IF EXISTS sup_contributions;
DROP TABLE IF EXISTS sup_wiki_users;

SELECT 'Migration v2 completed successfully' AS result;
