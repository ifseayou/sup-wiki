USE sport_hacker;

-- 第一批赛事成绩采集（官方优先 + 高可信媒体补充）
-- 说明：
-- 1. 当前先录入已能核验到的冠军/前三名单
-- 2. 对未公开耗时的结果，finish_time 先标记为“待补充”
-- 3. 仅对已发布运动员建立公开关联；未发布或不存在者先建草稿档案，但结果不直接挂公开 athlete_id

INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
SELECT names.name, '中国', 'race', '由赛事成绩录入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft'
FROM (
  SELECT '韦智馨' AS name UNION ALL
  SELECT '黄昊' UNION ALL
  SELECT '李骏垚' UNION ALL
  SELECT '余芃雨' UNION ALL
  SELECT '黄榉诺' UNION ALL
  SELECT '胡伊一' UNION ALL
  SELECT '张云皓' UNION ALL
  SELECT '王安翼' UNION ALL
  SELECT '王晟嘉' UNION ALL
  SELECT '张元' UNION ALL
  SELECT '王彤谣' UNION ALL
  SELECT '赵江宁' UNION ALL
  SELECT '朱祥旭' UNION ALL
  SELECT '张云翔' UNION ALL
  SELECT '秦昌凯' UNION ALL
  SELECT '林珈羽' UNION ALL
  SELECT '张晚雨' UNION ALL
  SELECT '雷镇宇' UNION ALL
  SELECT '吴泓逸' UNION ALL
  SELECT '王荣煊' UNION ALL
  SELECT '劳嘉俊' UNION ALL
  SELECT '王彬' UNION ALL
  SELECT '许巍磊' UNION ALL
  SELECT '李伟' UNION ALL
  SELECT '刘敏仪' UNION ALL
  SELECT '谭惠娟' UNION ALL
  SELECT '陶春波' UNION ALL
  SELECT '黄广谦' UNION ALL
  SELECT '陈威' UNION ALL
  SELECT '梁建兴' UNION ALL
  SELECT '谢玲辉' UNION ALL
  SELECT '郑丽君' UNION ALL
  SELECT '吴俊' UNION ALL
  SELECT '邓师节' UNION ALL
  SELECT '何昊殷' UNION ALL
  SELECT '马泽港' UNION ALL
  SELECT '关晓燕' UNION ALL
  SELECT '林娟' UNION ALL
  SELECT '刘洁' UNION ALL
  SELECT '肖森予' UNION ALL
  SELECT '冯子华' UNION ALL
  SELECT '黄东波' UNION ALL
  SELECT '秦著华' UNION ALL
  SELECT '陈诗思' UNION ALL
  SELECT '林凤' UNION ALL
  SELECT '马翎儿' UNION ALL
  SELECT '胡培凡' UNION ALL
  SELECT '郭乐闻' UNION ALL
  SELECT '思文慧' UNION ALL
  SELECT '冉昊瞳' UNION ALL
  SELECT '王昕' UNION ALL
  SELECT '游正礼' UNION ALL
  SELECT '胡先福' UNION ALL
  SELECT '余常利' UNION ALL
  SELECT '傅文涛' UNION ALL
  SELECT '钟梓进' UNION ALL
  SELECT '严含燕' UNION ALL
  SELECT '银勇' UNION ALL
  SELECT '伍玉凤' UNION ALL
  SELECT '靖小鱼' UNION ALL
  SELECT '刘思涵'
) AS names
WHERE NOT EXISTS (
  SELECT 1 FROM sup_athletes a WHERE a.name = names.name
);

DELETE FROM sup_event_results WHERE event_id IN (12, 13, 14);

