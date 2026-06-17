USE sport_hacker;

SET @event_slug = 'yangtze-river-delta-canoe-sup-suzhou-wujiang-2026';
SET @source_url = 'https://mp.weixin.qq.com/s/mmXBG_iyzbnmUzv4OjRUdQ';
SET @image_categories = 'https://mmbiz.qpic.cn/sz_mmbiz_png/yByqEUarSHR0ElnCHlWYIhW0ibeJPAhLpq6IAKtSfg4z9EGltKyK1F92ApVowyvwsXRxLFh63Jyh00eJX3j5brBibsicSScd8icPMSBdauyYXeU/640?wx_fmt=png&from=appmsg&watermark=1';
SET @image_schedule = 'https://mmbiz.qpic.cn/sz_mmbiz_png/yByqEUarSHQsaHmPlwfJC8giaENPbzB5puibVxXoSXOvn3RCRhvObyczTzFzo3QE8IfLwAucInAlibv0iaYLu6TgHQPjiaWN3PpoxPY7AV32v2Dg/640?wx_fmt=png&from=appmsg&watermark=1';
SET @image_route_6k = 'https://mmbiz.qpic.cn/sz_mmbiz_png/yByqEUarSHRZeiaFoiaxicico7lO5X52AODvGiaGQf3LxoiaWBkaC9JIacyT2kMltDH8YYsQcbUU7Zlv7ibdnWMqHYcZCFgzzjxBO9RkYkvY70aEn4/640?wx_fmt=png&from=appmsg&watermark=1';
SET @image_route_2k = 'https://mmbiz.qpic.cn/mmbiz_png/yByqEUarSHTDd3WmJRzJBBsvtqDtqGksBbBrDcdU5UQvuLDtqPME78Ig8gick7A46G3boPTr9PnhOtheJ4iaPSxcvibVDmiaevAFUHjFwyyKXuY/640?wx_fmt=png&from=appmsg&watermark=1';

START TRANSACTION;

