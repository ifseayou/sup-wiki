USE sport_hacker;

START TRANSACTION;

SELECT event_id
INTO @poetry_event_id
FROM sup_events
WHERE slug = 'poetry-paddlers-sup-race-2025-test'
ORDER BY event_id ASC
LIMIT 1;

UPDATE sup_events
SET
  status = 'published',
  event_status = 'completed',
  result_status = 'extended_complete',
  source_scope = '测试数据',
  result_source_note = '测试用手工成绩和积分：古诗词人的桨板大赛，不代表真实赛事。',
  result_last_verified_at = NOW()
WHERE event_id = @poetry_event_id;

UPDATE sup_event_result_sources
SET
  parser_name = 'local-race-results-import',
  parser_status = 'imported',
  parser_note = '测试用手工数据：4 名古诗词人物参赛。为前台联调按公开成绩来源口径处理。',
  extracted_rows = 4,
  reviewed_rows = 4,
  imported_rows = 4,
  metadata = JSON_OBJECT(
    'source_kind', 'local_result_book',
    'is_fake_event', true,
    'is_test_fixture', true,
    'created_for', 'SUP Wiki public results and points testing'
  )
WHERE event_id = @poetry_event_id
  AND file_name = '古诗词人的桨板大赛测试成绩单';

SELECT source_id
INTO @poetry_source_id
FROM sup_event_result_sources
WHERE event_id = @poetry_event_id
  AND file_name = '古诗词人的桨板大赛测试成绩单'
ORDER BY source_id ASC
LIMIT 1;

SELECT athlete_id
INTO @libai_athlete_id
FROM sup_athletes
WHERE name = '李白'
ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC
LIMIT 1;

SELECT athlete_id
INTO @dufu_athlete_id
FROM sup_athletes
WHERE name = '杜甫'
ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC
LIMIT 1;

SELECT athlete_id
INTO @sushi_athlete_id
FROM sup_athletes
WHERE name = '苏轼'
ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC
LIMIT 1;

SELECT athlete_id
INTO @wanganshi_athlete_id
FROM sup_athletes
WHERE name = '王安石'
ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC
LIMIT 1;

INSERT INTO sup_event_point_standings (
  event_id,
  source_id,
  group_name,
  rank_position,
  status_rank,
  bib_number,
  athlete_id,
  athlete_name_snapshot,
  team_name,
  endurance_rank,
  endurance_points,
  sprint_rank,
  sprint_points,
  total_points,
  source_locator
) VALUES
(@poetry_event_id, @poetry_source_id, '公开男子组', 1, NULL, 'P001', @libai_athlete_id, '李白', '个人', '1', 60.00, '1', 40.00, 100.00, 'manual:test-points:1'),
(@poetry_event_id, @poetry_source_id, '公开男子组', 2, NULL, 'P002', @dufu_athlete_id, '杜甫', '个人', '2', 55.00, '2', 37.00, 92.00, 'manual:test-points:2'),
(@poetry_event_id, @poetry_source_id, '公开男子组', 3, NULL, 'P003', @sushi_athlete_id, '苏轼', '个人', '3', 50.00, '3', 36.00, 86.00, 'manual:test-points:3'),
(@poetry_event_id, @poetry_source_id, '公开男子组', 4, NULL, 'P004', @wanganshi_athlete_id, '王安石', '个人', '4', 46.00, '4', 34.00, 80.00, 'manual:test-points:4')
ON DUPLICATE KEY UPDATE
  source_id = VALUES(source_id),
  rank_position = VALUES(rank_position),
  status_rank = VALUES(status_rank),
  athlete_id = VALUES(athlete_id),
  team_name = VALUES(team_name),
  endurance_rank = VALUES(endurance_rank),
  endurance_points = VALUES(endurance_points),
  sprint_rank = VALUES(sprint_rank),
  sprint_points = VALUES(sprint_points),
  total_points = VALUES(total_points),
  source_locator = VALUES(source_locator);

INSERT INTO sup_annual_point_sources (
  source_key,
  year,
  point_scope,
  title,
  source_url,
  form_token,
  open_search_id,
  parser_name,
  sync_status,
  total_records,
  imported_records,
  group_counts,
  raw_config,
  error_message,
  last_synced_at
) VALUES (
  'poetry-paddlers-annual-points-2025-test',
  2025,
  'domestic',
  '古诗词人的桨板大赛测试积分榜',
  'https://sup.iaddu.cn/events/352',
  'poetry-paddlers-test',
  'poetry-paddlers-test',
  'manual-test-data',
  'imported',
  4,
  4,
  JSON_OBJECT('公开男子组', 4),
  JSON_OBJECT('is_fake_event', true, 'is_test_fixture', true, 'event_slug', 'poetry-paddlers-sup-race-2025-test'),
  NULL,
  NOW()
)
ON DUPLICATE KEY UPDATE
  year = VALUES(year),
  point_scope = VALUES(point_scope),
  title = VALUES(title),
  source_url = VALUES(source_url),
  form_token = VALUES(form_token),
  open_search_id = VALUES(open_search_id),
  parser_name = VALUES(parser_name),
  sync_status = VALUES(sync_status),
  total_records = VALUES(total_records),
  imported_records = VALUES(imported_records),
  group_counts = VALUES(group_counts),
  raw_config = VALUES(raw_config),
  error_message = VALUES(error_message),
  last_synced_at = VALUES(last_synced_at),
  source_id = LAST_INSERT_ID(source_id);

SET @annual_source_id = LAST_INSERT_ID();

