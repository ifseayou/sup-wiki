#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 386;
const SUBMISSION_ID = 35;
const BATCH_ID = 'mp_1783304553728_z2743en7';

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
  console.log('Usage: node scripts/import-wuxi-elite-league-2026-point-standings.js --input .cache/china-sup-elite-league-wuxi-2026-results.json [--dry-run]');
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
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

async function findSourceId(connection, payload) {
  const [rows] = await connection.execute(
    `SELECT source_id
     FROM sup_event_result_sources
     WHERE event_id = ?
       AND result_submission_id = ?
       AND result_submission_batch_id = ?
     ORDER BY source_id DESC
     LIMIT 1`,
    [EVENT_ID, SUBMISSION_ID, BATCH_ID]
  );
  if (!rows.length) throw new Error('Missing result source for Wuxi 2026. Import race results first.');
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
  const name = normalizedName(row.athlete_name_snapshot);
  if (!name) return null;
  if (row.bib_number && maps.byBibName.has(`${row.bib_number}|${name}`)) return maps.byBibName.get(`${row.bib_number}|${name}`);
  return maps.byName.get(name) || null;
}

function summarizeGroups(rows) {
  const groups = new Map();
  for (const row of rows) groups.set(row.group_name, (groups.get(row.group_name) || 0) + 1);
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'));
}

function validatePayload(payload) {
  if (payload?.event?.event_id !== EVENT_ID) throw new Error(`unexpected event_id: ${payload?.event?.event_id}`);
  if (payload?.source?.result_submission_id !== SUBMISSION_ID) throw new Error(`unexpected submission_id: ${payload?.source?.result_submission_id}`);
  if (payload?.source?.result_submission_batch_id !== BATCH_ID) throw new Error(`unexpected batch_id: ${payload?.source?.result_submission_batch_id}`);
  const rows = Array.isArray(payload.point_standings) ? payload.point_standings : [];
  if (rows.length < 400) throw new Error(`point_standings too few: ${rows.length}`);
  const keySet = new Set();
  for (const row of rows) {
    const key = `${row.group_name}|${row.bib_number || ''}|${row.athlete_name_snapshot}`;
    if (keySet.has(key)) throw new Error(`duplicate point row: ${key}`);
    keySet.add(key);
  }
  return rows;
}

async function importPoints(connection, payload, dryRun) {
  const rows = validatePayload(payload);
  if (dryRun) {
    console.log(`dry-run event_id=${EVENT_ID} point_standings=${rows.length}`);
    for (const [group, count] of summarizeGroups(rows)) console.log(`${group}: ${count}`);
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
    ) VALUES ${rows.slice(0, 1).map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',')}`;
    for (const group of chunk(rows, 100)) {
      const values = [];
      for (const row of group) {
        values.push(
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
          row.source_locator || null
        );
      }
      await connection.execute(
        `INSERT INTO sup_event_point_standings (
          event_id, source_id, group_name, rank_position, status_rank, bib_number, athlete_id,
          athlete_name_snapshot, team_name, endurance_rank, endurance_points, sprint_rank, sprint_points,
          technical_rank, technical_points, total_points, source_locator
        ) VALUES ${group.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',')}`,
        values
      );
    }
    await connection.execute(
      `UPDATE sup_events
       SET start_date = '2026-07-04',
           end_date = '2026-07-05',
           event_status = 'completed',
           result_status = 'extended_complete',
           source_scope = '用户提交成绩册导入',
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
      [EVENT_ID, `导入完成：成绩 ${payload.results?.length || 0} 条，积分 ${rows.length} 条，event_id=${EVENT_ID}`, SUBMISSION_ID]
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
    const result = await importPoints(connection, payload, false);
    console.log(`done imported=${result.imported} sourceId=${result.sourceId}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
