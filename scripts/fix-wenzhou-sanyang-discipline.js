#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  const env = { ...process.env };
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

async function syncAthleteRaceTimes(connection, athleteId) {
  const [rows] = await connection.execute(
    `SELECT DISTINCT er.discipline, er.round_label, er.result_label, er.finish_time,
            er.result_status_code, er.result_status_note, er.rank_position,
            e.start_date, e.event_id, e.name AS event_name
     FROM sup_event_results er
     INNER JOIN sup_events e ON e.event_id = er.event_id
     LEFT JOIN sup_event_result_members erm ON erm.result_id = er.result_id
     WHERE er.athlete_id = ? OR erm.athlete_id = ?
     ORDER BY e.start_date DESC, er.rank_position ASC`,
    [athleteId, athleteId]
  );
  const raceTimes = rows.map((row) => ({
    distance: row.discipline,
    year: row.start_date ? new Date(row.start_date).getFullYear() : undefined,
    event: row.event_name,
    event_id: row.event_id,
    round: row.round_label || undefined,
    result: row.result_label || undefined,
    time: row.finish_time,
    status: row.result_status_code || undefined,
    status_label: row.result_status_note || undefined,
  }));
  await connection.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
}

async function main() {
  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });

  try {
    const [badRows] = await connection.execute(
      `SELECT er.result_id, er.athlete_id, er.rank_position, er.bib_number,
              er.athlete_name_snapshot, er.discipline, er.gender_group
       FROM sup_event_results er
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       INNER JOIN sup_events e ON e.event_id = er.event_id
       WHERE src.file_name = '温州三垟湿地第二届桨板比赛成绩册.pdf'
         AND e.name LIKE '%温州三垟%'
         AND (
           er.discipline REGEXP '^[0-9]+[[:space:]][A-Z][0-9]+'
           OR er.discipline LIKE '%谢骁勇%'
           OR er.discipline LIKE '%杜挺%'
         )
       ORDER BY er.rank_position ASC`
    );

    const athleteIds = [...new Set(badRows.map((row) => Number(row.athlete_id)).filter(Number.isFinite))];
    if (badRows.length) {
      const ids = badRows.map((row) => row.result_id);
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE sup_event_results
         SET discipline = '6公里',
             gender_group = '男子组',
             parse_confidence = LEAST(parse_confidence, 0.720),
             source_note = TRIM(CONCAT(COALESCE(source_note, ''), ' 修复续页项目识别：原项目字段误取成绩行。'))
         WHERE result_id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      await connection.commit();
      for (const athleteId of athleteIds) await syncAthleteRaceTimes(connection, athleteId);
    }

    const [remaining] = await connection.execute(
      `SELECT COUNT(*) AS remaining
       FROM sup_event_results er
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       INNER JOIN sup_events e ON e.event_id = er.event_id
       WHERE src.file_name = '温州三垟湿地第二届桨板比赛成绩册.pdf'
         AND e.name LIKE '%温州三垟%'
         AND er.discipline REGEXP '^[0-9]+[[:space:]][A-Z][0-9]+'`
    );

    console.log(JSON.stringify({
      fixed: badRows.length,
      syncedAthletes: athleteIds.length,
      examples: badRows.slice(0, 8),
      remaining: Number(remaining[0]?.remaining || 0),
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
