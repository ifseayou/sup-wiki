-- 经营管理：器材销售 / 课程培训 销售订单录入表。
-- 利润不落库（selling_price - cost_price 实时算）；cost_price / item_name 录入时快照，商品后续改价不影响历史订单。
-- 幂等。运行：cd sup-wiki && node scripts/run-migration.js database/migrate-sales-orders-2026-06-30.sql
USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_sales_orders (
  order_id      BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_type    ENUM('equipment','course') NOT NULL COMMENT '器材销售/课程培训',
  customer_name VARCHAR(100) NOT NULL COMMENT '客户姓名',
  order_date    DATE NOT NULL COMMENT '成交日期',
  shop_item_id  BIGINT NULL COMMENT '器材订单关联的商城商品 sup_shop_items.shop_item_id',
  item_name     VARCHAR(200) NOT NULL COMMENT '快照：商品名 或 培训项目名',
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '销售价',
  cost_price    DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '成本价快照（课程为0）',
  notes         VARCHAR(500) NULL COMMENT '备注',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sales_type (order_type),
  INDEX idx_sales_date (order_date),
  INDEX idx_sales_customer (customer_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='器材/课程销售订单录入';
