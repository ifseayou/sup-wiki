USE sport_hacker;

UPDATE sup_shop_items
SET
  subtitle = '集 Carolina、Cheetah、Ninja 三个板型于一体，覆盖竞速、海划与综合训练场景',
  description = 'NSP Pro Carbon 系列面向竞速与高性能训练场景，包含 Carolina、Cheetah、Ninja 三个板型。适合需要平水效率、海况适应和专项竞赛表现的进阶桨手。',
  highlights = JSON_ARRAY(
    '包含 Carolina / Cheetah / Ninja 三个板型',
    '覆盖竞速、海划与综合训练需求',
    '适配平水、海划与竞速训练场景'
  ),
  spec = JSON_OBJECT(
    '系列', 'NSP Pro Carbon',
    '可选板型', 'Ninja / Carolina / Cheetah',
    '可选规格', 'Ninja 14x20 / Ninja 14x21 / Carolina 14x20.5 / Cheetah 14x21'
  )
WHERE slug = 'nsp-pro-carbon-series';

UPDATE sup_shop_items
SET
  subtitle = '14 尺竞技板，提供 21 / 22 / 23 英寸三档宽度选择',
  description = 'THE LIGHTCORP 14''0" 面向竞技训练和比赛场景，固定板长 14 尺，支持 21、22、23 英寸三种宽度选择。',
  highlights = JSON_ARRAY(
    '14 尺竞技定位',
    '21 / 22 / 23 英寸三档宽度可选',
    '适合专项训练与赛事使用'
  ),
  spec = JSON_OBJECT(
    '长度', '14''0"',
    '宽度可选', '21" / 22" / 23"',
    '重量', '9.3kg（23"）'
  )
WHERE slug = 'the-lightcorp-14-0';
