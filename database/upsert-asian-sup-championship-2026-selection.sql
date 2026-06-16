USE sport_hacker;

SET @event_slug = 'asian-sup-championship-kyotango-2026';
SET @source_title = '体育总局水上中心关于公示《第二届亚洲桨板锦标赛中国运动员选拔办法》的通知';

START TRANSACTION;

INSERT INTO sup_events (
  name, name_en, slug, series_name, edition_number, event_type, location, province, city, venue,
  start_date, end_date, registration_start_date, registration_deadline,
  organizer, description, requirements, website, registration_url, registration_qr_image,
  contact_info, images, schedule, disciplines, price_range, prize_pool, prize_description,
  max_participants, star_level, score_coefficient, source_scope, result_status, result_source_note,
  result_source_links, event_guide, status, event_status
) VALUES (
  '第二届亚洲桨板锦标赛',
  '2nd Asian SUP Championship',
  @event_slug,
  '亚洲桨板锦标赛',
  2,
  'race',
  '日本京都府京丹后市',
  '日本',
  '京丹后市',
  '京都府京丹后市',
  '2026-08-06',
  '2026-08-08',
  '2026-04-28',
  '2026-05-20',
  '赛事组委会；中国运动员选拔通知发布：国家体育总局水上运动管理中心',
  '第二届亚洲桨板锦标赛将于2026年8月6日至8日在日本京都府京丹后市举行。体育总局水上中心于2026年4月28日公示中国运动员选拔办法，拟依据中国桨板精英运动员竞技积分排名择优组建国家队参赛。',
  '中国运动员参选资格：中华人民共和国公民，近一年无违法违纪违规记录；遵守国家法律法规及国家队管理规定；符合赛事年龄分组要求并具备对应项目专项能力与比赛经验；无兴奋剂和赛风赛纪违规记录，自愿签署反兴奋剂与赛风赛纪承诺书；能够按要求参加集训并配合签证、报名注册、保险等手续；愿意自行承担报名参赛相关费用。参选申请须于2026年5月20日前通过所在单位（俱乐部）提交书面正式申请，报名材料包括参选申请表、身份证复印件和半年内体检证明。',
  NULL,
  NULL,
  NULL,
  '中国运动员选拔联系人：段培尧；电话：010-67113689；邮箱：chinasup@sports.cn；监督举报邮箱：sszxjw2021@126.com',
  JSON_ARRAY(),
  JSON_ARRAY(
    JSON_OBJECT('date', '2026-04-28', 'time', '2026-04-28 至 2026-05-07', 'title', '中国运动员选拔办法公示并征求意见'),
    JSON_OBJECT('date', '2026-05-20', 'time', '截止', 'title', '中国运动员参选申请截止'),
    JSON_OBJECT('date', '2026-06-30', 'time', '截止', 'title', '中国桨板精英运动员竞技积分排名统计截止'),
    JSON_OBJECT('date', '2026-08-06', 'time', '2026-08-06 至 2026-08-08', 'title', '第二届亚洲桨板锦标赛正赛')
  ),
  JSON_ARRAY('100米冲刺赛', '800-1000米技术赛', '6000米耐力赛'),
  '入选运动员自行承担报名参赛相关费用',
  NULL,
  '本记录来源为中国运动员选拔办法公示，未披露正赛奖金或奖项设置。',
  NULL,
  '五星+',
  5.5,
  '亚洲',
  'none',
  '赛事信息来源：体育总局水上中心2026-04-28公示的《第二届亚洲桨板锦标赛中国运动员选拔办法》。本次仅录入赛事与中国运动员选拔信息，暂无成绩册、暂无积分。',
  JSON_ARRAY(JSON_OBJECT('title', @source_title, 'url', '')),
  JSON_OBJECT(
    'summary', '第二届亚洲桨板锦标赛将于2026年8月6日至8日在日本京都府京丹后市举行；中国运动员选拔由体育总局水上中心依据2026赛季中国桨板精英运动员竞技积分排名择优确定。',
    'source', JSON_OBJECT('title', @source_title, 'note', '公示时间：2026-04-28 至 2026-05-07'),
    'highlights', JSON_ARRAY(
      JSON_OBJECT('label', '赛事时间', 'value', '2026-08-06 至 2026-08-08', 'note', '正赛举办地为日本京都府京丹后市'),
      JSON_OBJECT('label', '赛事星级', 'value', '五星+ / 5.5', 'note', '亚洲级锦标赛，按亚洲高规格官方赛事口径记录'),
      JSON_OBJECT('label', '中国选拔依据', 'value', '2026赛季精英积分排名', 'note', '积分排名截止时间为2026-06-30'),
      JSON_OBJECT('label', '参选申请截止', 'value', '2026-05-20', 'note', '通过所在单位或俱乐部提交书面正式申请')
    ),
    'sections', JSON_ARRAY(
      JSON_OBJECT('title', '比赛项目', 'items', JSON_ARRAY(
        '100米冲刺赛',
        '800-1000米技术赛',
        '6000米耐力赛'
      )),
      JSON_OBJECT('title', '竞赛组别', 'items', JSON_ARRAY(
        'U18组',
        '公开组',
        '40+组',
        '50+组',
        '充气板组'
      )),
      JSON_OBJECT('title', '中国运动员选拔计划', 'items', JSON_ARRAY(
        'U18组：依据2026赛季青少年组积分排名，男/女各2名，冲刺赛和长距离赛各一人',
        '公开组：依据2026赛季公开组积分排名，男/女各2名，冲刺赛和长距离赛各一人',
        '40+组：依据2026赛季40+组积分排名，男/女各2名，冲刺赛和长距离赛各一人',
        '50+组：依据2026赛季50+组积分排名，男/女各2名，冲刺赛和长距离赛各一人',
        '充气板组：依据2026赛季公开组积分排名，男/女各2名，冲刺赛和长距离赛各一人'
      )),
      JSON_OBJECT('title', '报名材料与联系方式', 'items', JSON_ARRAY(
        '参选申请表、运动员身份证复印件、半年内近期体检证明',
        '报名邮箱：chinasup@sports.cn，邮件主题注明“第二届亚洲桨板锦标赛参选申请+单位/姓名”',
        '联系人：段培尧，电话：010-67113689',
        '监督举报邮箱：sszxjw2021@126.com'
      ))
    )
  ),
  'published',
  'upcoming'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  name_en = VALUES(name_en),
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
  event_guide = VALUES(event_guide),
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
  (@event_id, 'U18男子组-100米冲刺赛', '100米冲刺赛', 'U18男子组', NULL, NULL, NULL, NULL, NULL, 10),
  (@event_id, 'U18女子组-100米冲刺赛', '100米冲刺赛', 'U18女子组', NULL, NULL, NULL, NULL, NULL, 20),
  (@event_id, '公开男子组-100米冲刺赛', '100米冲刺赛', '公开男子组', NULL, NULL, NULL, NULL, NULL, 30),
  (@event_id, '公开女子组-100米冲刺赛', '100米冲刺赛', '公开女子组', NULL, NULL, NULL, NULL, NULL, 40),
  (@event_id, '40+男子组-100米冲刺赛', '100米冲刺赛', '40+男子组', NULL, NULL, NULL, NULL, NULL, 50),
  (@event_id, '40+女子组-100米冲刺赛', '100米冲刺赛', '40+女子组', NULL, NULL, NULL, NULL, NULL, 60),
  (@event_id, '50+男子组-100米冲刺赛', '100米冲刺赛', '50+男子组', NULL, NULL, NULL, NULL, NULL, 70),
  (@event_id, '50+女子组-100米冲刺赛', '100米冲刺赛', '50+女子组', NULL, NULL, NULL, NULL, NULL, 80),
  (@event_id, '充气板男子组-100米冲刺赛', '100米冲刺赛', '充气板男子组', '充气板', NULL, NULL, NULL, NULL, 90),
  (@event_id, '充气板女子组-100米冲刺赛', '100米冲刺赛', '充气板女子组', '充气板', NULL, NULL, NULL, NULL, 100),
  (@event_id, 'U18男子组-800-1000米技术赛', '800-1000米技术赛', 'U18男子组', NULL, NULL, NULL, NULL, NULL, 110),
  (@event_id, 'U18女子组-800-1000米技术赛', '800-1000米技术赛', 'U18女子组', NULL, NULL, NULL, NULL, NULL, 120),
  (@event_id, '公开男子组-800-1000米技术赛', '800-1000米技术赛', '公开男子组', NULL, NULL, NULL, NULL, NULL, 130),
  (@event_id, '公开女子组-800-1000米技术赛', '800-1000米技术赛', '公开女子组', NULL, NULL, NULL, NULL, NULL, 140),
  (@event_id, '40+男子组-800-1000米技术赛', '800-1000米技术赛', '40+男子组', NULL, NULL, NULL, NULL, NULL, 150),
  (@event_id, '40+女子组-800-1000米技术赛', '800-1000米技术赛', '40+女子组', NULL, NULL, NULL, NULL, NULL, 160),
  (@event_id, '50+男子组-800-1000米技术赛', '800-1000米技术赛', '50+男子组', NULL, NULL, NULL, NULL, NULL, 170),
  (@event_id, '50+女子组-800-1000米技术赛', '800-1000米技术赛', '50+女子组', NULL, NULL, NULL, NULL, NULL, 180),
  (@event_id, '充气板男子组-800-1000米技术赛', '800-1000米技术赛', '充气板男子组', '充气板', NULL, NULL, NULL, NULL, 190),
  (@event_id, '充气板女子组-800-1000米技术赛', '800-1000米技术赛', '充气板女子组', '充气板', NULL, NULL, NULL, NULL, 200),
  (@event_id, 'U18男子组-6000米耐力赛', '6000米耐力赛', 'U18男子组', NULL, NULL, NULL, NULL, NULL, 210),
  (@event_id, 'U18女子组-6000米耐力赛', '6000米耐力赛', 'U18女子组', NULL, NULL, NULL, NULL, NULL, 220),
  (@event_id, '公开男子组-6000米耐力赛', '6000米耐力赛', '公开男子组', NULL, NULL, NULL, NULL, NULL, 230),
  (@event_id, '公开女子组-6000米耐力赛', '6000米耐力赛', '公开女子组', NULL, NULL, NULL, NULL, NULL, 240),
  (@event_id, '40+男子组-6000米耐力赛', '6000米耐力赛', '40+男子组', NULL, NULL, NULL, NULL, NULL, 250),
  (@event_id, '40+女子组-6000米耐力赛', '6000米耐力赛', '40+女子组', NULL, NULL, NULL, NULL, NULL, 260),
  (@event_id, '50+男子组-6000米耐力赛', '6000米耐力赛', '50+男子组', NULL, NULL, NULL, NULL, NULL, 270),
  (@event_id, '50+女子组-6000米耐力赛', '6000米耐力赛', '50+女子组', NULL, NULL, NULL, NULL, NULL, 280),
  (@event_id, '充气板男子组-6000米耐力赛', '6000米耐力赛', '充气板男子组', '充气板', NULL, NULL, NULL, NULL, 290),
  (@event_id, '充气板女子组-6000米耐力赛', '6000米耐力赛', '充气板女子组', '充气板', NULL, NULL, NULL, NULL, 300);

COMMIT;

SELECT
  e.event_id,
  e.name,
  e.slug,
  e.start_date,
  e.end_date,
  e.registration_deadline,
  e.star_level,
  e.score_coefficient,
  e.source_scope,
  e.status,
  e.event_status,
  e.result_status,
  (SELECT COUNT(*) FROM sup_event_categories c WHERE c.event_id = e.event_id) AS category_count
FROM sup_events e
WHERE e.slug = @event_slug
LIMIT 1;
