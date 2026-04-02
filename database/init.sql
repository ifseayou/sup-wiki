-- SUP Wiki 数据库初始化脚本
-- 在 sport_hacker 数据库中创建 6 张 sup_ 前缀的表

USE sport_hacker;

-- 品牌表
CREATE TABLE IF NOT EXISTS sup_brands (
    brand_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    logo VARCHAR(500),
    country VARCHAR(50),
    website VARCHAR(255),
    description TEXT,
    tier ENUM('entry', 'intermediate', 'pro') DEFAULT 'entry',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_brands_tier (tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 产品表
CREATE TABLE IF NOT EXISTS sup_products (
    product_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    brand_id BIGINT NOT NULL,
    model VARCHAR(150) NOT NULL,
    type ENUM('inflatable', 'hardboard', 'race', 'allround', 'yoga', 'touring') DEFAULT 'allround',
    length_cm DECIMAL(6,1),
    width_cm DECIMAL(5,1),
    thickness_cm DECIMAL(4,1),
    weight_kg DECIMAL(4,1),
    material VARCHAR(100),
    max_load_kg INT,
    suitable_for ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
    price_min INT,
    price_max INT,
    buy_links JSON,           -- [{platform, url}]
    images JSON,              -- [url1, url2, ...]
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES sup_brands(brand_id) ON DELETE CASCADE,
    INDEX idx_products_brand (brand_id),
    INDEX idx_products_type (type),
    INDEX idx_products_price (price_min, price_max)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 运动员表
CREATE TABLE IF NOT EXISTS sup_athletes (
    athlete_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    nationality VARCHAR(50),
    photo VARCHAR(500),
    bio TEXT,
    discipline ENUM('race', 'surf', 'distance', 'technical') DEFAULT 'race',
    achievements JSON,        -- [{year, event, result}]
    icf_ranking INT,
    social_links JSON,        -- {instagram, youtube, ...}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_athletes_discipline (discipline),
    INDEX idx_athletes_ranking (icf_ranking)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 博主/KOL 表
CREATE TABLE IF NOT EXISTS sup_creators (
    creator_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    nickname VARCHAR(100) NOT NULL,
    avatar VARCHAR(500),
    bio TEXT,
    platform ENUM('douyin', 'xiaohongshu', 'bilibili', 'youtube', 'weibo') NOT NULL,
    follower_tier ENUM('1k-10k', '10k-100k', '100k-1m', '1m+') DEFAULT '1k-10k',
    content_style ENUM('tutorial', 'review', 'vlog', 'adventure') DEFAULT 'vlog',
    profile_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_creators_platform (platform),
    INDEX idx_creators_tier (follower_tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SUP Wiki 用户表（复用 sport_hacker 的 users 表的 user_id）
CREATE TABLE IF NOT EXISTS sup_wiki_users (
    sup_user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,  -- 关联 users.user_id
    role ENUM('contributor', 'admin') DEFAULT 'contributor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 贡献请求表（类 PR）
CREATE TABLE IF NOT EXISTS sup_contributions (
    contribution_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sup_user_id BIGINT NOT NULL,
    entity_type ENUM('brand', 'product', 'athlete', 'creator') NOT NULL,
    entity_id BIGINT,         -- 已有实体的 ID（编辑时为空则新增）
    action ENUM('create', 'update') NOT NULL,
    payload JSON NOT NULL,    -- 提交的完整数据
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    review_note VARCHAR(500),
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sup_user_id) REFERENCES sup_wiki_users(sup_user_id) ON DELETE CASCADE,
    INDEX idx_contributions_status (status),
    INDEX idx_contributions_user (sup_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
