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

async function syncAthletes(connection, athleteIds) {
  const ids = [...new Set(athleteIds.map(Number).filter(Number.isFinite))];
  for (const athleteId of ids) {
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
    await connection.execute(
      'UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?',
      [JSON.stringify(rows.map((row) => ({
        distance: row.discipline,
        year: row.start_date ? new Date(row.start_date).getFullYear() : undefined,
        event: row.event_name,
        event_id: row.event_id,
        round: row.round_label || undefined,
        result: row.result_label || undefined,
        time: row.finish_time,
        status: row.result_status_code || undefined,
        status_label: row.result_status_note || undefined,
      }))), athleteId]
    );
  }
  return ids.length;
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
    await connection.beginTransaction();
    const [eventRows] = await connection.execute(
      `SELECT event_id FROM sup_events
       WHERE name = '2026年“鉴湖杯”第二届浙江省桨板精英赛'
       ORDER BY event_id ASC`
    );
    if (!eventRows.length) throw new Error('未找到 2026年“鉴湖杯”第二届浙江省桨板精英赛');
    const eventId = Number(eventRows[0].event_id);
    const duplicateIds = eventRows.slice(1).map((row) => Number(row.event_id)).filter(Number.isFinite);
    const allEventIds = [eventId, ...duplicateIds];
    const placeholders = allEventIds.map(() => '?').join(',');

    const [athletes] = await connection.execute(
      `SELECT DISTINCT athlete_id FROM sup_event_results
       WHERE event_id IN (${placeholders}) AND athlete_id IS NOT NULL`,
      allEventIds
    );
    const touchedAthletes = athletes.map((row) => Number(row.athlete_id));

    await connection.execute(`DELETE FROM sup_event_results WHERE event_id IN (${placeholders})`, allEventIds);
    await connection.execute(`DELETE FROM sup_event_result_sources WHERE event_id IN (${placeholders})`, allEventIds);
    if (duplicateIds.length) {
      await connection.execute(`DELETE FROM sup_events WHERE event_id IN (${duplicateIds.map(() => '?').join(',')})`, duplicateIds);
    }
    await connection.execute(
      `UPDATE sup_events
       SET start_date = '2026-05-17',
           end_date = COALESCE(end_date, '2026-05-17'),
           province = COALESCE(province, '浙江'),
           city = COALESCE(city, '绍兴'),
           venue = COALESCE(venue, '柯桥鉴湖'),
           status = 'published',
           event_status = 'completed',
           result_status = 'partial',
           result_source_note = '本地成绩册重建中'
       WHERE event_id = ?`,
      [eventId]
    );
    await connection.commit();
    const syncedAthletes = await syncAthletes(connection, touchedAthletes);
    console.log(JSON.stringify({ eventId, deletedDuplicateEvents: duplicateIds.length, touchedAthletes: touchedAthletes.length, syncedAthletes }, null, 2));
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
