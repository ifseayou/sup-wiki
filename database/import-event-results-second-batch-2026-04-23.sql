USE sport_hacker;

-- 第二批赛事成绩采集（官方来源）
-- 当前先录入已可核验的冠军信息，完整前10与耗时继续补采。

INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
SELECT names.name, '中国', 'race', '由赛事成绩录入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft'
FROM (
  SELECT '高铭轩' AS name UNION ALL
  SELECT '甘艳枝'
) AS names
WHERE NOT EXISTS (
  SELECT 1 FROM sup_athletes a WHERE a.name = names.name
);

DELETE FROM sup_event_results WHERE event_id IN (9, 11);

-- 三门峡站：国家体育总局水上运动管理中心稿件
INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '叶贵桐' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '叶贵桐', '公开组男子', '个人赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露冠军名单，未公开耗时。', 1
),
(
  9,
  (SELECT athlete_id FROM sup_athletes WHERE name = '徐浩婷' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '徐浩婷', '公开组女子', '个人赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露冠军名单，未公开耗时。', 1
),
(
  9,
  NULL,
  '余常利', '大师组男子', '个人赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露冠军名单，未公开耗时。', 1
),
(
  9,
  NULL,
  '傅文涛', '大师组女子', '个人赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露冠军名单，未公开耗时。', 1
),
(
  9,
  NULL,
  '黄广谦', '卡胡纳组男子', '个人赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露冠军名单，未公开耗时。', 1
),
(
  9,
  NULL,
  '甘艳枝', '卡胡纳组女子', '个人赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露冠军名单，未公开耗时。', 1
),
(
  9,
  NULL,
  '九凤王', '龙板赛', '四人龙板赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露龙板冠军，未公开耗时。', 1
),
(
  9,
  NULL,
  '汉阳水协2队', '龙板赛', '男女混合双人龙板赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露龙板冠军，未公开耗时。', 1
),
(
  9,
  NULL,
  '维特拉体育', '龙板赛', '家庭三人龙板赛', '总成绩',
  1, '冠军', '待补充', NULL, NULL, '中国',
  'official', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html', '国家体育总局水上运动管理中心稿件明确披露龙板冠军，未公开耗时。', 1
);

-- 青田站：青田侨报官方稿 + PDF 版
INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(
  11,
  NULL,
  '高铭轩', '精英组男子', '6KM长距离赛', '决赛',
  1, '冠军', '待补充', NULL, '上海', '中国',
  'official', '2025年7月14日星期一', 'https://bz.zgqt.zj.cn/qtqb/pc/att/202507/14/d8ca2c6f-2e07-4c5a-ac0f-45dbe35d6bbb.pdf', '青田侨报 PDF 明确披露精英组男子6KM长距离赛冠军，未公开耗时。', 1
),
(
  11,
  (SELECT athlete_id FROM sup_athletes WHERE name = '徐浩婷' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '徐浩婷', '精英组女子', '200米竞速赛', '决赛',
  1, '冠军', '待补充', NULL, '江西南昌', '中国',
  'official', '2025年桨板亚洲杯暨中国桨板嘉年华圆满收官', 'https://bz.zgqt.zj.cn/qtqb/pc/content/202507/16/content_563683.html', '青田侨报官方稿明确披露徐浩婷在200米、1公里、6公里项目均获第一名，未公开耗时。', 1
),
(
  11,
  (SELECT athlete_id FROM sup_athletes WHERE name = '徐浩婷' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '徐浩婷', '精英组女子', '1公里技巧赛', '决赛',
  1, '冠军', '待补充', NULL, '江西南昌', '中国',
  'official', '2025年桨板亚洲杯暨中国桨板嘉年华圆满收官', 'https://bz.zgqt.zj.cn/qtqb/pc/content/202507/16/content_563683.html', '青田侨报官方稿明确披露徐浩婷在200米、1公里、6公里项目均获第一名，未公开耗时。', 1
),
(
  11,
  (SELECT athlete_id FROM sup_athletes WHERE name = '徐浩婷' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '徐浩婷', '精英组女子', '6公里耐力赛', '决赛',
  1, '冠军', '待补充', NULL, '江西南昌', '中国',
  'official', '2025年桨板亚洲杯暨中国桨板嘉年华圆满收官', 'https://bz.zgqt.zj.cn/qtqb/pc/content/202507/16/content_563683.html', '青田侨报官方稿明确披露徐浩婷在200米、1公里、6公里项目均获第一名，未公开耗时。', 1
);

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入国家体育总局水上运动管理中心稿件中明确披露的个人赛与龙板赛冠军；完整名次与耗时仍待补采官方成绩单。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '中流砥柱 幸福黄河 2025年首站桨板超级联赛圆满落幕三门峡', 'url', 'https://www.sport.gov.cn/sszx/n5206/c28729626/content.html')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 9;

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入青田侨报官方稿与 PDF 中明确披露的精英组冠军信息；完整前十与耗时仍待补采官方成绩单。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '2025年桨板亚洲杯暨中国桨板嘉年华圆满收官', 'url', 'https://bz.zgqt.zj.cn/qtqb/pc/content/202507/16/content_563683.html'),
    JSON_OBJECT('title', '2025年7月14日星期一', 'url', 'https://bz.zgqt.zj.cn/qtqb/pc/att/202507/14/d8ca2c6f-2e07-4c5a-ac0f-45dbe35d6bbb.pdf')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 11;
