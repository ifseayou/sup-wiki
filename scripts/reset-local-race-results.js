#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const LOCAL_RESULT_SOURCE_FILTER = `(
  src.parser_name IN ('parse-race-results.py', 'local-race-results-import')
  OR src.original_path LIKE '%/桨板赛事/%'
  OR src.original_path LIKE '%/桨板比赛成绩/%'
)`;

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

async function main() {
  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
    multipleStatements: true,
  });

  try {
    await connection.beginTransaction();
    await connection.execute('DROP TEMPORARY TABLE IF EXISTS tmp_local_result_events');
    await connection.execute('DROP TEMPORARY TABLE IF EXISTS tmp_local_result_athletes');
    await connection.execute(`
      CREATE TEMPORARY TABLE tmp_local_result_events AS
      SELECT DISTINCT src.event_id
      FROM sup_event_result_sources src
      WHERE ${LOCAL_RESULT_SOURCE_FILTER}
    `);
    await connection.execute(`
      CREATE TEMPORARY TABLE tmp_local_result_athletes AS
      SELECT DISTINCT er.athlete_id
      FROM sup_event_results er
      INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
      WHERE er.athlete_id IS NOT NULL AND ${LOCAL_RESULT_SOURCE_FILTER}
      UNION
      SELECT DISTINCT erm.athlete_id
      FROM sup_event_result_members erm
      INNER JOIN sup_event_results er ON er.result_id = erm.result_id
      INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
      WHERE erm.athlete_id IS NOT NULL AND ${LOCAL_RESULT_SOURCE_FILTER}
    `);

    const [before] = await connection.execute(`
      SELECT
        (SELECT COUNT(*) FROM sup_event_results er INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id WHERE ${LOCAL_RESULT_SOURCE_FILTER}) AS results_count,
        (SELECT COUNT(*) FROM sup_event_result_sources src WHERE ${LOCAL_RESULT_SOURCE_FILTER}) AS sources_count,
        (SELECT COUNT(*) FROM tmp_local_result_athletes) AS athletes_count
    `);

    await connection.execute(`
      DELETE er
      FROM sup_event_results er
      INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
      WHERE ${LOCAL_RESULT_SOURCE_FILTER}
    `);
    await connection.execute(`DELETE src FROM sup_event_result_sources src WHERE ${LOCAL_RESULT_SOURCE_FILTER}`);
    await connection.execute(`
      DELETE e
      FROM sup_events e
      INNER JOIN tmp_local_result_events le ON le.event_id = e.event_id
      LEFT JOIN sup_event_results er ON er.event_id = e.event_id
      LEFT JOIN sup_event_result_sources src ON src.event_id = e.event_id
      WHERE er.result_id IS NULL
        AND src.source_id IS NULL
        AND (e.source_scope = '本地成绩册导入' OR e.result_source_note IS NOT NULL)
    `);
    await connection.execute(`
      UPDATE sup_athletes
      SET race_times = JSON_ARRAY()
      WHERE athlete_id IN (SELECT athlete_id FROM tmp_local_result_athletes)
    `);

    await connection.commit();
    console.log(JSON.stringify(before[0], null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
