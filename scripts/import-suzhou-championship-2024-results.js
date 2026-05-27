#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 239;
const DUPLICATE_EVENT_ID = 240;
const SOURCE_ID = 300;
const WRONG_SOURCE_ID = 305;
const RESULT_BATCH_SIZE = 120;
const ATHLETE_SYNC_BATCH_SIZE = 200;

const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
};

function usage() {
  console.log('Usage: node scripts/import-suzhou-championship-2024-results.js --input /private/tmp/suzhou-championship-2024-results.json [--dry-run]');
}

function parseArgs(argv) {
  const args = { input: '', dryRun: false, help: false };
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
        existingRows.length > 1 ? '苏州站OCR重导发现同名候选，需后台确认' : '苏州站OCR重导自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由2024中国桨板冠军赛苏州站扫描成绩册OCR导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(insertResult.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.78, 'confirmed', '苏州站OCR重导自动创建草稿运动员')`,
    [athleteId, key, name, item.gender_group || null, item.team_name || null]
  );
  athleteCache.set(key, athleteId);
  return athleteId;
}

async function collectCurrentAthleteIds(connection) {
  const [rows] = await connection.execute(
    `SELECT DISTINCT athlete_id FROM sup_event_results
     WHERE event_id IN (?, ?) AND athlete_id IS NOT NULL`,
    [EVENT_ID, DUPLICATE_EVENT_ID]
  );
  return rows.map((row) => Number(row.athlete_id)).filter(Number.isFinite);
}

async function syncAthleteRaceTimesBatch(connection, athleteIds) {
  const ids = [...new Set(athleteIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.execute(
    `SELECT DISTINCT er.athlete_id, er.discipline, er.round_label, er.result_label, er.finish_time, er.result_status_code, er.result_status_note, er.rank_position, e.start_date, e.event_id, e.name AS event_name
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

async function updateEventAndSources(connection, payload) {
  const event = payload.event || {};
  await connection.execute(
    `UPDATE sup_events
     SET name = ?, slug = ?, province = ?, city = ?, start_date = ?, end_date = ?,
         event_status = 'completed', result_status = 'extended_complete', result_source_note = ?, status = 'published'
     WHERE event_id = ?`,
    [
      event.name || '2024中国桨板冠军赛苏州站',
      event.slug || 'china-sup-championship-suzhou-2024',
      event.province || '江苏省',
      event.city || '苏州市',
      event.start_date || '2024-09-21',
      event.end_date || '2024-09-22',
      '扫描版成绩总结册第53页后OCR重解析；团队接力页跳过，仅录入个人成绩。',
      EVENT_ID,
    ]
  );
  await connection.execute(
    `UPDATE sup_events
     SET status = 'draft', result_status = 'partial', result_source_note = '重复赛事记录：正确来源与成绩已合并到 event_id=239'
     WHERE event_id = ?`,
    [DUPLICATE_EVENT_ID]
  );
  await connection.execute(
    `UPDATE sup_event_result_sources
     SET event_id = ?, original_path = ?, file_name = ?, file_type = 'pdf', source_url = ?, parser_name = ?,
         parser_status = 'imported', parser_note = ?, extracted_rows = ?, imported_rows = ?, metadata = ?
     WHERE source_id = ?`,
    [
      EVENT_ID,
      payload.source.original_path || null,
      payload.source.file_name,
      payload.source.source_url || null,
      payload.source.parser_name,
      payload.source.parser_note || null,
      payload.results.length,
      payload.results.length,
      JSON.stringify(payload.source.metadata || {}),
      SOURCE_ID,
    ]
  );
  await connection.execute(
    `UPDATE sup_event_result_sources
     SET event_id = NULL, parser_status = 'failed', parser_note = '错误挂接：云和站成绩册曾污染苏州站，已从 event_id=239 解绑'
     WHERE source_id = ?`,
    [WRONG_SOURCE_ID]
  );
}

async function insertResults(connection, payload, athleteCache, touchedAthletes) {
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
        SOURCE_ID,
        payload.source.file_name,
        result.source_locator || null,
        payload.source.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' ? result.parse_confidence : 0.8,
        result.review_status || 'confirmed'
      );
    }
    await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);
  }
}

function summarize(payload) {
  const grouped = new Map();
  for (const row of payload.results) {
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
  if (!Array.isArray(payload.results) || !payload.results.length) throw new Error('input has no results');
  if (Number(payload.event?.event_id) !== EVENT_ID) throw new Error(`unexpected event_id: ${payload.event?.event_id}`);
  console.log(`Loaded ${payload.results.length} results from ${args.input}`);
  for (const [key, count] of summarize(payload)) console.log(`${String(count).padStart(4, ' ')}  ${key}`);
  console.log('Skipped pages:', JSON.stringify(payload.source?.metadata?.skipped_pages || {}));
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
  const touchedAthletes = new Set(await collectCurrentAthleteIds(connection));
  try {
    await connection.beginTransaction();
    await updateEventAndSources(connection, payload);
    await connection.execute('DELETE FROM sup_event_results WHERE event_id IN (?, ?)', [EVENT_ID, DUPLICATE_EVENT_ID]);
    await insertResults(connection, payload, athleteCache, touchedAthletes);
    await connection.commit();
    for (const group of chunk([...touchedAthletes], ATHLETE_SYNC_BATCH_SIZE)) {
      await syncAthleteRaceTimesBatch(connection, group);
    }
    console.log(`Imported ${payload.results.length} rows for event ${EVENT_ID}; synced ${touchedAthletes.size} athletes.`);
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
