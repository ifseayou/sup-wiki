USE sport_hacker;

SET SESSION group_concat_max_len = 1000000;

START TRANSACTION;

INSERT INTO sup_events (
  name,
  slug,
  event_type,
  location,
  province,
  city,
  venue,
  start_date,
  end_date,
  organizer,
  description,
  requirements,
  disciplines,
  source_scope,
  result_status,
  result_source_note,
  result_source_links,
  result_last_verified_at,
  status,
  event_status
) VALUES (
  '古诗词人的桨板大赛',
  'poetry-paddlers-sup-race-2025-test',
  'race',
  '浙江省杭州市西湖测试水域',
  '浙江省',
  '杭州市',
  '西湖测试水域',
  '2025-10-01',
  '2025-10-01',
  'SUP Wiki 测试数据',
  '测试用伪造赛事：用于验证运动员、赛事和成绩展示链路，不代表真实比赛。',
  '测试数据，无真实报名要求。',
  JSON_ARRAY('200m桨板竞速赛'),
  '测试数据',
  'extended_complete',
  '测试用手工成绩单：古诗词人的桨板大赛。',
  JSON_ARRAY(JSON_OBJECT('title', '古诗词人的桨板大赛测试成绩单', 'url', '', 'type', 'manual_test')),
  NOW(),
  'draft',
  'completed'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  event_type = VALUES(event_type),
  location = VALUES(location),
  province = VALUES(province),
  city = VALUES(city),
  venue = VALUES(venue),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date),
  organizer = VALUES(organizer),
  description = VALUES(description),
  requirements = VALUES(requirements),
  disciplines = VALUES(disciplines),
  source_scope = VALUES(source_scope),
  result_status = VALUES(result_status),
  result_source_note = VALUES(result_source_note),
  result_source_links = VALUES(result_source_links),
  result_last_verified_at = VALUES(result_last_verified_at),
  status = VALUES(status),
  event_status = VALUES(event_status),
  event_id = LAST_INSERT_ID(event_id);

SET @poetry_event_id = LAST_INSERT_ID();

INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
SELECT names.name, '中国', 'race', '测试用伪造运动员档案：用于验证古诗词人的桨板大赛成绩链路。', 'draft'
FROM (
  SELECT '李白' AS name
  UNION ALL SELECT '杜甫'
  UNION ALL SELECT '苏轼'
  UNION ALL SELECT '王安石'
) AS names
WHERE NOT EXISTS (
  SELECT 1
  FROM sup_athletes a
  WHERE a.name = names.name
);

INSERT INTO sup_athlete_identity_links (
  athlete_id,
  normalized_name,
  display_name,
  gender_hint,
  team_hint,
  nationality_hint,
  confidence,
  status,
  note
)
SELECT
  a.athlete_id,
  LOWER(REPLACE(a.name, ' ', '')),
  a.name,
  '公开男子组',
  '个人',
  '中国',
  0.95,
  'confirmed',
  '测试赛事导入自动确认同名运动员'
FROM sup_athletes a
WHERE a.name IN ('李白', '杜甫', '苏轼', '王安石')
ON DUPLICATE KEY UPDATE
  athlete_id = VALUES(athlete_id),
  display_name = VALUES(display_name),
  gender_hint = VALUES(gender_hint),
  team_hint = VALUES(team_hint),
  nationality_hint = VALUES(nationality_hint),
  confidence = GREATEST(confidence, VALUES(confidence)),
  status = VALUES(status),
  note = VALUES(note);

INSERT INTO sup_event_result_sources (
  event_id,
  original_path,
  file_name,
  file_type,
  source_url,
  parser_name,
  parser_status,
  parser_note,
  extracted_rows,
  reviewed_rows,
  imported_rows,
  metadata
)
SELECT
  @poetry_event_id,
  NULL,
  '古诗词人的桨板大赛测试成绩单',
  'text',
  NULL,
  'manual-test-data',
  'imported',
  '测试用手工数据：4 名古诗词人物参赛。',
  4,
  4,
  4,
  JSON_OBJECT('source_kind', 'test_fixture', 'is_fake_event', true, 'created_for', 'SUP Wiki results testing')
WHERE NOT EXISTS (
  SELECT 1
  FROM sup_event_result_sources src
  WHERE src.event_id = @poetry_event_id
    AND src.file_name = '古诗词人的桨板大赛测试成绩单'
);

SELECT source_id
INTO @poetry_source_id
FROM sup_event_result_sources
WHERE event_id = @poetry_event_id
  AND file_name = '古诗词人的桨板大赛测试成绩单'
ORDER BY source_id ASC
LIMIT 1;

