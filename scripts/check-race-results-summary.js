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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
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
  });

  try {
    const [summary] = await connection.execute(
      `SELECT COUNT(*) AS results,
              COUNT(DISTINCT source_id) AS sources,
              SUM(team_name = '个人') AS personalTeams,
              SUM(result_status_code IS NOT NULL) AS statuses
       FROM sup_event_results`
    );
    const [members] = await connection.execute(
      `SELECT COUNT(*) AS members, COUNT(DISTINCT result_id) AS teamResults
       FROM sup_event_result_members`
    );
    const [athletes] = await connection.execute(
      `SELECT a.athlete_id, a.name,
              COUNT(DISTINCT er.result_id) AS directResults,
              COUNT(DISTINCT erm.result_id) AS memberResults,
              JSON_LENGTH(a.race_times) AS raceTimes
       FROM sup_athletes a
       LEFT JOIN sup_event_results er ON er.athlete_id = a.athlete_id
       LEFT JOIN sup_event_result_members erm ON erm.athlete_id = a.athlete_id
       WHERE a.name IN ('谢海龙', '谢广远')
       GROUP BY a.athlete_id, a.name, a.race_times
       ORDER BY a.name, a.athlete_id`
    );
    const [sample] = await connection.execute(
      `SELECT a.name, e.name AS event_name, er.discipline, er.gender_group,
              er.rank_position, er.finish_time, er.team_name, src.file_name
       FROM sup_event_results er
       JOIN sup_events e ON e.event_id = er.event_id
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       LEFT JOIN sup_event_result_sources src ON src.source_id = er.source_id
       WHERE a.name IN ('谢海龙', '谢广远')
       ORDER BY e.start_date DESC, er.result_id DESC
       LIMIT 12`
    );
    console.log(JSON.stringify({ summary: summary[0], members: members[0], athletes, sample }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
