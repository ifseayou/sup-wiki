USE sport_hacker;

DELETE FROM sup_event_results
WHERE event_id = 11
  AND athlete_name_snapshot = '钟梓进'
  AND gender_group = '精英组男子公开组'
  AND discipline = '200米竞速赛'
  AND rank_position = 1;

INSERT INTO sup_event_results (
  event_id, athlete_id, athlete_name_snapshot, gender_group, discipline, round_label,
  rank_position, result_label, finish_time, time_seconds, team_name, nationality_snapshot,
  source_type, source_title, source_url, source_note, is_verified
) VALUES
(
  11,
  (SELECT athlete_id FROM sup_athletes WHERE name = '钟梓进' AND status = 'published' ORDER BY athlete_id ASC LIMIT 1),
  '钟梓进', '精英组男子公开组', '200米竞速赛', '决赛',
  1, '冠军', '待补充', NULL, '集美大学', '中国',
  'official', '百余名桨板健儿逐浪永泰赤锡库湾', 'https://www.fuzhou.gov.cn/zwgk/gzdt/rcyw/202604/t20260419_5310339.htm', '福州市人民政府门户网站2026年4月19日稿件回顾性明确披露：钟梓进在去年的亚洲杯桨板赛上获得精英组200米男子公开组第一名。原始赛后成绩单仍待补采，当前先录入该官方旁证。', 1
);

UPDATE sup_events
SET
  result_status = 'partial',
  result_source_note = '当前已录入青田侨报官方稿与 PDF 中明确披露的精英组冠军信息，并补录福州市人民政府官方稿回顾性确认的钟梓进200米冠军；完整前十与耗时仍待补采官方成绩单。',
  result_source_links = JSON_ARRAY(
    JSON_OBJECT('title', '2025年桨板亚洲杯暨中国桨板嘉年华圆满收官', 'url', 'https://bz.zgqt.zj.cn/qtqb/pc/content/202507/16/content_563683.html'),
    JSON_OBJECT('title', '2025年7月14日星期一', 'url', 'https://bz.zgqt.zj.cn/qtqb/pc/att/202507/14/d8ca2c6f-2e07-4c5a-ac0f-45dbe35d6bbb.pdf'),
    JSON_OBJECT('title', '百余名桨板健儿逐浪永泰赤锡库湾', 'url', 'https://www.fuzhou.gov.cn/zwgk/gzdt/rcyw/202604/t20260419_5310339.htm')
  ),
  result_last_verified_at = CURRENT_TIMESTAMP
WHERE event_id = 11;
