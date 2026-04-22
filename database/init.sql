-- SUP Wiki 数据库初始化脚本（v2）
-- 在 sport_hacker 数据库中创建 sup_ 前缀的表

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
    status ENUM('draft', 'published') DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_brands_tier (tier),
    INDEX idx_brands_status (status)
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
    buy_links JSON,
    images JSON,
    description TEXT,
    status ENUM('draft', 'published') DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES sup_brands(brand_id) ON DELETE CASCADE,
    INDEX idx_products_brand (brand_id),
    INDEX idx_products_type (type),
    INDEX idx_products_price (price_min, price_max),
    INDEX idx_products_status (status)
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
    achievements JSON,
    race_times JSON,
    icf_ranking INT,
    social_links JSON,
    status ENUM('draft', 'published') DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_athletes_discipline (discipline),
    INDEX idx_athletes_ranking (icf_ranking),
    INDEX idx_athletes_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 博主/KOL 表
CREATE TABLE IF NOT EXISTS sup_creators (
    creator_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    nickname VARCHAR(100) NOT NULL,
    avatar VARCHAR(500),
    bio TEXT,
    platform ENUM('douyin', 'xiaohongshu', 'bilibili', 'youtube', 'weibo', 'instagram', 'wechat_channels') NOT NULL,
    follower_tier ENUM('1k-10k', '10k-100k', '100k-1m', '1m+') DEFAULT '1k-10k',
    content_style ENUM('tutorial', 'review', 'vlog', 'adventure') DEFAULT 'vlog',
    profile_url VARCHAR(500),
    status ENUM('draft', 'published') DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_creators_platform (platform),
    INDEX idx_creators_tier (follower_tier),
    INDEX idx_creators_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 电商商城商品表（独立于知识库 sup_products）
CREATE TABLE IF NOT EXISTS sup_shop_items (
    shop_item_id   BIGINT PRIMARY KEY AUTO_INCREMENT,
    category       ENUM('board','paddle','life_jacket','accessory') NOT NULL,
    board_type     ENUM('race','allround','touring','yoga','inflatable') NULL COMMENT '仅 board 类使用',
    brand_id       BIGINT NULL COMMENT '可选，关联 sup_brands',
    product_id     BIGINT NULL COMMENT '可选，关联知识库 sup_products',
    name           VARCHAR(200) NOT NULL,
    slug           VARCHAR(150) UNIQUE NOT NULL,
    subtitle       VARCHAR(200) NULL COMMENT '副标题/一句话卖点',
    description    TEXT COMMENT '详细说明，支持换行',
    highlights     JSON COMMENT '卖点列表 string[]',
    cost_price     INT NULL COMMENT '成本价/代理拿货价（元，仅后台可见）',
    market_price   INT NULL COMMENT '市场价（元）',
    discount_price INT NULL COMMENT '到手价（元）',
    stock_status   ENUM('in_stock','low_stock','pre_order','sold_out') DEFAULT 'in_stock',
    images         JSON COMMENT '图片 URL 数组 string[]',
    videos         JSON COMMENT '视频列表 [{title,url,cover?}]',
    spec           JSON COMMENT '规格键值对，如 {length_cm:330,width_cm:76}',
    status         ENUM('draft','published') DEFAULT 'draft',
    sort_order     INT DEFAULT 0 COMMENT '排序权重，越大越靠前',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shop_category (category),
    INDEX idx_shop_brand (brand_id),
    INDEX idx_shop_status (status),
    INDEX idx_shop_sort (sort_order),
    FOREIGN KEY (brand_id) REFERENCES sup_brands(brand_id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES sup_products(product_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 赛事表
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
    star_level VARCHAR(20),
    score_coefficient DECIMAL(3,1),
    source_scope VARCHAR(100),
    result_status ENUM('none','partial','top10_complete','extended_complete') DEFAULT 'none',
    result_source_note TEXT,
    result_source_links JSON,
    result_last_verified_at TIMESTAMP NULL,
    status ENUM('draft', 'published') DEFAULT 'draft',
    event_status ENUM('upcoming','ongoing','completed','cancelled') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_events_type (event_type),
    INDEX idx_events_province (province),
    INDEX idx_events_start_date (start_date),
    INDEX idx_events_status (status),
    INDEX idx_events_event_status (event_status),
    INDEX idx_events_star_level (star_level),
    INDEX idx_events_result_status (result_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sup_event_results (
    result_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    event_id BIGINT NOT NULL,
    athlete_id BIGINT NULL,
    athlete_name_snapshot VARCHAR(100) NOT NULL,
    gender_group VARCHAR(100) NOT NULL DEFAULT '公开组',
    discipline VARCHAR(100) NOT NULL,
    round_label VARCHAR(100) NULL,
    rank_position INT NOT NULL,
    result_label VARCHAR(100) NULL,
    finish_time VARCHAR(50) NOT NULL,
    time_seconds DECIMAL(10,3) NULL,
    team_name VARCHAR(200) NULL,
    nationality_snapshot VARCHAR(50) NULL,
    source_type ENUM('official','media','livestream','manual') DEFAULT 'official',
    source_title VARCHAR(255) NULL,
    source_url VARCHAR(500) NULL,
    source_note TEXT NULL,
    is_verified TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_event_result_rank (event_id, gender_group, discipline, round_label, rank_position, athlete_name_snapshot),
    INDEX idx_event_results_event (event_id),
    INDEX idx_event_results_athlete (athlete_id),
    INDEX idx_event_results_rank (rank_position),
    CONSTRAINT fk_event_results_event FOREIGN KEY (event_id) REFERENCES sup_events(event_id) ON DELETE CASCADE,
    CONSTRAINT fk_event_results_athlete FOREIGN KEY (athlete_id) REFERENCES sup_athletes(athlete_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
