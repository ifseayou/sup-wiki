#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
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
  console.log('Usage: node scripts/import-qianshan-2025-results.js --input /tmp/qianshan-2025-results.json [--dry-run]');
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

function normalizeMembers(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
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

async function findEventId(connection, payload) {
  const event = payload.event || {};
  const [slugRows] = await connection.execute('SELECT event_id FROM sup_events WHERE slug = ? LIMIT 1', [event.slug]);
  if (slugRows.length) return Number(slugRows[0].event_id);
  const [nameRows] = await connection.execute(
    `SELECT event_id FROM sup_events
     WHERE (name LIKE '%潜山%' AND name LIKE '%2025%' AND name LIKE '%百城%')
        OR name = ?
     ORDER BY event_id ASC LIMIT 1`,
    [event.name]
  );
  return nameRows.length ? Number(nameRows[0].event_id) : null;
}

async function createEvent(connection, payload) {
  const event = payload.event || {};
  const [inserted] = await connection.execute(
    `INSERT INTO sup_events (
      name, slug, event_type, location, province, city, venue, start_date, end_date,
      description, requirements, disciplines, star_level, score_coefficient, source_scope,
      result_status, result_source_note, status, event_status
    ) VALUES (?, ?, 'race', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'completed')`,
    [
      event.name,
      event.slug,
      `${event.province || ''}${event.city || ''}${event.venue || ''}` || null,
      event.province || '浙江省',
      event.city || '丽水市',
      event.venue || '云和',
      event.start_date || '2024-11-08',
      event.end_date || '2024-11-10',
      '2025中国百城桨板公开赛潜山站，包含长距离、200米竞速和龙板项目成绩。',
      '参赛组别、器材与晋级规则以官方成绩册为准。',
      JSON.stringify(['6公里长距离赛', '3公里长距离赛', '200米竞速赛', '1公里龙板赛', '200米龙板赛']),
      event.star_level || '五星 / 5.0',
      Number(event.score_coefficient || 5.0),
      '官方本地成绩册',
      event.result_status || 'extended_complete',
      event.result_source_note || null,
    ]
  );
  return Number(inserted.insertId);
}

async function resolveEventId(connection, payload) {
  const existing = await findEventId(connection, payload);
  return existing || createEvent(connection, payload);
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
        existingRows.length > 1 ? '2025潜山站导入发现同名候选，需后台确认' : '2025潜山站导入自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [inserted] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由2024中国桨板超级联赛潜山站成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(inserted.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'confirmed', '2025潜山站导入自动创建草稿运动员')`,
    [athleteId, key, name, item.gender_group || null, item.team_name || null]
  );
  athleteCache.set(key, athleteId);
  return athleteId;
}

