#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const RESULT_BATCH_SIZE = 120;
const ATHLETE_SYNC_BATCH_SIZE = 200;

const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
  DNQ: '未晋级',
  OTL: '超过关门时间',
};

function parseArgs(argv) {
  const args = { input: '', dryRun: false, help: false };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--input') args.input = argv[++index] || '';
    else if (argv[index] === '--dry-run') args.dryRun = true;
    else if (argv[index] === '--help' || argv[index] === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log('Usage: node scripts/import-lushan-xihai-2025-results.js --input /tmp/lushan-xihai-2025-results.json [--dry-run]');
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
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[trimmed.slice(0, index).trim()] = value;
  }
  return env;
}

function chunk(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function normalizedName(name) {
  return String(name || '').replace(/\s+/g, '').toLowerCase();
}

function statusCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return STATUS_LABELS[code] ? code : null;
}

function parseTimeToSeconds(input) {
  const raw = String(input || '').trim();
  if (!raw || statusCode(raw)) return null;
  const parts = raw.split(':').map((part) => part.trim());
  if (parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return null;
}

async function findEventId(connection) {
  const [rows] = await connection.execute(
    `SELECT event_id, name, status
     FROM sup_events
     WHERE (name LIKE '%庐山西海%' OR name LIKE '%西海站%' OR slug LIKE '%xihai%' OR slug LIKE '%lushan%')
       AND (start_date IS NULL OR YEAR(start_date) = 2025)
     ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, event_id ASC
     LIMIT 1`
  );
  if (!rows.length) throw new Error('未找到庐山西海站赛事记录');
  return Number(rows[0].event_id);
}

async function resolveAthleteId(connection, item, athleteCache) {
  const name = String(item.athlete_name_snapshot || item.athlete_name || '').trim();
  if (!name) return null;
  const key = normalizedName(name);
  if (athleteCache.has(key)) return athleteCache.get(key);

  const [identityRows] = await connection.execute(
    `SELECT athlete_id FROM sup_athlete_identity_links
     WHERE normalized_name = ? AND status = 'confirmed' AND athlete_id IS NOT NULL
     ORDER BY confidence DESC, link_id ASC LIMIT 1`,
    [key]
  );
  if (identityRows.length) {
    const athleteId = Number(identityRows[0].athlete_id);
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [existingRows] = await connection.execute(
    `SELECT athlete_id FROM sup_athletes
     WHERE name = ?
     ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC
     LIMIT 5`,
    [name]
  );
  if (existingRows.length) {
    const athleteId = Number(existingRows[0].athlete_id);
    await connection.execute(
      `INSERT IGNORE INTO sup_athlete_identity_links
        (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
       VALUES (?, ?, ?, ?, ?, '中国', ?, ?, ?)`,
      [
        athleteId,
        key,
        name,
        item.gender_group || null,
        item.team_name || null,
        existingRows.length > 1 ? 0.5 : 0.9,
        existingRows.length > 1 ? 'pending' : 'confirmed',
        existingRows.length > 1 ? '庐山西海站重导发现同名候选，需后台确认' : '庐山西海站重导自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [inserted] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由2025年中国桨板俱乐部联赛庐山西海站成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(inserted.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'confirmed', '庐山西海站重导自动创建草稿运动员')`,
    [athleteId, key, name, item.gender_group || null, item.team_name || null]
  );
  athleteCache.set(key, athleteId);
  return athleteId;
}

async function collectCurrentAthleteIds(connection, eventId) {
  const [rows] = await connection.execute(
    `SELECT DISTINCT athlete_id FROM sup_event_results WHERE event_id = ? AND athlete_id IS NOT NULL`,
    [eventId]
  );
  return rows.map((row) => Number(row.athlete_id)).filter(Number.isFinite);
}

async function syncAthleteRaceTimesBatch(connection, athleteIds) {
  const ids = [...new Set(athleteIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.execute(
    `SELECT DISTINCT er.athlete_id, er.discipline, er.round_label, er.result_label, er.finish_time,
            er.result_status_code, er.result_status_note, er.rank_position, e.start_date, e.event_id, e.name AS event_name
     FROM sup_event_results er
     INNER JOIN sup_events e ON e.event_id = er.event_id
     WHERE er.athlete_id IN (${placeholders})
     ORDER BY er.athlete_id ASC, e.start_date DESC, er.rank_position ASC`,
    ids
  );
  const grouped = new Map(ids.map((id) => [id, []]));
  for (const row of rows) {
    const athleteId = Number(row.athlete_id);
    if (!grouped.has(athleteId)) grouped.set(athleteId, []);
    grouped.get(athleteId).push({
      distance: row.discipline,
      year: row.start_date ? new Date(row.start_date).getFullYear() : undefined,
      event: row.event_name,
      event_id: row.event_id,
      round: row.round_label || undefined,
      result: row.result_label || undefined,
      time: row.finish_time,
      status: row.result_status_code || undefined,
      status_label: row.result_status_note || STATUS_LABELS[row.result_status_code] || undefined,
    });
  }
  for (const [athleteId, raceTimes] of grouped.entries()) {
    await connection.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
  }
}

async function upsertSource(connection, eventId, payload) {
  const source = payload.source || {};
  const results = Array.isArray(payload.results) ? payload.results : [];
  const [existing] = await connection.execute(
    `SELECT source_id FROM sup_event_result_sources
     WHERE event_id = ? AND original_path = ?
     ORDER BY source_id ASC LIMIT 1`,
    [eventId, source.original_path || null]
  );
  const params = [
    eventId,
    source.original_path || null,
    source.file_name,
    source.source_url || null,
    source.parser_name || 'parse-lushan-xihai-2025-results.py',
    'imported',
    source.parser_note || null,
    Number(source.extracted_rows || results.length || 0),
    results.length,
    JSON.stringify(source.metadata || {}),
  ];
  if (existing.length) {
    const sourceId = Number(existing[0].source_id);
    await connection.execute(
      `UPDATE sup_event_result_sources
       SET event_id = ?, original_path = ?, file_name = ?, file_type = 'pdf', source_url = ?, parser_name = ?,
           parser_status = ?, parser_note = ?, extracted_rows = ?, imported_rows = ?, metadata = ?
       WHERE source_id = ?`,
      [...params, sourceId]
    );
    return sourceId;
  }
  const [inserted] = await connection.execute(
    `INSERT INTO sup_event_result_sources
      (event_id, original_path, file_name, file_type, source_url, parser_name, parser_status, parser_note, extracted_rows, imported_rows, metadata)
     VALUES (?, ?, ?, 'pdf', ?, ?, ?, ?, ?, ?, ?)`,
    params
  );
  return Number(inserted.insertId);
}

async function insertResults(connection, eventId, sourceId, payload, athleteCache, touchedAthletes) {
  const source = payload.source || {};
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const sqlPrefix = `INSERT INTO sup_event_results (
    event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
    rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name, nationality_snapshot,
    source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified
  ) VALUES `;
  const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "中国", "official", ?, ?, ?, ?, ?, ?, ?, 1)';
  for (const group of chunk(rows, RESULT_BATCH_SIZE)) {
    const values = [];
    for (const row of group) {
      const athleteId = await resolveAthleteId(connection, row, athleteCache);
      if (athleteId) touchedAthletes.add(athleteId);
      const code = statusCode(row.result_status_code || row.finish_time);
      values.push(
        eventId,
        athleteId,
        row.athlete_name_snapshot,
        row.bib_number || null,
        row.gender_group || '公开组',
        row.discipline,
        row.board_class || null,
        row.round_label || '决赛',
        Number(row.rank_position),
        row.result_label || null,
        String(row.finish_time || ''),
        code,
        row.result_status_note || (code ? STATUS_LABELS[code] : null),
        parseTimeToSeconds(row.finish_time),
        null,
        row.team_name || '个人',
        sourceId,
        row.source_title || source.file_name,
        row.source_locator || null,
        row.source_url || source.source_url || null,
        row.source_note || null,
        typeof row.parse_confidence === 'number' ? row.parse_confidence : 0.95,
        row.review_status || 'confirmed'
      );
    }
    await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);
  }
}

function summarize(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.discipline} · ${row.gender_group} · ${row.round_label || '-'}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans'));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const rows = Array.isArray(payload.results) ? payload.results : [];
  if (!rows.length) throw new Error('input has no results');
  console.log(`Loaded ${rows.length} results from ${args.input}`);
  for (const [key, count] of summarize(rows)) console.log(`${String(count).padStart(4, ' ')}  ${key}`);
  if (args.dryRun) return;

  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || env.DB_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || env.DB_PORT || 3306),
    user: env.MYSQL_USER || env.DB_USER || 'root',
    password: env.MYSQL_PASSWORD || env.DB_PASSWORD || '',
    database: env.MYSQL_DATABASE || env.DB_NAME || 'sport_hacker',
    charset: 'utf8mb4',
  });

  const athleteCache = new Map();
  const touchedAthletes = new Set();
  let eventId = null;
  try {
    eventId = await findEventId(connection);
    for (const id of await collectCurrentAthleteIds(connection, eventId)) touchedAthletes.add(id);
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE sup_events
       SET name = ?, slug = ?, province = ?, city = ?, venue = ?, start_date = ?, end_date = ?,
           event_status = 'completed', result_status = 'extended_complete',
           result_source_note = ?, result_last_verified_at = NOW(), status = 'published'
       WHERE event_id = ?`,
      [
        payload.event.name,
        payload.event.slug,
        payload.event.province,
        payload.event.city,
        payload.event.venue,
        payload.event.start_date,
        payload.event.end_date,
        payload.event.result_source_note,
        eventId,
      ]
    );
    await connection.execute('DELETE FROM sup_event_point_standings WHERE event_id = ?', [eventId]);
    await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [eventId]);
    await connection.execute('UPDATE sup_event_result_sources SET event_id = NULL, imported_rows = 0 WHERE event_id = ?', [eventId]);
    const sourceId = await upsertSource(connection, eventId, payload);
    await insertResults(connection, eventId, sourceId, payload, athleteCache, touchedAthletes);
    await connection.commit();

    const touched = [...touchedAthletes];
    for (const group of chunk(touched, ATHLETE_SYNC_BATCH_SIZE)) await syncAthleteRaceTimesBatch(connection, group);
    console.log(`Imported ${rows.length} rows for event ${eventId}; source=${sourceId}; synced ${touched.length} athletes.`);
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
