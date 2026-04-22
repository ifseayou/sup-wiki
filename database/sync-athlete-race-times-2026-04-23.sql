USE sport_hacker;

SET SESSION group_concat_max_len = 1000000;

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
    WHERE er.athlete_id IS NOT NULL
  ) AS t
  GROUP BY t.athlete_id
) sync_data ON sync_data.athlete_id = a.athlete_id
SET a.race_times = sync_data.race_times;
