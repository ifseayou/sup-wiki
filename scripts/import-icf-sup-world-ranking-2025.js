#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const defaultInput = path.join(repoRoot, '.cache/icf-sup-world-ranking-2025/parsed/standings.json');
const aggregateSource = {
  source_key: 'icf-2025-sup-world-ranking-aggregate',
  year: 2025,
  point_scope: 'international',
  title: '2025 ICF SUP World Ranking List',
  source_url: 'https://www.canoeicf.com/sites/default/files/sup_wr_10112025_long_distance_men.pdf',
  form_token: 'icf-2025-sup-world-ranking',
  open_search_id: 'aggregate',
  parser_name: 'import-icf-sup-world-ranking-2025.js',
};

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

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function scopePointField(discipline) {
  const key = String(discipline || '').toLowerCase();
  if (key === 'distance') return 'endurance_points';
  if (key === 'sprint') return 'sprint_points';
  if (key === 'technical') return 'technical_points';
  return null;
}

function groupNameForGender(gender) {
  return gender === 'women' ? 'ICF Women' : 'ICF Men';
}

function groupCodeForGender(gender) {
  return gender === 'women' ? 'icf_women' : 'icf_men';
}

function aggregateRecords(records) {
  const byAthlete = new Map();
  for (const record of records) {
    const raw = record.raw_json || {};
    const gender = raw.gender === 'women' ? 'women' : 'men';
    const discipline = String(raw.discipline || '').toLowerCase();
    const pointField = scopePointField(discipline);
    if (!pointField) continue;
    const name = String(record.athlete_name_snapshot || '').trim();
    if (!name) continue;
    const key = `${gender}:${normalizeName(name)}`;
    const aggregate = byAthlete.get(key) || {
      year: 2025,
      gender,
      group_code: groupCodeForGender(gender),
      group_name: groupNameForGender(gender),
      athlete_name_snapshot: name,
      endurance_points: null,
      sprint_points: null,
      technical_points: null,
      total_points: 0,
      disciplines: {},
      breakdowns: [],
    };
    const disciplinePoints = numberOrNull(record.total_points) || 0;
    aggregate[pointField] = disciplinePoints;
    aggregate.disciplines[discipline] = {
      rank_position: record.rank_position,
      points: disciplinePoints,
      source_record_id: record.source_record_id,
      pdf_url: raw.pdf_url || null,
      event_points: raw.event_points || [],
    };
    for (const breakdown of record.breakdowns || []) {
      aggregate.breakdowns.push({
        discipline,
        event_name: `${raw.discipline || discipline} / ${breakdown.event_name}`,
        points: numberOrNull(breakdown.points),
      });
    }
    byAthlete.set(key, aggregate);
  }

  const grouped = new Map();
  for (const row of byAthlete.values()) {
    row.total_points = ['endurance_points', 'sprint_points', 'technical_points']
      .reduce((sum, field) => sum + (numberOrNull(row[field]) || 0), 0);
    row.base_detail_text = [
      row.endurance_points != null ? `Distance：${row.endurance_points}` : '',
      row.technical_points != null ? `Technical：${row.technical_points}` : '',
      row.sprint_points != null ? `Sprint：${row.sprint_points}` : '',
    ].filter(Boolean).join('\n');
    row.adjustment_detail_text = '';
    row.source_token = `${row.group_code}:${normalizeName(row.athlete_name_snapshot)}`.slice(0, 120);
    row.source_record_id = `icf_2025:${row.group_code}:${normalizeName(row.athlete_name_snapshot)}`.slice(0, 80);
    row.raw_json = {
      source: '2025 ICF SUP World Ranking List',
      gender: row.gender,
      disciplines: row.disciplines,
      total_points: row.total_points,
    };
    const list = grouped.get(row.group_code) || [];
    list.push(row);
    grouped.set(row.group_code, list);
  }

  const output = [];
  for (const [groupCode, rows] of grouped.entries()) {
    rows.sort((a, b) => {
      const pointDiff = (numberOrNull(b.total_points) || 0) - (numberOrNull(a.total_points) || 0);
      if (pointDiff) return pointDiff;
      return String(a.athlete_name_snapshot).localeCompare(String(b.athlete_name_snapshot));
    });
    let previousPoints = null;
    let previousRank = 0;
    rows.forEach((row, index) => {
      const points = numberOrNull(row.total_points) || 0;
      const rank = previousPoints !== null && points === previousPoints ? previousRank : index + 1;
      row.rank_position = rank;
      previousPoints = points;
      previousRank = rank;
      output.push(row);
    });
    console.log(`${groupCode}: aggregated ${rows.length}`);
  }
  return output.sort((a, b) => String(a.group_code).localeCompare(String(b.group_code)) || a.rank_position - b.rank_position);
}

