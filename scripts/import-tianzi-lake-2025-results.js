#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 14;
const DUPLICATE_EVENT_ID = 295;
const RESULT_BATCH_SIZE = 120;
const MEMBER_BATCH_SIZE = 300;
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
  console.log('Usage: node scripts/import-tianzi-lake-2025-results.js --input /private/tmp/tianzi-lake-2025-results.json [--dry-run]');
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

function normalizeTeamMembers(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
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
        existingRows.length > 1 ? '天子湖重导发现同名候选，需后台确认' : '天子湖重导自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [inserted] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由2025中国桨板超级联赛暨第四届天子湖桨板公开赛成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(inserted.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'confirmed', '天子湖重导自动创建草稿运动员')`,
    [athleteId, key, name, item.gender_group || null, item.team_name || null]
  );
  athleteCache.set(key, athleteId);
  return athleteId;
}

async function collectCurrentAthleteIds(connection) {
  const [rows] = await connection.execute(
    `SELECT DISTINCT athlete_id FROM (
       SELECT athlete_id FROM sup_event_results WHERE event_id IN (?, ?) AND athlete_id IS NOT NULL
       UNION
       SELECT erm.athlete_id FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE er.event_id IN (?, ?) AND erm.athlete_id IS NOT NULL
     ) linked`,
    [EVENT_ID, DUPLICATE_EVENT_ID, EVENT_ID, DUPLICATE_EVENT_ID]
  );
  return rows.map((row) => Number(row.athlete_id)).filter(Number.isFinite);
}

