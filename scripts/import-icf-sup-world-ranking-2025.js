#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const defaultInput = path.join(repoRoot, '.cache/icf-sup-world-ranking-2025/parsed/standings.json');

function usage() {
  console.log(`Usage:
  node scripts/import-icf-sup-world-ranking-2025.js --input .cache/icf-sup-world-ranking-2025/parsed/standings.json [--dry-run]
`);
}

function parseArgs(argv) {
  const args = { input: defaultInput, dryRun: false, help: false };
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--input') args.input = path.resolve(argv[++index] || defaultInput);
    else if (item === '--dry-run') args.dryRun = true;
    else if (item === '--help' || item === '-h') args.help = true;
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? Number(next.toFixed(3)) : null;
}

function rowsBySource(records) {
  const grouped = new Map();
  for (const record of records) {
    const list = grouped.get(record.group_code) || [];
    list.push(record);
    grouped.set(record.group_code, list);
  }
  return grouped;
}

async function ensureSource(conn, source) {
  await conn.execute(
    `INSERT INTO sup_annual_point_sources
      (source_key, year, title, source_url, form_token, open_search_id, parser_name, sync_status, raw_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'syncing', ?)
     ON DUPLICATE KEY UPDATE
       year = VALUES(year),
       title = VALUES(title),
       source_url = VALUES(source_url),
       form_token = VALUES(form_token),
       open_search_id = VALUES(open_search_id),
       parser_name = VALUES(parser_name),
       sync_status = 'syncing',
       raw_config = VALUES(raw_config),
       error_message = NULL`,
    [
      source.source_key,
      source.year,
      source.title,
      source.source_url,
      source.form_token,
      source.open_search_id,
      source.parser_name,
      JSON.stringify(source),
    ]
  );
  const [rows] = await conn.execute('SELECT source_id FROM sup_annual_point_sources WHERE source_key = ? LIMIT 1', [
    source.source_key,
  ]);
  return Number(rows[0].source_id);
}

async function insertStanding(conn, sourceId, record) {
  await conn.execute(
    `INSERT INTO sup_annual_point_standings
      (source_id, year, group_code, group_name, rank_position, athlete_id, athlete_name_snapshot,
       total_points, endurance_points, sprint_points, technical_points, base_detail_text, adjustment_detail_text,
       source_record_id, source_token, raw_json, identity_link_id, match_status, match_confidence)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'unmatched', 0.300)`,
    [
      sourceId,
      Number(record.year || 2025),
      record.group_code,
      record.group_name,
      Number(record.rank_position),
      record.athlete_name_snapshot,
      numberOrNull(record.total_points),
      numberOrNull(record.endurance_points),
      numberOrNull(record.sprint_points),
      numberOrNull(record.technical_points),
      record.base_detail_text || null,
      record.adjustment_detail_text || null,
      record.source_record_id,
      record.source_token || null,
      JSON.stringify(record.raw_json || {}),
    ]
  );
  const [ids] = await conn.execute('SELECT LAST_INSERT_ID() AS standing_id');
  const standingId = Number(ids[0].standing_id);
  for (const breakdown of record.breakdowns || []) {
    const points = numberOrNull(breakdown.points);
    const endurance = record.endurance_points != null ? points : null;
    const sprint = record.sprint_points != null ? points : null;
    const technical = record.technical_points != null ? points : null;
    await conn.execute(
      `INSERT INTO sup_annual_point_breakdowns
        (standing_id, detail_type, event_name, star_level, endurance_points, sprint_points, technical_points, raw_text)
       VALUES (?, 'base', ?, NULL, ?, ?, ?, ?)`,
      [standingId, breakdown.event_name || null, endurance, sprint, technical, `${breakdown.event_name}：${points}`]
    );
  }
}

async function importSource(conn, source, records) {
  const sourceId = await ensureSource(conn, source);
  await conn.execute('DELETE FROM sup_annual_point_standings WHERE source_id = ?', [sourceId]);
  let imported = 0;
  for (const record of records) {
    await insertStanding(conn, sourceId, record);
    imported += 1;
  }
  await conn.execute(
    `UPDATE sup_annual_point_sources
     SET sync_status = 'imported',
         total_records = ?,
         imported_records = ?,
         group_counts = ?,
         error_message = NULL,
         last_synced_at = CURRENT_TIMESTAMP
     WHERE source_id = ?`,
    [
      records.length,
      imported,
      JSON.stringify({ [source.group_code]: { label: source.group_name, imported } }),
      sourceId,
    ]
  );
  return imported;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const grouped = rowsBySource(payload.records || []);
  console.log(`input sources=${payload.sources.length}, records=${payload.records.length}`);
  for (const source of payload.sources) {
    console.log(`${source.group_name}: ${(grouped.get(source.group_code) || []).length}`);
  }
  if (args.dryRun) return;

  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
    multipleStatements: false,
  });

  try {
    await conn.beginTransaction();
    let imported = 0;
    for (const source of payload.sources || []) {
      imported += await importSource(conn, source, grouped.get(source.group_code) || []);
    }
    await conn.commit();
    console.log(`Imported ${imported} ICF world ranking rows.`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
