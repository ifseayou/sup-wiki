USE sport_hacker;

SET @event_slug = 'longhushan-sup-race-yingtan-2026';
SET @source_url = 'https://mp.weixin.qq.com/s/_Yd6CPHkDaOKW5azft-Yqw?scene=1';
SET @registration_qr_image = 'http://mmbiz.qpic.cn/mmbiz_png/swwWPP8AicAujGkjOjiayAc8NtMPLoHZ66UEkroxZFaBa92iafdPO4icQIOahbOUOU5XU3UMZxFyXyhNj2SFQ1x2Cg/0?wx_fmt=png';
SET @image_route = 'https://mmbiz.qpic.cn/mmbiz_jpg/swwWPP8AicAtvdKj9hKyDJuxEDVNWicKKfDiarORiaHs7A4ms9JdgSfOkffCwlHFALmIlTA5oVDFNUbJJYDzTYhnAA/640?wx_fmt=other&wxfrom=10005&wx_lazy=1&wx_co=1';
SET @image_poster = 'https://mmbiz.qpic.cn/mmbiz_png/swwWPP8AicAtvdKj9hKyDJuxEDVNWicKKfgyAVib91osYibun7pnWKvicCboj4ia6tOOHnoibOyn0BYdZnAiaD30BZuzvQ/640?wx_fmt=other&wxfrom=10005&wx_lazy=1&wx_co=1';

START TRANSACTION;

INSERT INTO sup_events (
  name, slug, series_name, edition_number, event_type, location, province, city, venue,
  start_date, end_date, registration_start_date, registration_deadline,
  organizer, description, requirements, website, registration_url, registration_qr_image,
  contact_info, images, schedule, disciplines, price_range, prize_pool, prize_description,
  max_participants, star_level, score_coefficient, source_scope,
  result_status, result_source_note, result_source_links,
  status, event_status
) VALUES (
  '2026“龙虎天下绝”龙虎山第五届桨板大赛暨“运动赣鄱·活力江西”江西省第十七届运动会（社会部）鹰潭市桨板选拔赛',
  @event_slug,
  '龙虎山桨板大赛',
  5,
  'race',
  '江西省鹰潭市龙虎山风景名胜区',
  '江西省',
  '鹰潭市',
  '龙虎山风景名胜区（仙水岩至道堂岩河段、桃花洲）',
  '2026-06-20',
  '2026-06-21',
  '2026-05-27',
  '2026-06-06',
  '鹰潭市体育局、鹰潭市龙虎山风景名胜区管理委员会、鹰潭市文化旅游投资发展集团有限公司',
  '本届赛事以“龙腾虎跃逐泸溪，桨驭丹霞竞风流”为主题，依托龙虎山自然水域资源，组织为期两天的全国桨板精英大赛，并作为“运动赣鄱·活力江西”江西省第十七届运动会（社会部）鹰潭市桨板选拔赛。赛事线路为仙水岩至道堂岩河段，竞速赛往返约6000米，龙板赛约200米，青少年组约2000米。',
  '全程6000米组年龄要求18-65周岁；少年组2000米年龄要求10-17周岁。参赛者须为国内外SUP桨板运动爱好者及水上运动爱好者，以有效身份证或护照信息为准；须身体健康，无心脏病、癫痫病、视听觉障碍等不适宜参赛情况；赛前须签订运动员安全责任书；所有参赛运动员须具备静水游泳200米以上能力。竞速赛限充气板，长度不超过4.27米；所有运动员必须穿着救生衣并佩戴安全脚绳。',
  @source_url,
  NULL,
  @registration_qr_image,
  '报名咨询：管女士 13006238000；鹰潭第五届桨板比赛群：575728332',
  JSON_ARRAY(@image_poster, @image_route, @registration_qr_image),
  JSON_ARRAY(
    JSON_OBJECT('date', '2026-06-20', 'time', '10:00-16:00', 'title', '报到', 'location', '龙虎山仙水岩景门'),
    JSON_OBJECT('date', '2026-06-20', 'time', '16:30-17:30', 'title', '龙板团队赛'),
    JSON_OBJECT('date', '2026-06-21', 'time', '09:00-09:30', 'title', '启动仪式', 'location', '桃花洲'),
    JSON_OBJECT('date', '2026-06-21', 'time', '09:30-11:30', 'title', '竞速组及青少年组比赛', 'location', '桃花洲'),
    JSON_OBJECT('date', '2026-06-21', 'time', '11:30', 'title', '颁奖仪式', 'location', '桃花洲')
  ),
  JSON_ARRAY('6000米竞速赛', '200米龙板团队赛', '2000米青少年组'),
  '个人288元/人；同地区10人以上团队268元/人；龙板团队组200元/队；桨板租赁100元/套/天',
  '竞速组男女前30名奖金；龙板团队组前6名奖金；青少年男女前6名奖金',
  '竞速组（男女）：第1名3000元、第2名2000元、第3名1500元、第4名1000元、第5名800元、第6名600元、第7名400元、第8-10名各300元、第11-20名各200元、第21-30名各100元。龙板赛团队组：第1名3600元、第2名2600元、第3名2000元、第4名1000元、第5名800元、第6名600元。青少年组（男女）：第1名500元、第2名300元、第3名200元、第4-6名各100元。',
  300,
  '三星',
  3.0,
  '全国',
  'none',
  '报名信息来源：鹰潭马拉松公众号，发布于2026-05-27。本次仅录入赛事报名公告和规程信息，无成绩册、无积分。',
  JSON_ARRAY(JSON_OBJECT('title', '鹰潭马拉松公众号报名公告', 'url', @source_url)),
  'published',
  'upcoming'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  series_name = VALUES(series_name),
  edition_number = VALUES(edition_number),
  event_type = VALUES(event_type),
  location = VALUES(location),
  province = VALUES(province),
  city = VALUES(city),
  venue = VALUES(venue),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date),
  registration_start_date = VALUES(registration_start_date),
  registration_deadline = VALUES(registration_deadline),
  organizer = VALUES(organizer),
  description = VALUES(description),
  requirements = VALUES(requirements),
  website = VALUES(website),
  registration_url = VALUES(registration_url),
  registration_qr_image = VALUES(registration_qr_image),
  contact_info = VALUES(contact_info),
  images = VALUES(images),
  schedule = VALUES(schedule),
  disciplines = VALUES(disciplines),
  price_range = VALUES(price_range),
  prize_pool = VALUES(prize_pool),
  prize_description = VALUES(prize_description),
  max_participants = VALUES(max_participants),
  star_level = VALUES(star_level),
  score_coefficient = VALUES(score_coefficient),
  source_scope = VALUES(source_scope),
  result_status = VALUES(result_status),
  result_source_note = VALUES(result_source_note),
  result_source_links = VALUES(result_source_links),
  status = VALUES(status),
  event_status = VALUES(event_status);

