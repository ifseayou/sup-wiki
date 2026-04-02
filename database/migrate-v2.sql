-- SUP Wiki v2 数据库迁移脚本
-- 执行前请备份数据库！
-- 适用于：hk_aliyun_ecs 上的 sport_hacker 数据库

USE sport_hacker;

-- ============================================================
-- 1. 为所有实体表添加 status 字段（draft/published）
-- ============================================================

ALTER TABLE sup_brands
  ADD COLUMN IF NOT EXISTS status ENUM('draft','published') DEFAULT 'published'
  AFTER description;

ALTER TABLE sup_products
  ADD COLUMN IF NOT EXISTS status ENUM('draft','published') DEFAULT 'published'
  AFTER description;

ALTER TABLE sup_athletes
  ADD COLUMN IF NOT EXISTS status ENUM('draft','published') DEFAULT 'published'
  AFTER social_links;

ALTER TABLE sup_creators
  ADD COLUMN IF NOT EXISTS status ENUM('draft','published') DEFAULT 'published'
  AFTER profile_url;

-- 将已有数据全部设为 published（默认值已设置，但显式更新确保一致）
UPDATE sup_brands SET status = 'published' WHERE status IS NULL;
UPDATE sup_products SET status = 'published' WHERE status IS NULL;
UPDATE sup_athletes SET status = 'published' WHERE status IS NULL;
UPDATE sup_creators SET status = 'published' WHERE status IS NULL;

-- ============================================================
-- 2. 创建赛事表
-- ============================================================

CREATE TABLE IF NOT EXISTS sup_events (
    event_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL COMMENT '赛事名称（中文）',
    name_en VARCHAR(200) COMMENT '赛事名称（英文）',
    slug VARCHAR(150) UNIQUE NOT NULL COMMENT 'URL 友好标识',
    event_type ENUM('race','festival','training','exhibition') DEFAULT 'race' COMMENT '赛事类型',
    location VARCHAR(200) COMMENT '举办地点',
    province VARCHAR(50) COMMENT '省份',
    city VARCHAR(50) COMMENT '城市',
    venue VARCHAR(200) COMMENT '具体场馆',
    start_date DATE COMMENT '开始日期',
    end_date DATE COMMENT '结束日期',
    registration_deadline DATE COMMENT '报名截止日期',
    organizer VARCHAR(200) COMMENT '主办方',
    description TEXT COMMENT '赛事介绍',
    requirements TEXT COMMENT '参赛要求',
    website VARCHAR(500) COMMENT '官方网站',
    registration_url VARCHAR(500) COMMENT '报名链接',
    contact_info VARCHAR(300) COMMENT '联系方式',
    images JSON COMMENT '赛事图片列表 [url1, url2, ...]',
    schedule JSON COMMENT '赛程安排 [{date, time, event}]',
    disciplines JSON COMMENT '参赛项目 ["race", "distance", ...]',
    price_range VARCHAR(100) COMMENT '报名费区间，如 "¥200-¥500"',
    max_participants INT COMMENT '最大参赛人数',
    status ENUM('draft','published') DEFAULT 'draft' COMMENT '内容状态',
    event_status ENUM('upcoming','ongoing','completed','cancelled') DEFAULT 'upcoming' COMMENT '赛事状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_events_type (event_type),
    INDEX idx_events_province (province),
    INDEX idx_events_start_date (start_date),
    INDEX idx_events_status (status),
    INDEX idx_events_event_status (event_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SUP 赛事信息表';

-- ============================================================
-- 3. 删除 UGC 相关表（先删子表再删父表）
-- ============================================================

DROP TABLE IF EXISTS sup_contributions;
DROP TABLE IF EXISTS sup_wiki_users;

-- ============================================================
-- 验证迁移结果
-- ============================================================
-- SHOW COLUMNS FROM sup_brands LIKE 'status';
-- SHOW COLUMNS FROM sup_events;
-- SHOW TABLES LIKE 'sup_%';