-- 石嘴山站：根据中新网稿件录入已明确披露的长距离冠军
INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(
  12,
  (SELECT athlete_id FROM sup_athletes WHERE name = '叶贵桐' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '叶贵桐', '精英组男子', '6公里长距离技巧赛', '长距离赛',
  1, '冠军', '待补充', NULL, 'Starboard俱乐部', '中国',
  'media', '2025年中国桨板精英赛石嘴山站启幕 近300名选手竞逐', 'https://www.chinanews.com.cn/ty/2025/07-19/10450661.shtml', '中新网稿件明确披露冠军姓名，未公开耗时。', 1
),
(
  12,
  (SELECT athlete_id FROM sup_athletes WHERE name = '徐浩婷' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '徐浩婷', '精英组女子', '6公里长距离技巧赛', '长距离赛',
  1, '冠军', '待补充', NULL, 'Starboard俱乐部', '中国',
  'media', '2025年中国桨板精英赛石嘴山站启幕 近300名选手竞逐', 'https://www.chinanews.com.cn/ty/2025/07-19/10450661.shtml', '中新网稿件明确披露冠军姓名，未公开耗时。', 1
),
(
  12,
  NULL,
  '靖小鱼', 'U9男子组', '3公里长距离技巧赛', '长距离赛',
  1, '冠军', '待补充', NULL, '做客户外俱乐部', '中国',
  'media', '2025年中国桨板精英赛石嘴山站启幕 近300名选手竞逐', 'https://www.chinanews.com.cn/ty/2025/07-19/10450661.shtml', '中新网稿件明确披露冠军姓名，未公开耗时。', 1
),
(
  12,
  NULL,
  '刘思涵', 'U9女子组', '3公里长距离技巧赛', '长距离赛',
  1, '冠军', '待补充', NULL, '银川市翔龙皮划艇运动协会', '中国',
  'media', '2025年中国桨板精英赛石嘴山站启幕 近300名选手竞逐', 'https://www.chinanews.com.cn/ty/2025/07-19/10450661.shtml', '中新网稿件明确披露冠军姓名，未公开耗时。', 1
);

-- 海口站：根据新浪海南转载稿录入公开披露的冠亚季军
INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(13, NULL, '韦智馨', 'U9男子组', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '黄昊', 'U9男子组', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '李骏垚', 'U9男子组', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '余芃雨', 'U9女子组', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '黄榉诺', 'U9女子组', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '胡伊一', 'U9女子组', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '张云皓', 'U12男子组', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '王安翼', 'U12男子组', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '王晟嘉', 'U12男子组', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '张元', 'U12女子组', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '王彤谣', 'U12女子组', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '赵江宁', 'U12女子组', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '朱祥旭', 'U15男子组', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '张云翔', 'U15男子组', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '秦昌凯', 'U15男子组', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '林珈羽', 'U15女子组', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '张晚雨', 'U15女子组', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '雷镇宇', 'U15女子组', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '吴泓逸', '青少年男子组', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '王荣煊', '青少年男子组', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '劳嘉俊', '青少年男子组', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '王彬', '大师组男子', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '许巍磊', '大师组男子', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '李伟', '大师组男子', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '刘敏仪', '大师组女子', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '谭惠娟', '大师组女子', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '陶春波', '大师组女子', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '黄广谦', '卡胡纳组男子', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '陈威', '卡胡纳组男子', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '梁建兴', '卡胡纳组男子', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '谢玲辉', '卡胡纳组女子', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '郑丽君', '卡胡纳组女子', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '吴俊', '卡胡纳组女子', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '邓师节', '公开组男子', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '何昊殷', '公开组男子', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '马泽港', '公开组男子', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '关晓燕', '公开组女子', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '林娟', '公开组女子', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '刘洁', '公开组女子', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '肖森予', '精英组男子', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '冯子华', '精英组男子', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '黄东波', '精英组男子', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '秦著华', '精英组女子', '综合排名', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '陈诗思', '精英组女子', '综合排名', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '林凤', '精英组女子', '综合排名', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '黄衫人桨板俱乐部', '龙板家庭组', '家庭组龙板赛', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '鑫锦丽鸭六六一队', '龙板家庭组', '家庭组龙板赛', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '阳光能量基地', '龙板家庭组', '家庭组龙板赛', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '立航体育', '龙板混合组', '混合组龙板赛', '总成绩', 1, '冠军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '博铌斯精彩不止镜战队', '龙板混合组', '混合组龙板赛', '总成绩', 2, '亚军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1),
(13, NULL, '波霸吴敌队', '龙板混合组', '混合组龙板赛', '总成绩', 3, '季军', '待补充', NULL, NULL, '中国', 'media', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html', '新浪海南稿件公布冠亚季军名单，未公开耗时。', 1);

-- 邵阳站：地方政府稿件 + 体育总局稿件，先录入明确披露的冠军
INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(14, (SELECT athlete_id FROM sup_athletes WHERE name = '叶贵桐' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1), '叶贵桐', '硬板公开组男子', '10km耐力赛', '决赛', 1, '冠军', '待补充', NULL, 'starboard', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, (SELECT athlete_id FROM sup_athletes WHERE name = '徐浩婷' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1), '徐浩婷', '硬板公开组女子', '10km耐力赛', '决赛', 1, '冠军', '待补充', NULL, 'starboard', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '马翎儿', 'U9女子组', '200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '武汉市汉阳区游泳和水上运动协会', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '胡培凡', 'U9男子组', '200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '义桨纵横', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '郭乐闻', 'U12男子组', '200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '湖北京山市桨板皮划艇协会', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '思文慧', 'U12女子组', '200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '赤壁市陆水湖桨板运动俱乐部', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '冉昊瞳', 'U15男子组', '200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '铜仁市乐水水上运动俱乐部', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '王昕', 'U15女子组', '200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '中山市绿色户外运动拓展有限公司', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, (SELECT athlete_id FROM sup_athletes WHERE name = '何博乐' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1), '何博乐', '高校组男子', '充气板200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '集美大学', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '李晓红', '高校组女子', '充气板200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '武汉体育学院', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '游正礼', '卡胡纳组男子', '充气板200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '格兰德智能科技', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '胡先福', '卡胡纳组女子', '充气板200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '武汉市汉阳区游泳和水上运动协会', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '余常利', '大师组男子', '充气板200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '艋拓桨板运动促进中心', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '傅文涛', '大师组女子', '充气板200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, NULL, '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '钟梓进', '公开组男子', '充气板200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '九凤王', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '严含燕', '公开组女子', '充气板200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '武汉市汉阳区游泳和水上运动协会', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '银勇', '职工组男子', '200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '县人民医院', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '伍玉凤', '职工组女子', '200m冲刺赛', '决赛', 1, '冠军', '待补充', NULL, '县人民医院', '中国', 'official', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml', '邵阳县人民政府稿件明确披露冠军姓名，未公开耗时。', 1),
(14, NULL, '钟梓进 / 徐浩婷', '团体赛', '混合双人竞速赛', '决赛', 1, '冠军', '待补充', NULL, NULL, '中国', 'official', '中国桨板超级联赛邵阳收桨', 'https://www.sport.gov.cn/n20001280/n20067662/n20067613/c29024639/content.html', '国家体育总局稿件明确披露团体冠军组合，未公开耗时。', 1),
(14, NULL, '徐居涛 / 符琳 / 徐高睿', '团体赛', '家庭三人竞速赛', '决赛', 1, '冠军', '待补充', NULL, NULL, '中国', 'official', '中国桨板超级联赛邵阳收桨', 'https://www.sport.gov.cn/n20001280/n20067662/n20067613/c29024639/content.html', '国家体育总局稿件明确披露团体冠军组合，未公开耗时。', 1),
(14, NULL, '蒋余龙 / 叶贵桐 / 傅文涛 / 陈建宇', '团体赛', '混合四人竞速赛', '决赛', 1, '冠军', '待补充', NULL, NULL, '中国', 'official', '中国桨板超级联赛邵阳收桨', 'https://www.sport.gov.cn/n20001280/n20067662/n20067613/c29024639/content.html', '国家体育总局稿件明确披露团体冠军组合，未公开耗时。', 1);

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入官方或高可信媒体稿件中明确披露的冠军/前三名单；公开成绩单中的完整名次与耗时仍在持续补采。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '2025年中国桨板精英赛石嘴山站启幕 近300名选手竞逐', 'url', 'https://www.chinanews.com.cn/ty/2025/07-19/10450661.shtml')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 12;

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入新浪海南稿件公开披露的冠亚季军名单；各小项完整成绩与耗时仍待补采官方成绩单。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '2025全国桨板冠军赛暨青少年U系列赛（海口站）圆满落幕 冠军揭晓', 'url', 'https://m.tech.china.com/digi/articles/20250901/202509011723804.html')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 13;

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入邵阳县人民政府与国家体育总局稿件中明确披露的冠军名单；完整成绩与耗时仍待补采官方成绩单。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '2025年中国桨板超级联赛暨第四届天子湖桨板公开赛圆满落幕', 'url', 'https://www.syx.gov.cn/syx/tpxwn/202509/d564571af601409780eee356d105f720.shtml'),
    JSON_OBJECT('title', '中国桨板超级联赛邵阳收桨', 'url', 'https://www.sport.gov.cn/n20001280/n20067662/n20067613/c29024639/content.html')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 14;
