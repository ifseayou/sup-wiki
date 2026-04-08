-- SUP Wiki 电商模块迁移脚本
-- 新增 sup_shop_items 表（独立于知识库 sup_products）

USE sport_hacker;

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
