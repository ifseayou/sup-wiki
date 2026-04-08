-- SUP Wiki 商城 variants 字段迁移
-- 为 sup_shop_items 添加颜色变体支持（SPU/SKU 结构）

USE sport_hacker;

ALTER TABLE sup_shop_items
  ADD COLUMN variants JSON NULL
  COMMENT '颜色变体列表 [{color: string, images: string[], extra_note?: string}]'
  AFTER images;