SET @event_id = (SELECT event_id FROM sup_events WHERE slug = @event_slug LIMIT 1);

DELETE p
FROM sup_event_category_prizes p
INNER JOIN sup_event_categories c ON c.category_id = p.category_id
WHERE c.event_id = @event_id;
DELETE FROM sup_event_categories WHERE event_id = @event_id;
DELETE FROM sup_event_officials WHERE event_id = @event_id;

INSERT INTO sup_event_categories (
  event_id, name, discipline, gender_group, board_class, fee, fee_amount, prize, quota, sort_order
) VALUES
  (@event_id, '6000米竞速赛男子组', '6000米竞速赛', '男子组', '充气板≤4.27米', '288元/人', 288, '竞速组奖金：前30名最高3000元', NULL, 10),
  (@event_id, '6000米竞速赛女子组', '6000米竞速赛', '女子组', '充气板≤4.27米', '288元/人', 288, '竞速组奖金：前30名最高3000元', NULL, 20),
  (@event_id, '200米龙板团队赛', '200米龙板团队赛', '团队组', '龙板', '200元/队', 200, '龙板团队组奖金：前6名最高3600元', NULL, 30),
  (@event_id, '2000米青少年组男子组', '2000米青少年组', '男子组', '桨板', '288元/人', 288, '青少年组奖金：前6名最高500元', NULL, 40),
  (@event_id, '2000米青少年组女子组', '2000米青少年组', '女子组', '桨板', '288元/人', 288, '青少年组奖金：前6名最高500元', NULL, 50);

INSERT INTO sup_event_category_prizes (event_id, category_id, rank_position, amount)
SELECT @event_id, c.category_id, ranks.rank_position,
  CASE
    WHEN c.discipline = '6000米竞速赛' THEN
      CASE
        WHEN ranks.rank_position = 1 THEN 3000
        WHEN ranks.rank_position = 2 THEN 2000
        WHEN ranks.rank_position = 3 THEN 1500
        WHEN ranks.rank_position = 4 THEN 1000
        WHEN ranks.rank_position = 5 THEN 800
        WHEN ranks.rank_position = 6 THEN 600
        WHEN ranks.rank_position = 7 THEN 400
        WHEN ranks.rank_position BETWEEN 8 AND 10 THEN 300
        WHEN ranks.rank_position BETWEEN 11 AND 20 THEN 200
        ELSE 100
      END
    WHEN c.discipline = '200米龙板团队赛' THEN ELT(ranks.rank_position, 3600, 2600, 2000, 1000, 800, 600)
    ELSE ELT(ranks.rank_position, 500, 300, 200, 100, 100, 100)
  END AS amount
FROM sup_event_categories c
CROSS JOIN (
  SELECT 1 AS rank_position UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
  UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
  UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
  UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
  UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
  UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
) ranks
WHERE c.event_id = @event_id
  AND (
    (c.discipline = '6000米竞速赛' AND ranks.rank_position <= 30)
    OR (c.discipline = '200米龙板团队赛' AND ranks.rank_position <= 6)
    OR (c.discipline = '2000米青少年组' AND ranks.rank_position <= 6)
  );

INSERT INTO sup_event_officials (event_id, role_category, role_title, name, region, sort_order)
VALUES
  (@event_id, '裁判', '裁判长', '待补充', '一级体育指导员', 10),
  (@event_id, '救援', '水上救援队长', '待补充', '赛事组委会', 20);

UPDATE sup_event_submissions
SET review_status = 'ingested',
    event_id = @event_id,
    admin_note = '已根据公众号报名公告手工核验录入：2026龙虎山第五届桨板大赛。',
    updated_at = CURRENT_TIMESTAMP
WHERE link_url LIKE '%_Yd6CPHkDaOKW5azft-Yqw%';

COMMIT;

SELECT
  e.event_id,
  e.name,
  e.slug,
  e.start_date,
  e.end_date,
  e.registration_deadline,
  e.status,
  e.event_status,
  e.result_status,
  e.star_level,
  e.score_coefficient,
  (SELECT COUNT(*) FROM sup_event_categories c WHERE c.event_id = e.event_id) AS category_count,
  (SELECT COUNT(*) FROM sup_event_category_prizes p WHERE p.event_id = e.event_id) AS prize_rows,
  (SELECT COUNT(*) FROM sup_event_officials o WHERE o.event_id = e.event_id) AS official_rows
FROM sup_events e
WHERE e.slug = @event_slug
LIMIT 1;
