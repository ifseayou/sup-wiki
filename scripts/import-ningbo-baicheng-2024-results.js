#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 189;
const DUPLICATE_EVENT_ID = 241;
const DUPLICATE_SOURCE_ID = 301;
const RESULT_BATCH_SIZE = 100;
const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
};

function usage() {
  console.log('Usage: node scripts/import-ningbo-baicheng-2024-results.js --input /private/tmp/ningbo-baicheng-2024-results.json [--dry-run]');
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
        existingRows.length > 1 ? '宁波梅山湾重导发现同名候选，需后台确认' : '宁波梅山湾重导自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由宁波梅山湾百城公开赛成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(insertResult.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'confirmed', '宁波梅山湾重导自动创建草稿运动员')`,
    [athleteId, key, name, item.gender_group || null, item.team_name || null]
  );
  athleteCache.set(key, athleteId);
  return athleteId;
}

async function syncAthleteRaceTimesBatch(connection, athleteIds) {
  const ids = [...new Set(athleteIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.execute(
    `SELECT DISTINCT linked.athlete_id, er.discipline, er.round_label, er.result_label, er.finish_time, er.result_status_code, er.result_status_note, er.rank_position, e.start_date, e.event_id, e.name AS event_name
     FROM (
       SELECT result_id, athlete_id FROM sup_event_results WHERE athlete_id IN (${placeholders})
       UNION
       SELECT result_id, athlete_id FROM sup_event_result_members WHERE athlete_id IN (${placeholders})
     ) linked
     INNER JOIN sup_event_results er ON er.result_id = linked.result_id
     INNER JOIN sup_events e ON e.event_id = er.event_id
     ORDER BY linked.athlete_id ASC, e.start_date DESC, er.rank_position ASC`,
    [...ids, ...ids]
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

async function upsertSource(connection, payload) {
  const source = payload.source;
  const [existing] = await connection.execute('SELECT source_id FROM sup_event_result_sources WHERE source_id = ? LIMIT 1', [source.source_id]);
  if (existing.length) {
    await connection.execute(
      `UPDATE sup_event_result_sources
       SET event_id = ?, original_path = ?, file_name = ?, file_type = 'pdf', source_url = ?, parser_name = ?,
           parser_status = 'imported', parser_note = ?, extracted_rows = ?, imported_rows = ?, metadata = ?
       WHERE source_id = ?`,
      [
        EVENT_ID,
        source.original_path || null,
        source.file_name,
        source.source_url || null,
        source.parser_name,
        source.parser_note || null,
        payload.results.length,
        payload.results.length,
        JSON.stringify(source.metadata || {}),
        source.source_id,
      ]
    );
    return Number(source.source_id);
  }
  const [inserted] = await connection.execute(
    `INSERT INTO sup_event_result_sources
      (event_id, original_path, file_name, file_type, source_url, parser_name, parser_status, parser_note, extracted_rows, imported_rows, metadata)
     VALUES (?, ?, ?, 'pdf', ?, ?, 'imported', ?, ?, ?, ?)`,
    [
      EVENT_ID,
      source.original_path || null,
      source.file_name,
      source.source_url || null,
      source.parser_name,
      source.parser_note || null,
      payload.results.length,
      payload.results.length,
      JSON.stringify(source.metadata || {}),
    ]
  );
  return Number(inserted.insertId);
}

async function insertResults(connection, payload, sourceId, athleteCache, touchedAthletes) {
  const sqlPrefix = `INSERT INTO sup_event_results (
    event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
    rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name, nationality_snapshot,
    source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified
  ) VALUES `;
  const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "中国", "official", ?, ?, ?, ?, ?, ?, ?, 1)';

  for (const group of chunk(payload.results, RESULT_BATCH_SIZE)) {
    const values = [];
    for (const result of group) {
      const athleteId = await resolveAthleteId(connection, result, athleteCache);
      if (athleteId) touchedAthletes.add(athleteId);
      const code = statusCode(result.result_status_code || result.finish_time);
      values.push(
        EVENT_ID,
        athleteId,
        result.athlete_name_snapshot,
        result.bib_number || null,
        result.gender_group || '公开组',
        result.discipline,
        result.board_class || null,
        result.round_label || null,
        Number(result.rank_position),
        result.result_label || null,
        String(result.finish_time || ''),
        code,
        result.result_status_note || (code ? STATUS_LABELS[code] : null),
        parseTimeToSeconds(result.finish_time),
        typeof result.points === 'number' && Number.isFinite(result.points) ? result.points : null,
        result.team_name || '个人',
        sourceId,
        payload.source.file_name,
        result.source_locator || null,
        payload.source.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' ? result.parse_confidence : 1,
        result.review_status || 'confirmed'
      );
    }
    await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  console.log(`payload results=${payload.results.length}`);
  if (args.dryRun) return;

  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
    multipleStatements: true,
  });
  const athleteCache = new Map();
  const touchedAthletes = new Set();

  try {
    const [oldAthletes] = await connection.execute(
      `SELECT athlete_id FROM sup_event_results WHERE event_id IN (?, ?) AND athlete_id IS NOT NULL
       UNION
       SELECT erm.athlete_id
       FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE er.event_id IN (?, ?) AND erm.athlete_id IS NOT NULL`,
      [EVENT_ID, DUPLICATE_EVENT_ID, EVENT_ID, DUPLICATE_EVENT_ID]
    );
    oldAthletes.forEach((row) => touchedAthletes.add(Number(row.athlete_id)));

    await connection.beginTransaction();
    const sourceId = await upsertSource(connection, payload);
    await connection.execute(
      `UPDATE sup_events
       SET name = ?, province = ?, city = ?, venue = ?, start_date = ?, end_date = ?,
           result_status = 'extended_complete',
           result_source_note = '本地成绩册第18页后重解析导入',
           result_last_verified_at = NOW(),
           status = 'published',
           event_status = 'completed'
       WHERE event_id = ?`,
      [
        payload.event.name,
        payload.event.province,
        payload.event.city,
        payload.event.venue,
        payload.event.start_date,
        payload.event.end_date,
        EVENT_ID,
      ]
    );
    await connection.execute(
      `UPDATE sup_events
       SET status = 'draft', result_status = 'none', result_source_note = '重复赛事，成绩已归并到 event_id=189'
       WHERE event_id = ?`,
      [DUPLICATE_EVENT_ID]
    );
    await connection.execute('DELETE FROM sup_event_results WHERE event_id IN (?, ?)', [EVENT_ID, DUPLICATE_EVENT_ID]);
    await connection.execute('UPDATE sup_event_result_sources SET event_id = NULL WHERE event_id IN (?, ?) AND source_id <> ?', [EVENT_ID, DUPLICATE_EVENT_ID, sourceId]);
    await connection.execute('UPDATE sup_event_result_sources SET event_id = NULL, imported_rows = 0 WHERE source_id = ?', [DUPLICATE_SOURCE_ID]);
    await insertResults(connection, payload, sourceId, athleteCache, touchedAthletes);
    await connection.execute(
      'UPDATE sup_event_result_sources SET imported_rows = ?, extracted_rows = ?, parser_status = "imported" WHERE source_id = ?',
      [payload.results.length, payload.results.length, sourceId]
    );
    await connection.commit();

    const ids = [...touchedAthletes].filter(Number.isFinite);
    for (const group of chunk(ids, RESULT_BATCH_SIZE)) {
      await syncAthleteRaceTimesBatch(connection, group);
    }
    console.log(`done event_id=${EVENT_ID} duplicate_event_id=${DUPLICATE_EVENT_ID} results=${payload.results.length} touchedAthletes=${ids.length}`);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure.
    }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