INSERT INTO sup_annual_point_standings (
  source_id,
  year,
  group_code,
  group_name,
  rank_position,
  athlete_id,
  athlete_name_snapshot,
  team_name,
  team_name_normalized,
  total_points,
  endurance_points,
  sprint_points,
  technical_points,
  base_detail_text,
  adjustment_detail_text,
  source_record_id,
  source_token,
  raw_json,
  identity_link_id,
  match_status,
  match_confidence
) VALUES
(@annual_source_id, 2025, 'poetry_open_men', '公开男子组', 1, @libai_athlete_id, '李白', '个人', '个人', 100.000, 60.000, 40.000, 0.000, '古诗词人的桨板大赛测试积分：耐力 60，竞速 40。', NULL, 'poetry-paddlers-2025-libai', 'poetry-paddlers-test', JSON_OBJECT('is_fake_event', true, 'event_id', @poetry_event_id), NULL, 'confirmed', 0.950),
(@annual_source_id, 2025, 'poetry_open_men', '公开男子组', 2, @dufu_athlete_id, '杜甫', '个人', '个人', 92.000, 55.000, 37.000, 0.000, '古诗词人的桨板大赛测试积分：耐力 55，竞速 37。', NULL, 'poetry-paddlers-2025-dufu', 'poetry-paddlers-test', JSON_OBJECT('is_fake_event', true, 'event_id', @poetry_event_id), NULL, 'confirmed', 0.950),
(@annual_source_id, 2025, 'poetry_open_men', '公开男子组', 3, @sushi_athlete_id, '苏轼', '个人', '个人', 86.000, 50.000, 36.000, 0.000, '古诗词人的桨板大赛测试积分：耐力 50，竞速 36。', NULL, 'poetry-paddlers-2025-sushi', 'poetry-paddlers-test', JSON_OBJECT('is_fake_event', true, 'event_id', @poetry_event_id), NULL, 'confirmed', 0.950),
(@annual_source_id, 2025, 'poetry_open_men', '公开男子组', 4, @wanganshi_athlete_id, '王安石', '个人', '个人', 80.000, 46.000, 34.000, 0.000, '古诗词人的桨板大赛测试积分：耐力 46，竞速 34。', NULL, 'poetry-paddlers-2025-wanganshi', 'poetry-paddlers-test', JSON_OBJECT('is_fake_event', true, 'event_id', @poetry_event_id), NULL, 'confirmed', 0.950)
ON DUPLICATE KEY UPDATE
  year = VALUES(year),
  group_code = VALUES(group_code),
  group_name = VALUES(group_name),
  rank_position = VALUES(rank_position),
  athlete_id = VALUES(athlete_id),
  athlete_name_snapshot = VALUES(athlete_name_snapshot),
  team_name = VALUES(team_name),
  team_name_normalized = VALUES(team_name_normalized),
  total_points = VALUES(total_points),
  endurance_points = VALUES(endurance_points),
  sprint_points = VALUES(sprint_points),
  technical_points = VALUES(technical_points),
  base_detail_text = VALUES(base_detail_text),
  adjustment_detail_text = VALUES(adjustment_detail_text),
  source_token = VALUES(source_token),
  raw_json = VALUES(raw_json),
  identity_link_id = VALUES(identity_link_id),
  match_status = VALUES(match_status),
  match_confidence = VALUES(match_confidence);

DELETE b
FROM sup_annual_point_breakdowns b
INNER JOIN sup_annual_point_standings s ON s.standing_id = b.standing_id
WHERE s.source_id = @annual_source_id
  AND s.source_record_id IN (
    'poetry-paddlers-2025-libai',
    'poetry-paddlers-2025-dufu',
    'poetry-paddlers-2025-sushi',
    'poetry-paddlers-2025-wanganshi'
  );

INSERT INTO sup_annual_point_breakdowns (
  standing_id,
  detail_type,
  event_name,
  star_level,
  endurance_points,
  sprint_points,
  technical_points,
  raw_text
)
SELECT
  s.standing_id,
  'base',
  '古诗词人的桨板大赛',
  NULL,
  s.endurance_points,
  s.sprint_points,
  s.technical_points,
  CONCAT('测试积分明细：', s.athlete_name_snapshot, ' 总积分 ', s.total_points)
FROM sup_annual_point_standings s
WHERE s.source_id = @annual_source_id
  AND s.source_record_id IN (
    'poetry-paddlers-2025-libai',
    'poetry-paddlers-2025-dufu',
    'poetry-paddlers-2025-sushi',
    'poetry-paddlers-2025-wanganshi'
  );

COMMIT;

SELECT
  e.event_id,
  e.name,
  e.status,
  e.event_status,
  e.result_status,
  COUNT(DISTINCT er.result_id) AS result_count,
  COUNT(DISTINCT ps.standing_id) AS event_point_count
FROM sup_events e
LEFT JOIN sup_event_results er ON er.event_id = e.event_id
LEFT JOIN sup_event_point_standings ps ON ps.event_id = e.event_id
WHERE e.slug = 'poetry-paddlers-sup-race-2025-test'
GROUP BY e.event_id, e.name, e.status, e.event_status, e.result_status;

SELECT
  s.year,
  s.group_name,
  s.rank_position,
  s.athlete_name_snapshot,
  s.total_points,
  src.point_scope,
  src.title AS source_title
FROM sup_annual_point_standings s
INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
WHERE src.source_key = 'poetry-paddlers-annual-points-2025-test'
ORDER BY s.rank_position ASC;
