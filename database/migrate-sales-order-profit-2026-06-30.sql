-- 销售订单：新增可手改的「利润」列。默认按 销售价-成本价，允许管理员录入时覆盖。
-- 幂等。运行：cd sup-wiki && node scripts/run-migration.js database/migrate-sales-order-profit-2026-06-30.sql
USE sport_hacker;

DELIMITER $$
DROP PROCEDURE IF EXISTS add_col_if_missing $$
CREATE PROCEDURE add_col_if_missing(
  IN p_table VARCHAR(64),
  IN p_col VARCHAR(64),
  IN p_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col
  ) THEN
    SET @ddl = p_sql;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
DELIMITER ;

CALL add_col_if_missing('sup_sales_orders', 'profit', "ALTER TABLE sup_sales_orders ADD COLUMN profit DECIMAL(10,2) NULL COMMENT '利润（可手改；NULL 视为按销售价-成本价）' AFTER cost_price");

-- 回填历史行（NULL 的按销售价-成本价）。
UPDATE sup_sales_orders SET profit = selling_price - cost_price WHERE profit IS NULL;