async function syncAthleteRaceTimesBatch(connection, athleteIds) {
  const ids = [...new Set(athleteIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.execute(
    `SELECT DISTINCT linked.athlete_id, er.discipline, er.round_label, er.result_label, er.finish_time,
            er.result_status_code, er.result_status_note, er.rank_position, e.start_date, e.event_id, e.name AS event_name
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

async function updateCanonicalEvent(connection, event, sourceCount, resultsCount) {
  await connection.execute(
    `UPDATE sup_events
     SET name = ?, slug = ?, province = ?, city = ?, venue = ?, start_date = ?, end_date = ?,
         event_status = 'completed', result_status = 'extended_complete',
         result_source_note = ?, result_last_verified_at = NOW(), status = 'published'
     WHERE event_id = ?`,
    [
      event.name,
      event.slug,
      event.province || '湖南省',
      event.city || '邵阳市',
      event.venue || '邵阳·天子湖',
      event.start_date || '2025-08-30',
      event.end_date || '2025-08-31',
      `本地${sourceCount}份PDF成绩册重解析导入，共${resultsCount}条成绩；仅导入成绩，不导入积分。`,
      EVENT_ID,
    ]
  );
}

async function upsertSource(connection, payload, importedRows) {
  const source = payload.source || {};
  const [existing] = await connection.execute(
    `SELECT source_id FROM sup_event_result_sources
     WHERE event_id = ? AND original_path = ?
     ORDER BY source_id ASC LIMIT 1`,
    [EVENT_ID, source.original_path || null]
  );
  const params = [
    EVENT_ID,
    source.original_path || null,
    source.file_name,
    source.source_url || null,
    source.parser_name || 'parse-tianzi-lake-2025-results.py',
    'imported',
    source.parser_note || null,
    Number(source.extracted_rows || importedRows || 0),
    importedRows,
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

async function insertResults(connection, payload, sourceId, athleteCache, touchedAthletes) {
  const source = payload.source || {};
  const insertedRows = [];
  const results = Array.isArray(payload.results) ? payload.results : [];
  const sqlPrefix = `INSERT INTO sup_event_results (
    event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
    rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name, nationality_snapshot,
    source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified
  ) VALUES `;
  const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "中国", "official", ?, ?, ?, ?, ?, ?, ?, 1)';
  for (const group of chunk(results, RESULT_BATCH_SIZE)) {
    const values = [];
    for (const result of group) {
      const members = normalizeTeamMembers(result.team_members);
      const athleteId = members.length ? null : await resolveAthleteId(connection, result, athleteCache);
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
        result.source_title || source.file_name,
        result.source_locator || null,
        result.source_url || source.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' ? result.parse_confidence : 0.95,
        result.review_status || 'confirmed'
      );
    }
    const [inserted] = await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);
    const firstId = Number(inserted.insertId);
    for (let offset = 0; offset < group.length; offset += 1) insertedRows.push({ resultId: firstId + offset, item: group[offset] });
  }
  return insertedRows;
}

async function insertMembers(connection, insertedRows, athleteCache, touchedAthletes) {
  const rows = [];
  for (const row of insertedRows) {
    const members = normalizeTeamMembers(row.item.team_members);
    for (let index = 0; index < members.length; index += 1) {
      const memberName = members[index];
      const athleteId = await resolveAthleteId(connection, { ...row.item, athlete_name_snapshot: memberName }, athleteCache);
      if (athleteId) touchedAthletes.add(athleteId);
      rows.push([row.resultId, athleteId, memberName, index + 1]);
    }
  }
  for (const group of chunk(rows, MEMBER_BATCH_SIZE)) {
    await connection.execute(
      `INSERT INTO sup_event_result_members (result_id, athlete_id, member_name, member_order)
       VALUES ${group.map(() => '(?, ?, ?, ?)').join(',')}`,
      group.flat()
    );
  }
}

function summarize(payloads) {
  const grouped = new Map();
  for (const payload of payloads) {
    for (const row of payload.results || []) {
      const key = `${row.discipline} · ${row.gender_group} · ${row.board_class || '-'} · ${row.round_label || '-'}`;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }
  }
  return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans'));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payloads = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  if (!Array.isArray(payloads) || !payloads.length) throw new Error('input has no payloads');
  if (payloads.some((payload) => Number(payload.event?.event_id) !== EVENT_ID)) throw new Error('input contains unexpected event_id');
  const totalResults = payloads.reduce((sum, payload) => sum + (Array.isArray(payload.results) ? payload.results.length : 0), 0);

  console.log(`Loaded ${payloads.length} sources and ${totalResults} results from ${args.input}`);
  console.log(`Team result rows: ${payloads.flatMap((payload) => payload.results || []).filter((row) => normalizeTeamMembers(row.team_members).length).length}`);
  for (const payload of payloads) console.log(`${String((payload.results || []).length).padStart(4, ' ')}  ${payload.source?.file_name || '-'}`);
  for (const [key, count] of summarize(payloads)) console.log(`${String(count).padStart(4, ' ')}  ${key}`);
  if (args.dryRun) return;

  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || env.DB_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || env.DB_PORT || 3306),
    user: env.MYSQL_USER || env.DB_USER || 'root',
    password: env.MYSQL_PASSWORD || env.DB_PASSWORD || '',
    database: env.MYSQL_DATABASE || env.DB_NAME || 'sport_hacker',
    charset: 'utf8mb4',
    multipleStatements: false,
  });

  const athleteCache = new Map();
  const touchedAthletes = new Set();
  try {
    for (const id of await collectCurrentAthleteIds(connection)) touchedAthletes.add(id);
    await connection.beginTransaction();
    await updateCanonicalEvent(connection, payloads[0].event || {}, payloads.length, totalResults);
    await connection.execute('DELETE FROM sup_event_point_standings WHERE event_id IN (?, ?)', [EVENT_ID, DUPLICATE_EVENT_ID]);
    await connection.execute('DELETE FROM sup_event_results WHERE event_id IN (?, ?)', [EVENT_ID, DUPLICATE_EVENT_ID]);
    await connection.execute('UPDATE sup_event_result_sources SET event_id = NULL, imported_rows = 0 WHERE event_id IN (?, ?)', [EVENT_ID, DUPLICATE_EVENT_ID]);

    for (let index = 0; index < payloads.length; index += 1) {
      const payload = payloads[index];
      const results = Array.isArray(payload.results) ? payload.results : [];
      const sourceId = await upsertSource(connection, payload, results.length);
      const insertedRows = await insertResults(connection, payload, sourceId, athleteCache, touchedAthletes);
      await insertMembers(connection, insertedRows, athleteCache, touchedAthletes);
      console.log(`batch ${index + 1}/${payloads.length} source=${payload.source?.file_name || '-'} rows=${results.length}`);
    }

    await connection.execute(
      `UPDATE sup_events
       SET status = 'draft', result_status = 'none', result_source_note = CONCAT(COALESCE(result_source_note, ''), '；已合并到 event_id=14')
       WHERE event_id = ?`,
      [DUPLICATE_EVENT_ID]
    );
    await connection.commit();

    const touched = [...touchedAthletes];
    for (const group of chunk(touched, ATHLETE_SYNC_BATCH_SIZE)) await syncAthleteRaceTimesBatch(connection, group);
    console.log(`Imported ${totalResults} rows from ${payloads.length} sources for event ${EVENT_ID}; synced ${touched.length} athletes; duplicate event ${DUPLICATE_EVENT_ID} drafted.`);
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
