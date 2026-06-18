#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 380;
const SUBMISSION_ID = 32;

function parseArgs(argv) {
  const args = { input: '', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--input') args.input = argv[++i] || '';
    else if (item === '--dry-run') args.dryRun = true;
    else if (item === '--help' || item === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log('Usage: node scripts/import-hanzhong-open-2026-point-standings.js --input .cache/china-sup-open-hanzhong-2026-results.json [--dry-run]');
}

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

function normalizedName(name) {
  return String(name || '').replace(/\s+/g, '').toLowerCase();
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function findSourceId(connection, payload) {
  const [rows] = await connection.execute(
    `SELECT source_id
     FROM sup_event_result_sources
     WHERE event_id = ?
       AND (result_submission_id = ? OR source_url = ?)
     ORDER BY source_id ASC
     LIMIT 1`,
    [EVENT_ID, SUBMISSION_ID, payload.source?.source_url || null]
  );
  if (!rows.length) throw new Error('Missing result source. Import race results first.');
  return Number(rows[0].source_id);
}

async function buildAthleteMap(connection) {
  const [rows] = await connection.execute(
    `SELECT athlete_name_snapshot, bib_number, athlete_id
     FROM sup_event_results
     WHERE event_id = ? AND athlete_id IS NOT NULL`,
    [EVENT_ID]
  );
  const byBibName = new Map();
  const byName = new Map();
  for (const row of rows) {
    const athleteId = Number(row.athlete_id || 0);
    if (!athleteId) continue;
    const name = normalizedName(row.athlete_name_snapshot);
    if (row.bib_number) byBibName.set(`${row.bib_number}|${name}`, athleteId);
    if (!byName.has(name)) byName.set(name, athleteId);
  }
  return { byBibName, byName };
}

function resolveAthleteId(row, maps) {
  if (String(row.athlete_name_snapshot || '').includes('、')) return null;
  const name = normalizedName(row.athlete_name_snapshot);
  if (row.bib_number && maps.byBibName.has(`${row.bib_number}|${name}`)) {
    return maps.byBibName.get(`${row.bib_number}|${name}`);
  }
  return maps.byName.get(name) || null;
}

async function importPoints(connection, payload, dryRun) {
  const rows = Array.isArray(payload.point_standings) ? payload.point_standings : [];
  if (dryRun) {
    const groups = new Map();
    for (const row of rows) groups.set(row.group_name, (groups.get(row.group_name) || 0) + 1);
    console.log(`dry-run points=${rows.length} groups=${groups.size}`);
    for (const [group, count] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'))) {
      console.log(`${group}: ${count}`);
    }
    return { imported: rows.length };
  }

  const sourceId = await findSourceId(connection, payload);
  const athleteMap = await buildAthleteMap(connection);
  await connection.beginTransaction();
  try {
    await connection.execute('DELETE FROM sup_event_point_standings WHERE event_id = ?', [EVENT_ID]);
    const sql = `INSERT INTO sup_event_point_standings (
       event_id, source_id, group_name, rank_position, status_rank, bib_number, athlete_id,
       athlete_name_snapshot, team_name, endurance_rank, endurance_points, sprint_rank, sprint_points,
       technical_rank, technical_points, total_points, source_locator
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    for (const row of rows) {
      await connection.execute(sql, [
        EVENT_ID,
        sourceId,
        row.group_name,
        row.rank_position || null,
        row.status_rank || null,
        row.bib_number || null,
        resolveAthleteId(row, athleteMap),
        row.athlete_name_snapshot,
        row.team_name || null,
        row.endurance_rank || null,
        numberOrNull(row.endurance_points),
        row.sprint_rank || null,
        numberOrNull(row.sprint_points),
        row.technical_rank || null,
        numberOrNull(row.technical_points),
        numberOrNull(row.total_points),
        row.source_locator || null,
      ]);
    }
    await connection.execute(
      `UPDATE sup_events
       SET start_date = '2026-06-13',
           end_date = '2026-06-14',
           event_status = 'completed',
           result_status = 'extended_complete',
           source_scope = '国内外',
           result_source_note = ?,
           result_last_verified_at = NOW()
       WHERE event_id = ?`,
      [payload.event?.result_source_note || '用户提交成绩册导入：成绩与积分完整入库。', EVENT_ID]
    );
    await connection.execute(
      `UPDATE sup_event_result_submissions
       SET status = 'imported',
           event_id = ?,
           admin_note = TRIM(CONCAT(COALESCE(admin_note, ''), CASE WHEN COALESCE(admin_note, '') = '' THEN '' ELSE '\n' END, ?))
       WHERE submission_id = ?`,
      [EVENT_ID, `导入完成：成绩册，${rows.length} 条积分`, SUBMISSION_ID]
    );
    await connection.commit();
    return { imported: rows.length, sourceId };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  if (args.dryRun) {
    const result = await importPoints(null, payload, true);
    console.log(`dry-run imported=${result.imported}`);
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
    const result = await importPoints(connection, payload, args.dryRun);
    console.log(`${args.dryRun ? 'dry-run' : 'done'} imported=${result.imported}${result.sourceId ? ` sourceId=${result.sourceId}` : ''}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