INSERT INTO sup_events (
  name, slug, series_name, edition_number, event_type, location, province, city, venue,
  start_date, end_date, registration_start_date, registration_deadline,
  organizer, description, requirements, website, registration_url, registration_qr_image,
  contact_info, images, schedule, disciplines, price_range, prize_pool, prize_description,
  max_participants, source_scope, result_status, result_source_note, result_source_links,
  status, event_status
) VALUES (
  '2026第十届长三角皮划艇桨板大赛暨2026苏州市桨板系列赛吴江站',
  @event_slug,
  '长三角皮划艇桨板大赛 / 苏州市桨板系列赛',
  10,
  'race',
  '江苏省苏州市苏州湾旅游区顾家荡路码头',
  '江苏省',
  '苏州市',
  '苏州湾旅游区顾家荡路码头',
  '2026-06-27',
  '2026-06-27',
  '2026-05-18',
  '2026-06-13',
  '苏州市体育局、苏州市体育总会',
  '2026第十届长三角皮划艇桨板大赛暨2026苏州市桨板系列赛吴江站，比赛设成人6公里长距离绕标赛与青少年2公里短距离绕标赛，比赛地点为苏州湾旅游区顾家荡路码头。',
  '参赛年龄12-65岁，以2026年12月31日为计龄时间；现役皮划艇运动员及退役三年内的皮划艇运动员不得参加比赛；参赛者须会游泳并具备一定皮划艇桨板技能，自行购买保额不低于50万元的保险。上午成人组6公里比赛只可报一项，青少年比赛可兼项报名。所有项目桨和救生衣自带；绕标赛自带艇组不限艇型，自带桨板组板型尺寸不限。',
  @source_url,
  NULL,
  @image_route_2k,
  '报名联系电话：马云龙 18896525014',
  JSON_ARRAY(@image_categories, @image_schedule, @image_route_6k, @image_route_2k),
  JSON_ARRAY(
    JSON_OBJECT('date', '2026-06-26', 'time', '14:00-20:00', 'title', '报到领取材料', 'location', '苏州湾旅游区顾家荡路码头'),
    JSON_OBJECT('date', '2026-06-27', 'time', '08:30-09:00', 'title', '开幕式'),
    JSON_OBJECT('date', '2026-06-27', 'time', '09:00-10:00', 'title', '6公里皮艇绕标赛 / 6公里桨板绕标赛'),
    JSON_OBJECT('date', '2026-06-27', 'time', '10:00-10:30', 'title', '青少年2公里皮艇男单 / 女单'),
    JSON_OBJECT('date', '2026-06-27', 'time', '10:30-11:00', 'title', '青少年2公里桨板男单'),
    JSON_OBJECT('date', '2026-06-27', 'time', '11:00-11:30', 'title', '青少年2公里桨板女单'),
    JSON_OBJECT('date', '2026-06-27', 'time', '11:30-12:00', 'title', '颁奖')
  ),
  JSON_ARRAY('6公里皮艇', '6公里桨板', '青少年2公里皮艇', '青少年2公里桨板'),
  '100元/项',
  '6公里项目前8名最高2000元；2公里青少年项目前8名最高600元+奖品',
  '长距离绕标赛6公里皮艇和6公里桨板：参赛数不足8艇/板取消该项目；8-14艇/板奖励前3名；15-25艇/板奖励前5名；26-70艇/板奖励前8名，税前奖金依次为2000、1500、1200、800、600、500、400、300元。青少年短距离绕标赛2公里皮艇和2公里桨板：参赛数不足8艇/板取消该项目；8-14艇/板奖励前3名；15-25艇/板奖励前5名；26-50艇/板奖励前8名，奖励依次为600+奖品、400+奖品、300+奖品、200+奖品、150+奖品、100+奖品、100+奖品、100+奖品。',
  440,
  '公众号赛事报名信息',
  'none',
  '报名信息来源：苏州市皮划艇桨板协会公众号，发布于2026-05-18 14:04。本次仅录入赛事报名信息，无成绩册、无积分。',
  JSON_ARRAY(JSON_OBJECT('title', '苏州市皮划艇桨板协会公众号报名公告', 'url', @source_url)),
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
  (@event_id, '6公里皮艇-自带艇男子组', '6公里皮艇', '男子组', '自带艇', '100元/项', 100, '长距离绕标赛奖金：前8名最高2000元', 70, 10),
  (@event_id, '6公里皮艇-自带艇女子组', '6公里皮艇', '女子组', '自带艇', '100元/项', 100, '长距离绕标赛奖金：前8名最高2000元', 50, 20),
  (@event_id, '6公里皮艇-统一艇男子组', '6公里皮艇', '男子组', '统一艇', '100元/项', 100, '长距离绕标赛奖金：前8名最高2000元', 50, 30),
  (@event_id, '6公里皮艇-统一艇女子组', '6公里皮艇', '女子组', '统一艇', '100元/项', 100, '长距离绕标赛奖金：前8名最高2000元', 30, 40),
  (@event_id, '6公里桨板-自带板男子组', '6公里桨板', '男子组', '自带板', '100元/项', 100, '长距离绕标赛奖金：前8名最高2000元', 70, 50),
  (@event_id, '6公里桨板-自带板女子组', '6公里桨板', '女子组', '自带板', '100元/项', 100, '长距离绕标赛奖金：前8名最高2000元', 50, 60),
  (@event_id, '青少年2公里皮艇-统一艇男子组', '青少年2公里皮艇', '男子组', '统一艇', '100元/项', 100, '青少年短距离绕标赛奖励：前8名最高600元+奖品', 50, 70),
  (@event_id, '青少年2公里皮艇-统一艇女子组', '青少年2公里皮艇', '女子组', '统一艇', '100元/项', 100, '青少年短距离绕标赛奖励：前8名最高600元+奖品', 30, 80),
  (@event_id, '青少年2公里桨板-统一板男子组', '青少年2公里桨板', '男子组', '统一板', '100元/项', 100, '青少年短距离绕标赛奖励：前8名最高600元+奖品', 20, 90),
  (@event_id, '青少年2公里桨板-统一板女子组', '青少年2公里桨板', '女子组', '统一板', '100元/项', 100, '青少年短距离绕标赛奖励：前8名最高600元+奖品', 20, 100);

INSERT INTO sup_event_category_prizes (event_id, category_id, rank_position, amount)
SELECT @event_id, c.category_id, ranks.rank_position,
  CASE
    WHEN c.discipline LIKE '青少年2公里%' THEN ELT(ranks.rank_position, 600, 400, 300, 200, 150, 100, 100, 100)
    ELSE ELT(ranks.rank_position, 2000, 1500, 1200, 800, 600, 500, 400, 300)
  END AS amount
FROM sup_event_categories c
CROSS JOIN (
  SELECT 1 AS rank_position UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
) ranks
WHERE c.event_id = @event_id;

COMMIT;

SELECT
  e.event_id,
  e.name,
  e.slug,
  e.start_date,
  e.registration_deadline,
  e.status,
  e.event_status,
  e.result_status,
  (SELECT COUNT(*) FROM sup_event_categories c WHERE c.event_id = e.event_id) AS category_count,
  (SELECT COALESCE(SUM(c.quota), 0) FROM sup_event_categories c WHERE c.event_id = e.event_id) AS quota_total,
  (SELECT COUNT(*) FROM sup_event_category_prizes p WHERE p.event_id = e.event_id) AS prize_rows
FROM sup_events e
WHERE e.slug = @event_slug
LIMIT 1;
