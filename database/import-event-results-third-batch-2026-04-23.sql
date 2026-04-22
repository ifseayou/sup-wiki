USE sport_hacker;

-- 第三批赛事成绩采集（官方 + 高可信赛事回顾）
-- 说明：
-- 1. 仅补录当前已能明确核验的细分名次与精确耗时
-- 2. 与官方冠军名单冲突的内容暂不写入，避免事实冲突
-- 3. 仅对已发布运动员建立公开关联；草稿运动员仍保留快照姓名

INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
SELECT names.name, '中国', 'race', '由赛事成绩录入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft'
FROM (
  SELECT '朱逸雯' AS name
) AS names
WHERE NOT EXISTS (
  SELECT 1 FROM sup_athletes a WHERE a.name = names.name
);

DELETE FROM sup_event_results
WHERE source_url IN (
  'https://m.waterlivesports.com/h-nd-114.html',
  'https://m.waterlivesports.com/h-nd-117.html',
  'https://m.waterlivesports.com/h-nd-331.html',
  'https://m.waterlivesports.com/h-nd-387.html'
);

DELETE FROM sup_event_results
WHERE event_id = 17
  AND athlete_name_snapshot = '林小新'
  AND gender_group = '女子硬板公开组'
  AND discipline = '长距离耐力赛'
  AND round_label = '决赛'
  AND rank_position = 1;

-- 三门峡站：WATER LIVE 赛事回顾补录细分名次
INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '陈澄灏' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '陈澄灏', '公开组男子', '长距离赛', '决赛',
  2, '亚军', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露陈澄灏在男子公开组长距离赛、200米、1000米和总积分的分项名次，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '陈澄灏' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '陈澄灏', '公开组男子', '200米竞速赛', '决赛',
  3, '季军', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露陈澄灏在男子公开组长距离赛、200米、1000米和总积分的分项名次，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '陈澄灏' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '陈澄灏', '公开组男子', '1000米技巧赛', '决赛',
  2, '亚军', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露陈澄灏在男子公开组长距离赛、200米、1000米和总积分的分项名次，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '陈澄灏' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '陈澄灏', '公开组男子', '综合积分', '总成绩',
  3, '季军', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露陈澄灏在男子公开组长距离赛、200米、1000米和总积分的分项名次，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '施必江' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '施必江', '公开组男子', '长距离赛', '决赛',
  4, '第4名', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露施必江在男子公开组长距离赛、200米、1000米和总积分的分项名次，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '施必江' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '施必江', '公开组男子', '200米竞速赛', '决赛',
  4, '第4名', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露施必江在男子公开组长距离赛、200米、1000米和总积分的分项名次，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '施必江' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '施必江', '公开组男子', '1000米技巧赛', '决赛',
  4, '第4名', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露施必江在男子公开组长距离赛、200米、1000米和总积分的分项名次，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '施必江' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '施必江', '公开组男子', '综合积分', '总成绩',
  4, '第4名', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露施必江在男子公开组长距离赛、200米、1000米和总积分的分项名次，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '李超' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '李超', '高校组男子', '个人赛', '总成绩',
  2, '亚军', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露李超获得高校男子组亚军，未公开耗时。', 1
),
(
  9,
  NULL,
  '朱逸雯', '公开组女子', '个人赛', '总成绩',
  3, '季军', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露朱逸雯获得女子公开组季军，未公开耗时。', 1
),
(
  9,
  NULL,
  '谢玲辉', '卡胡纳组女子', '个人赛', '总成绩',
  3, '季军', '待补充', NULL, NULL, '中国',
  'media', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'https://m.waterlivesports.com/h-nd-114.html', 'WATER LIVE 赛事回顾明确披露谢玲辉获得女子卡胡纳组季军，未公开耗时。', 1
);

-- 邵阳站：WATER LIVE 赛事回顾补录精确耗时
INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(
  14,
  (SELECT athlete_id FROM sup_athletes WHERE name = '陈澄灏' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '陈澄灏', '男子硬板公开组', '10km长距离耐力赛', '决赛',
  2, '亚军', '54:08.753', 3248.753, NULL, '中国',
  'media', '赛事回顾｜2025年中国桨板超级联赛暨第四届天子湖桨板公开赛', 'https://m.waterlivesports.com/h-nd-117.html', 'WATER LIVE 赛事回顾明确披露陈澄灏在男子硬板公开组10km长距离耐力赛获得亚军，成绩54:08.753。', 1
),
(
  14,
  (SELECT athlete_id FROM sup_athletes WHERE name = '施必江' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '施必江', '男子硬板公开组', '10km长距离耐力赛', '决赛',
  3, '季军', '54:56.756', 3296.756, NULL, '中国',
  'media', '赛事回顾｜2025年中国桨板超级联赛暨第四届天子湖桨板公开赛', 'https://m.waterlivesports.com/h-nd-117.html', 'WATER LIVE 赛事回顾明确披露施必江在男子硬板公开组10km长距离耐力赛获得季军，成绩54:56.756。', 1
),
(
  14,
  (SELECT athlete_id FROM sup_athletes WHERE name = '陈澄灏' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '陈澄灏', '男子硬板公开组', '200m冲刺赛', '决赛',
  2, '亚军', '51.856', 51.856, NULL, '中国',
  'media', '赛事回顾｜2025年中国桨板超级联赛暨第四届天子湖桨板公开赛', 'https://m.waterlivesports.com/h-nd-117.html', 'WATER LIVE 赛事回顾明确披露陈澄灏在男子硬板公开组200m冲刺赛获得亚军，成绩51.856。', 1
);

-- 常熟站：常熟新闻网官方稿补录已明确披露的冠军
INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(
  17,
  (SELECT athlete_id FROM sup_athletes WHERE name = '林小新' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '林小新', '女子硬板公开组', '长距离耐力赛', '决赛',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '共享水上运动速度与激情 尚湖杯2025全国桨板冠军赛总决赛暨全国桨板U系列赛（常熟站）举行', 'https://www.csxww.com/local_news/739843041804357.html', '常熟新闻网官方稿明确披露林小新获得女子硬板公开组长距离耐力赛冠军，未公开耗时。', 1
);

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入国家体育总局水上运动管理中心稿件中的冠军信息，以及 WATER LIVE 赛事回顾中明确披露的男子公开组细分名次；完整前十与耗时仍待补采。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'url', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html'),
    JSON_OBJECT('title', '赛事回顾｜2025中国桨板超级联赛(三门峡站)', 'url', 'https://m.waterlivesports.com/h-nd-114.html')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 9;

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入官方稿件中的冠军名单，以及 WATER LIVE 赛事回顾中明确披露的男子硬板公开组部分精确耗时；完整成绩单仍待补采。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'url', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml'),
    JSON_OBJECT('title', '中国桨板超级联赛邵阳收桨', 'url', 'https://www.sport.gov.cn/n20001280/n20067662/n20067613/c29024639/content.html'),
    JSON_OBJECT('title', '赛事回顾｜2025年中国桨板超级联赛暨第四届天子湖桨板公开赛', 'url', 'https://m.waterlivesports.com/h-nd-117.html')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 14;

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入常熟新闻网官方稿明确披露的女子硬板公开组冠军；其它组别名次与耗时仍待补采。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '共享水上运动速度与激情 尚湖杯2025全国桨板冠军赛总决赛暨全国桨板U系列赛（常熟站）举行', 'url', 'https://www.csxww.com/local_news/739843041804357.html')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 17;
