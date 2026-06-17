#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  const envPath = path.join(repoRoot, '.env.local');
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

function connectionConfig(env) {
  return {
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  };
}

async function query(conn, sql) {
  const [rows] = await conn.execute(sql);
  return rows;
}

async function main() {
  const json = process.argv.includes('--json');
  const conn = await mysql.createConnection(connectionConfig(loadEnv()));
  const report = {
    duplicateAthletes: await query(conn, `
      SELECT REPLACE(LOWER(TRIM(name)), ' ', '') AS normalized_name,
             COUNT(*) AS athlete_count,
             GROUP_CONCAT(CONCAT('#', athlete_id, ':', name, '/', COALESCE(gender, ''), '/', COALESCE(nationality, ''), '/', status)
               ORDER BY status = 'published' DESC, athlete_id ASC SEPARATOR ' || ') AS athletes
        FROM sup_athletes
       WHERE name IS NOT NULL AND TRIM(name) <> ''
       GROUP BY normalized_name
      HAVING COUNT(*) > 1
       ORDER BY athlete_count DESC, normalized_name
       LIMIT 100
    `),
    confirmedLinksWithoutAthlete: await query(conn, `
      SELECT link_id, normalized_name, display_name, gender_hint, team_hint, confidence, note, updated_at
        FROM sup_athlete_identity_links
       WHERE status = 'confirmed' AND athlete_id IS NULL
       ORDER BY updated_at DESC
       LIMIT 100
    `),
    resultNamesLinkedToMultipleAthletes: await query(conn, `
      SELECT REPLACE(LOWER(TRIM(athlete_name_snapshot)), ' ', '') AS normalized_name,
             athlete_name_snapshot,
             COUNT(DISTINCT athlete_id) AS linked_athletes,
             COUNT(*) AS result_count,
             GROUP_CONCAT(DISTINCT CONCAT('#', athlete_id) ORDER BY athlete_id SEPARATOR ',') AS athlete_ids
        FROM sup_event_results
       WHERE athlete_id IS NOT NULL
         AND athlete_name_snapshot IS NOT NULL
         AND TRIM(athlete_name_snapshot) <> ''
       GROUP BY normalized_name, athlete_name_snapshot
      HAVING COUNT(DISTINCT athlete_id) > 1
       ORDER BY linked_athletes DESC, result_count DESC
       LIMIT 100
    `),
    suspiciousCentisecondTimes: await query(conn, `
      SELECT er.result_id, er.athlete_id, er.athlete_name_snapshot, er.gender_group, er.discipline,
             er.finish_time, er.time_seconds, e.start_date, e.name AS event_name
        FROM sup_event_results er
        JOIN sup_events e ON e.event_id = er.event_id
       WHERE er.finish_time REGEXP '^[1-9][0-9]{1,2}:[0-9]{2}:[0-9]{2}$'
         AND CAST(SUBSTRING_INDEX(er.finish_time, ':', 1) AS UNSIGNED) > 2
         AND er.time_seconds > 7200
       ORDER BY er.time_seconds DESC
       LIMIT 200
    `),
  };
  await conn.end();

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const [key, rows] of Object.entries(report)) {
    console.log(`\n## ${key} (${rows.length})`);
    for (const row of rows.slice(0, 20)) console.log(JSON.stringify(row));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