INSERT INTO sup_event_results (
  event_id,
  athlete_id,
  athlete_name_snapshot,
  bib_number,
  gender_group,
  discipline,
  board_class,
  round_label,
  rank_position,
  result_label,
  finish_time,
  result_status_code,
  result_status_note,
  time_seconds,
  points,
  team_name,
  team_name_normalized,
  nationality_snapshot,
  source_type,
  source_id,
  source_title,
  source_locator,
  source_url,
  source_note,
  parse_confidence,
  review_status,
  is_verified
) VALUES
(
  @poetry_event_id,
  (SELECT athlete_id FROM sup_athletes WHERE name = '李白' ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC LIMIT 1),
  '李白',
  'P001',
  '公开男子组',
  '200m桨板竞速赛',
  '硬板',
  '决赛',
  1,
  '冠军',
  '00:01:28',
  NULL,
  NULL,
  88,
  NULL,
  '个人',
  '个人',
  '中国',
  'manual',
  @poetry_source_id,
  '古诗词人的桨板大赛测试成绩单',
  'manual:test-row:1',
  NULL,
  '测试用伪造成绩。',
  1.000,
  'confirmed',
  1
),
(
  @poetry_event_id,
  (SELECT athlete_id FROM sup_athletes WHERE name = '杜甫' ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC LIMIT 1),
  '杜甫',
  'P002',
  '公开男子组',
  '200m桨板竞速赛',
  '硬板',
  '决赛',
  2,
  '亚军',
  '00:01:31',
  NULL,
  NULL,
  91,
  NULL,
  '个人',
  '个人',
  '中国',
  'manual',
  @poetry_source_id,
  '古诗词人的桨板大赛测试成绩单',
  'manual:test-row:2',
  NULL,
  '测试用伪造成绩。',
  1.000,
  'confirmed',
  1
),
(
  @poetry_event_id,
  (SELECT athlete_id FROM sup_athletes WHERE name = '苏轼' ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC LIMIT 1),
  '苏轼',
  'P003',
  '公开男子组',
  '200m桨板竞速赛',
  '硬板',
  '决赛',
  3,
  '季军',
  '00:01:35',
  NULL,
  NULL,
  95,
  NULL,
  '个人',
  '个人',
  '中国',
  'manual',
  @poetry_source_id,
  '古诗词人的桨板大赛测试成绩单',
  'manual:test-row:3',
  NULL,
  '测试用伪造成绩。',
  1.000,
  'confirmed',
  1
),
(
  @poetry_event_id,
  (SELECT athlete_id FROM sup_athletes WHERE name = '王安石' ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC LIMIT 1),
  '王安石',
  'P004',
  '公开男子组',
  '200m桨板竞速赛',
  '硬板',
  '决赛',
  4,
  '第4名',
  '00:01:39',
  NULL,
  NULL,
  99,
  NULL,
  '个人',
  '个人',
  '中国',
  'manual',
  @poetry_source_id,
  '古诗词人的桨板大赛测试成绩单',
  'manual:test-row:4',
  NULL,
  '测试用伪造成绩。',
  1.000,
  'confirmed',
  1
)
ON DUPLICATE KEY UPDATE
  athlete_id = VALUES(athlete_id),
  bib_number = VALUES(bib_number),
  board_class = VALUES(board_class),
  result_label = VALUES(result_label),
  finish_time = VALUES(finish_time),
  result_status_code = VALUES(result_status_code),
  result_status_note = VALUES(result_status_note),
  time_seconds = VALUES(time_seconds),
  points = VALUES(points),
  team_name = VALUES(team_name),
  team_name_normalized = VALUES(team_name_normalized),
  nationality_snapshot = VALUES(nationality_snapshot),
  source_type = VALUES(source_type),
  source_id = VALUES(source_id),
  source_title = VALUES(source_title),
  source_locator = VALUES(source_locator),
  source_url = VALUES(source_url),
  source_note = VALUES(source_note),
  parse_confidence = VALUES(parse_confidence),
  review_status = VALUES(review_status),
  is_verified = VALUES(is_verified);

UPDATE sup_athletes a
INNER JOIN (
  SELECT
    t.athlete_id,
    CONCAT(
      '[',
      GROUP_CONCAT(
        JSON_OBJECT(
          'distance', t.discipline,
          'year', t.event_year,
          'event', t.event_name,
          'event_id', t.event_id,
          'round', t.round_label,
          'result', t.result_label,
          'time', t.finish_time
        )
        ORDER BY t.start_date DESC, t.rank_position ASC
        SEPARATOR ','
      ),
      ']'
    ) AS race_times
  FROM (
    SELECT
      er.athlete_id,
      er.discipline,
      YEAR(e.start_date) AS event_year,
      e.name AS event_name,
      e.event_id,
      er.round_label,
      er.result_label,
      er.finish_time,
      e.start_date,
      er.rank_position
    FROM sup_event_results er
    INNER JOIN sup_events e ON e.event_id = er.event_id
    WHERE er.athlete_id IN (
      SELECT athlete_id
      FROM sup_athletes
      WHERE name IN ('李白', '杜甫', '苏轼', '王安石')
    )
      AND er.review_status = 'confirmed'
      AND er.is_verified = 1
  ) AS t
  GROUP BY t.athlete_id
) sync_data ON sync_data.athlete_id = a.athlete_id
SET a.race_times = sync_data.race_times;

COMMIT;

SELECT
  e.event_id,
  e.name,
  e.slug,
  e.status,
  e.event_status,
  e.result_status,
  COUNT(er.result_id) AS result_count
FROM sup_events e
LEFT JOIN sup_event_results er ON er.event_id = e.event_id
WHERE e.slug = 'poetry-paddlers-sup-race-2025-test'
GROUP BY e.event_id, e.name, e.slug, e.status, e.event_status, e.result_status;

SELECT
  er.rank_position,
  er.athlete_name_snapshot,
  er.finish_time,
  er.result_label,
  a.status AS athlete_status
FROM sup_event_results er
INNER JOIN sup_events e ON e.event_id = er.event_id
LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
WHERE e.slug = 'poetry-paddlers-sup-race-2025-test'
ORDER BY er.rank_position ASC;