async function ensureSchema(conn) {
  const [scopeRows] = await conn.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'sup_annual_point_sources'
       AND COLUMN_NAME = 'point_scope'`
  );
  if (!Number(scopeRows[0]?.total || 0)) {
    await conn.execute(
      `ALTER TABLE sup_annual_point_sources
       ADD COLUMN point_scope ENUM('domestic','international') NOT NULL DEFAULT 'domestic' AFTER year`
    );
  }
  await conn.execute(
    `CREATE TABLE IF NOT EXISTS sup_annual_point_import_cache (
      cache_id BIGINT PRIMARY KEY AUTO_INCREMENT,
      cache_key VARCHAR(120) NOT NULL,
      source_key VARCHAR(120) NOT NULL,
      payload_json JSON NOT NULL,
      record_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_annual_point_import_cache_key (cache_key),
      INDEX idx_annual_point_import_cache_source (source_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

async function ensureSource(conn, source) {
  await conn.execute(
    `INSERT INTO sup_annual_point_sources
      (source_key, year, point_scope, title, source_url, form_token, open_search_id, parser_name, sync_status, raw_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'syncing', ?)
     ON DUPLICATE KEY UPDATE
       year = VALUES(year),
       point_scope = VALUES(point_scope),
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
      source.point_scope || 'domestic',
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
    const discipline = String(breakdown.discipline || '').toLowerCase();
    const endurance = discipline === 'distance' ? points : null;
    const sprint = discipline === 'sprint' ? points : null;
    const technical = discipline === 'technical' ? points : null;
    await conn.execute(
      `INSERT INTO sup_annual_point_breakdowns
        (standing_id, detail_type, event_name, star_level, endurance_points, sprint_points, technical_points, raw_text)
       VALUES (?, 'base', ?, NULL, ?, ?, ?, ?)`,
      [standingId, breakdown.event_name || null, endurance, sprint, technical, `${breakdown.event_name}：${points}`]
    );
  }
}

async function writeCache(conn, payload, aggregateRows) {
  await conn.execute(
    `INSERT INTO sup_annual_point_import_cache
      (cache_key, source_key, payload_json, record_count)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       payload_json = VALUES(payload_json),
       record_count = VALUES(record_count),
       updated_at = CURRENT_TIMESTAMP`,
    [
      'icf-sup-world-ranking-2025-raw-and-aggregate',
      aggregateSource.source_key,
      JSON.stringify({ raw: payload, aggregate: aggregateRows }),
      aggregateRows.length,
    ]
  );
}

async function importSource(conn, source, records) {
  const sourceId = await ensureSource(conn, source);
  await conn.execute(
    `DELETE FROM sup_annual_point_sources
     WHERE source_key LIKE 'icf-2025-sup-wr-%'
       AND source_key <> ?`,
    [source.source_key]
  );
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
      JSON.stringify({
        icf_men: { label: 'ICF Men', imported: records.filter((row) => row.group_code === 'icf_men').length },
        icf_women: { label: 'ICF Women', imported: records.filter((row) => row.group_code === 'icf_women').length },
      }),
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
  const aggregateRows = aggregateRecords(payload.records || []);
  console.log(`input sources=${payload.sources.length}, records=${payload.records.length}, aggregate=${aggregateRows.length}`);
  for (const groupCode of ['icf_men', 'icf_women']) {
    console.log(`${groupCode}: ${aggregateRows.filter((row) => row.group_code === groupCode).length}`);
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
    await ensureSchema(conn);
    await writeCache(conn, payload, aggregateRows);
    const imported = await importSource(conn, {
      ...aggregateSource,
      raw_config: {
        input_sources: payload.sources || [],
      },
    }, aggregateRows);
    await conn.commit();
    console.log(`Imported ${imported} aggregated ICF world ranking rows.`);
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