async function collectCurrentAthleteIds(connection, eventId, sourceId) {
  const [rows] = await connection.execute(
    `SELECT DISTINCT athlete_id FROM (
       SELECT athlete_id FROM sup_event_results WHERE (event_id = ? OR source_id = ?) AND athlete_id IS NOT NULL
       UNION
       SELECT erm.athlete_id FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE (er.event_id = ? OR er.source_id = ?) AND erm.athlete_id IS NOT NULL
     ) linked`,
    [eventId, sourceId, eventId, sourceId]
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

async function updateEvent(connection, eventId, payload) {
  const event = payload.event || {};
  await connection.execute(
    `UPDATE sup_events
     SET name = ?, slug = ?, province = ?, city = ?, venue = ?, start_date = ?, end_date = ?,
         event_status = 'completed', result_status = 'extended_complete',
         star_level = ?, score_coefficient = ?, result_source_note = ?,
         result_last_verified_at = NOW(), status = 'published'
     WHERE event_id = ?`,
    [
      event.name,
      event.slug,
      event.province,
      event.city,
      event.venue,
      event.start_date,
      event.end_date,
      event.star_level || '五星 / 5.0',
      Number(event.score_coefficient || 5.0),
      event.result_source_note,
      eventId,
    ]
  );
}

async function upsertSource(connection, eventId, payload) {
  const source = payload.source || {};
  const results = Array.isArray(payload.results) ? payload.results : [];
  const [existing] = await connection.execute(
    `SELECT source_id FROM sup_event_result_sources
     WHERE source_id = ? OR original_path = ?
     ORDER BY CASE WHEN source_id = ? THEN 0 ELSE 1 END, source_id ASC
     LIMIT 1`,
    [source.source_id || 0, source.original_path || null, source.source_id || 0]
  );
  const params = [
    eventId,
    source.original_path || null,
    source.file_name,
    source.source_url || null,
    source.parser_name || 'parse-yunhe-2024-results.py',
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
  const insertedRows = [];
  const sqlPrefix = `INSERT INTO sup_event_results (
    event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
    rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name, nationality_snapshot,
    source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified
  ) VALUES `;
  const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "中国", "official", ?, ?, ?, ?, ?, ?, ?, 1)';
  for (const group of chunk(rows, RESULT_BATCH_SIZE)) {
    const values = [];
    for (const row of group) {
      const members = normalizeMembers(row.team_members);
      const athleteId = members.length ? null : await resolveAthleteId(connection, row, athleteCache);
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
        typeof row.points === 'number' && Number.isFinite(row.points) ? row.points : null,
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
    const [inserted] = await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);
    const firstId = Number(inserted.insertId);
    for (let offset = 0; offset < group.length; offset += 1) insertedRows.push({ resultId: firstId + offset, item: group[offset] });
  }
  return insertedRows;
}

async function insertMembers(connection, insertedRows, athleteCache, touchedAthletes) {
  const rows = [];
  for (const row of insertedRows) {
    const members = normalizeMembers(row.item.team_members);
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
  return rows.length;
}

function duplicateRankIssues(rows) {
  const counts = new Map();
  for (const row of rows) {
    const rank = Number(row.rank_position);
    if (!Number.isFinite(rank) || rank >= 9000) continue;
    if (row.result_label) continue;
    const key = `${row.discipline}|${row.gender_group}|${row.board_class || ''}|${row.round_label || ''}|${rank}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

function summarize(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.discipline} · ${row.gender_group} · ${row.board_class || '-'} · ${row.round_label || '-'}`;
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
  const rankIssues = duplicateRankIssues(rows);
  if (rankIssues.length) throw new Error(`duplicate rank issues in input: ${JSON.stringify(rankIssues.slice(0, 10))}`);

  console.log(`Loaded ${rows.length} results from ${args.input}`);
  console.log(`Team result rows: ${rows.filter((row) => normalizeMembers(row.team_members).length).length}`);
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
    eventId = await resolveEventId(connection, payload);
    const sourceIdHint = Number(payload.source?.source_id || 0);
    for (const id of await collectCurrentAthleteIds(connection, eventId, sourceIdHint)) touchedAthletes.add(id);
    await connection.beginTransaction();
    await updateEvent(connection, eventId, payload);
    await connection.execute('DELETE FROM sup_event_point_standings WHERE event_id = ?', [eventId]);
    await connection.execute(
      `DELETE erm FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE er.event_id = ? OR er.source_id = ?`,
      [eventId, sourceIdHint]
    );
    await connection.execute('DELETE FROM sup_event_results WHERE event_id = ? OR source_id = ?', [eventId, sourceIdHint]);
    await connection.execute('UPDATE sup_event_result_sources SET event_id = NULL, imported_rows = 0 WHERE event_id = ?', [eventId]);
    const sourceId = await upsertSource(connection, eventId, payload);
    const insertedRows = await insertResults(connection, eventId, sourceId, payload, athleteCache, touchedAthletes);
    const memberCount = await insertMembers(connection, insertedRows, athleteCache, touchedAthletes);
    await connection.commit();

    const touched = [...touchedAthletes];
    for (const group of chunk(touched, ATHLETE_SYNC_BATCH_SIZE)) await syncAthleteRaceTimesBatch(connection, group);
    console.log(`Imported ${rows.length} rows for event ${eventId}; source=${sourceId}; team_members=${memberCount}; synced ${touched.length} athletes.`);
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
