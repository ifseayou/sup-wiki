#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function usage() {
  console.log('Usage: node scripts/import-lvshuiqingshan-ningbo-2026-point-standings.js --input .cache/lvshuiqingshan-ningbo-2026-results.json [--dry-run]');
}

function parseArgs(argv) {
  const args = { input: '', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[++i] || '';
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

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

function readPayload(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function findSourceId(connection, eventId, source) {
  const [rows] = await connection.execute(
    `SELECT source_id
     FROM sup_event_result_sources
     WHERE event_id = ?
       AND (
         result_submission_id = ?
         OR (file_name = ? AND COALESCE(source_url, '') = COALESCE(?, ''))
       )
     ORDER BY source_id ASC
     LIMIT 1`,
    [
      eventId,
      Number(source.result_submission_id || 0),
      source.file_name || '',
      source.source_url || '',
    ]
  );
  return rows.length ? Number(rows[0].source_id) : null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = readPayload(args.input);
  const eventId = Number(payload.event?.event_id || 0);
  const standings = Array.isArray(payload.point_standings) ? payload.point_standings : [];
  if (!eventId) throw new Error('payload.event.event_id is required');
  if (args.dryRun) {
    console.log(`dry-run event=${eventId} point_standings=${standings.length}`);
    console.log(`top=${standings.slice(0, 3).map((x) => `${x.rank_position}:${x.team_name}:${x.total_points}`).join(' | ')}`);
    return;
  }

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
    const [eventRows] = await connection.execute('SELECT event_id FROM sup_events WHERE event_id = ? LIMIT 1', [eventId]);
    if (!eventRows.length) throw new Error(`event_id ${eventId} not found`);
    const sourceId = await findSourceId(connection, eventId, payload.source || {});
    if (!sourceId) throw new Error(`source for event_id ${eventId} not found; import results first`);

    await connection.execute('DELETE FROM sup_event_point_standings WHERE event_id = ? AND group_name = ?', [eventId, '团体总分']);
    for (const row of standings) {
      await connection.execute(
        `INSERT INTO sup_event_point_standings (
           event_id, source_id, group_name, rank_position, status_rank, bib_number,
           athlete_id, athlete_name_snapshot, team_name,
           endurance_rank, endurance_points, sprint_rank, sprint_points, total_points, source_locator
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          sourceId,
          row.group_name || '团体总分',
          Number(row.rank_position),
          row.status_rank || null,
          row.bib_number || null,
          row.athlete_name_snapshot,
          row.team_name || row.athlete_name_snapshot,
          row.endurance_rank || null,
          row.endurance_points ?? null,
          row.sprint_rank || null,
          row.sprint_points ?? null,
          row.total_points ?? null,
          row.source_locator || null,
        ]
      );
    }
    await connection.execute(
      `UPDATE sup_events
       SET event_status = 'completed',
           result_status = 'extended_complete',
           result_last_verified_at = NOW()
       WHERE event_id = ?`,
      [eventId]
    );
    await connection.execute(
      `UPDATE sup_event_result_submissions
       SET status = 'imported',
           admin_note = TRIM(CONCAT(COALESCE(admin_note, ''), CASE WHEN COALESCE(admin_note, '') = '' THEN '' ELSE '\n' END, ?))
       WHERE submission_id = ?`,
      [`导入完成：团体总分 ${standings.length} 条`, Number(payload.source?.result_submission_id || 0)]
    );
    await connection.commit();
    console.log(`done event=${eventId} source=${sourceId} point_standings=${standings.length}`);
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
