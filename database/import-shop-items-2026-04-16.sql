USE sport_hacker;

INSERT INTO sup_brands (slug, name, name_en, country, website, description, tier, status)
VALUES
  (
    'the-lightcorp',
    'THE LIGHTCORP',
    'THE LIGHTCORP',
    '中国',
    NULL,
    'THE LIGHTCORP 为专业竞技类器材品牌，由 WATER LIVE 在国内合作推广，主打高性能竞速器材。',
    'pro',
    'published'
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  name_en = VALUES(name_en),
  country = VALUES(country),
  website = VALUES(website),
  description = VALUES(description),
  tier = VALUES(tier),
  status = VALUES(status);

SET @nsp_brand_id = (SELECT brand_id FROM sup_brands WHERE slug = 'nsp' LIMIT 1);
SET @lightcorp_brand_id = (SELECT brand_id FROM sup_brands WHERE slug = 'the-lightcorp' LIMIT 1);

INSERT INTO sup_shop_items (
  category,
  board_type,
  brand_id,
  product_id,
  name,
  slug,
  subtitle,
  description,
  highlights,
  cost_price,
  market_price,
  discount_price,
  stock_status,
  images,
  variants,
  videos,
  spec,
  status,
  sort_order
)
VALUES (
  'board',
  NULL,
  @nsp_brand_id,
  NULL,
  'NSP Pro Carbon 系列',
  'nsp-pro-carbon-series',
  '集 Carolina、Cheetah、Ninja 三个板型于一体，覆盖竞速、海划与综合训练场景',
  'NSP Pro Carbon 系列面向竞速与高性能训练场景，包含 Carolina、Cheetah、Ninja 三个板型。适合需要平水效率、海况适应和专项竞赛表现的进阶桨手。',
  JSON_ARRAY(
    '包含 Carolina / Cheetah / Ninja 三个板型',
    '覆盖竞速、海划与综合训练需求',
    '适配平水、海划与竞速训练场景'
  ),
  NULL,
  NULL,
  NULL,
  'pre_order',
  JSON_ARRAY(
    '/shop-import/nsp/detail-01-lineup.jpg',
    '/shop-import/nsp/detail-02-structure.jpg',
    '/shop-import/nsp/detail-04-ninja-action.jpg',
    '/shop-import/nsp/detail-06-carolina-action.jpg',
    '/shop-import/nsp/detail-08-race-fins.jpg',
    '/shop-import/nsp/detail-09-team.jpg',
    '/shop-import/nsp/detail-10-brand-intro.jpg'
  ),
  JSON_ARRAY(
    JSON_OBJECT(
      'color', 'Ninja 14'' x 20"',
      'images', JSON_ARRAY(
        '/shop-import/nsp/ninja-14x20.jpg',
        '/shop-import/nsp/detail-03-ninja-spec.jpg'
      ),
      'extra_note', '竞速款'
    ),
    JSON_OBJECT(
      'color', 'Ninja 14'' x 21"',
      'images', JSON_ARRAY(
        '/shop-import/nsp/ninja-14x21.jpg',
        '/shop-import/nsp/detail-03-ninja-spec.jpg'
      ),
      'extra_note', '竞速款'
    ),
    JSON_OBJECT(
      'color', 'Carolina 14'' x 20.5"',
      'images', JSON_ARRAY(
        '/shop-import/nsp/carolina-14x20_5.jpg',
        '/shop-import/nsp/detail-05-carolina-spec.jpg'
      ),
      'extra_note', '全能款'
    ),
    JSON_OBJECT(
      'color', 'Cheetah 14'' x 21"',
      'images', JSON_ARRAY(
        '/shop-import/nsp/cheetah-14x21.jpg',
        '/shop-import/nsp/detail-07-cheetah-spec.jpg'
      ),
      'extra_note', '海划款'
    )
  ),
  NULL,
  JSON_OBJECT(
    '系列', 'NSP Pro Carbon',
    '可选板型', 'Ninja / Carolina / Cheetah',
    '可选规格', 'Ninja 14x20 / Ninja 14x21 / Carolina 14x20.5 / Cheetah 14x21'
  ),
  'published',
  120
)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  board_type = VALUES(board_type),
  brand_id = VALUES(brand_id),
  product_id = VALUES(product_id),
  name = VALUES(name),
  subtitle = VALUES(subtitle),
  description = VALUES(description),
  highlights = VALUES(highlights),
  cost_price = VALUES(cost_price),
  market_price = VALUES(market_price),
  discount_price = VALUES(discount_price),
  stock_status = VALUES(stock_status),
  images = VALUES(images),
  variants = VALUES(variants),
  videos = VALUES(videos),
  spec = VALUES(spec),
  status = VALUES(status),
  sort_order = VALUES(sort_order);

INSERT INTO sup_shop_items (
  category,
  board_type,
  brand_id,
  product_id,
  name,
  slug,
  subtitle,
  description,
  highlights,
  cost_price,
  market_price,
  discount_price,
  stock_status,
  images,
  variants,
  videos,
  spec,
  status,
  sort_order
)
VALUES (
  'board',
  'race',
  @lightcorp_brand_id,
  NULL,
  'THE LIGHTCORP 14''0"',
  'the-lightcorp-14-0',
  '14 尺竞技板，提供 21 / 22 / 23 英寸三档宽度选择',
  'THE LIGHTCORP 14''0" 面向竞技训练和比赛场景，固定板长 14 尺，支持 21、22、23 英寸三种宽度选择。',
  JSON_ARRAY(
    '14 尺竞技定位',
    '21 / 22 / 23 英寸三档宽度可选',
    '适合专项训练与赛事使用'
  ),
  NULL,
  NULL,
  NULL,
  'pre_order',
  JSON_ARRAY(
    '/shop-import/the-lightcorp/detail-01-cover.jpg',
    '/shop-import/the-lightcorp/detail-02-lineup.jpg',
    '/shop-import/the-lightcorp/detail-03-size.jpg',
    '/shop-import/the-lightcorp/detail-05-performance.jpg',
    '/shop-import/the-lightcorp/detail-06-fin.jpg',
    '/shop-import/the-lightcorp/detail-08-drainage.jpg',
    '/shop-import/the-lightcorp/detail-10-cockpit.jpg',
    '/shop-import/the-lightcorp/detail-11-tail.jpg',
    '/shop-import/the-lightcorp/detail-12-build.jpg',
    '/shop-import/the-lightcorp/detail-13-water.jpg',
    '/shop-import/the-lightcorp/detail-14-lifestyle.jpg',
    '/shop-import/the-lightcorp/detail-15-brand.jpg',
    '/shop-import/the-lightcorp/detail-16-waterlive.jpg'
  ),
  JSON_ARRAY(
    JSON_OBJECT(
      'color', '14''0" x 23"',
      'images', JSON_ARRAY(
        '/shop-import/the-lightcorp/lightcorp-14x23-main.jpg',
        '/shop-import/the-lightcorp/detail-04-23.jpg'
      ),
      'extra_note', '稳定性更强'
    ),
    JSON_OBJECT(
      'color', '14''0" x 22"',
      'images', JSON_ARRAY(
        '/shop-import/the-lightcorp/lightcorp-main-lineup.png',
        '/shop-import/the-lightcorp/detail-07-22.jpg'
      ),
      'extra_note', '均衡设定'
    ),
    JSON_OBJECT(
      'color', '14''0" x 21"',
      'images', JSON_ARRAY(
        '/shop-import/the-lightcorp/lightcorp-main-lineup.png',
        '/shop-import/the-lightcorp/detail-09-21.jpg'
      ),
      'extra_note', '更偏竞速'
    )
  ),
  NULL,
  JSON_OBJECT(
    '长度', '14''0"',
    '宽度可选', '21" / 22" / 23"',
    '重量', '9.3kg（23"）'
  ),
  'published',
  110
)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  board_type = VALUES(board_type),
  brand_id = VALUES(brand_id),
  product_id = VALUES(product_id),
  name = VALUES(name),
  subtitle = VALUES(subtitle),
  description = VALUES(description),
  highlights = VALUES(highlights),
  cost_price = VALUES(cost_price),
  market_price = VALUES(market_price),
  discount_price = VALUES(discount_price),
  stock_status = VALUES(stock_status),
  images = VALUES(images),
  variants = VALUES(variants),
  videos = VALUES(videos),
  spec = VALUES(spec),
  status = VALUES(status),
  sort_order = VALUES(sort_order);
