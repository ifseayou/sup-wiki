-- 商城草稿商品：世恒(SHAEN) 2025 款碳纤维桨。价格/图片留空，后台补全后发布。
-- 幂等（按 slug 唯一键 upsert）。运行：cd sup-wiki && node scripts/run-migration.js database/seed-shaen-2025-carbon-paddle.sql
USE sport_hacker;

INSERT INTO sup_shop_items (category, name, slug, subtitle, brand_id, status, stock_status, sort_order)
VALUES (
  'paddle',
  '世恒2025款碳纤维桨',
  'shaen-2025-carbon-paddle',
  '全碳纤维桨叶，轻量高刚性',
  (SELECT brand_id FROM sup_brands WHERE name LIKE '%世恒%' OR name LIKE '%SHAEN%' LIMIT 1),
  'draft',
  'in_stock',
  0
)
ON DUPLICATE KEY UPDATE name = VALUES(name);
