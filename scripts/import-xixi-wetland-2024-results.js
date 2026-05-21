#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const RESULT_BATCH_SIZE = 120;
const ATHLETE_SYNC_BATCH_SIZE = 200;

const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
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
  console.log('Usage: node scripts/import-xixi-wetland-2024-results.js --input .cache/xixi-wetland-2024-results.json [--dry-run]');
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

function slugify(name, startDate) {
  const ascii = String(name || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  if (ascii) return ascii.slice(0, 120);
  const hash = crypto.createHash('sha1').update(`${startDate || ''}:${name}`).digest('hex').slice(0, 10);
  return `local-race-${String(startDate || 'unknown').replaceAll('-', '')}-${hash}`;
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
  const match = raw.match(/^(\d+):(\d{2})'(\d{2})"(\d{2})$/);
  if (!match) return null;
  const [, hours, minutes, seconds, hundredths] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(hundredths) / 100;
}

async function upsertEvent(connection, event) {
  const name = String(event.name || '').trim();
  const startDate = event.start_date || null;
  const slug = event.slug || slugify(name, startDate);
  const [existing] = await connection.execute(
    `SELECT event_id FROM sup_events
     WHERE slug = ? OR (name = ? AND (start_date <=> ?))
     ORDER BY CASE WHEN slug = ? THEN 0 ELSE 1 END, event_id ASC LIMIT 1`,
    [slug, name, startDate, slug]
  );
  if (existing.length) {
    const eventId = Number(existing[0].event_id);
    await connection.execute(
      `UPDATE sup_events
       SET name = ?, slug = ?, event_type = 'race', province = ?, city = ?, venue = ?,
           start_date = ?, end_date = ?, source_scope = ?, result_status = 'extended_complete',
           result_source_note = ?, result_last_verified_at = NOW(), status = 'published', event_status = 'completed'
       WHERE event_id = ?`,
      [
        name,
        slug,
        event.province || null,
        event.city || null,
        event.venue || null,
        startDate,
        event.end_date || startDate,
        event.source_scope || '本地成绩册导入',
        event.result_source_note || '西溪湿地桨板成绩导入',
        eventId,
      ]
    );
    return eventId;
  }

  const [inserted] = await connection.execute(
    `INSERT INTO sup_events
      (name, slug, event_type, province, city, venue, start_date, end_date, source_scope,
       result_status, result_source_note, result_last_verified_at, status, event_status)
     VALUES (?, ?, 'race', ?, ?, ?, ?, ?, ?, 'extended_complete', ?, NOW(), 'published', 'completed')`,
    [
      name,
      slug,
      event.province || null,
      event.city || null,
      event.venue || null,
      startDate,
      event.end_date || startDate,
      event.source_scope || '本地成绩册导入',
      event.result_source_note || '西溪湿地桨板成绩导入',
    ]
  );
  return Number(inserted.insertId);
}

async function upsertSource(connection, eventId, source) {
  const [existing] = await connection.execute(
    `SELECT source_id FROM sup_event_result_sources
     WHERE event_id = ? AND ((original_path IS NOT NULL AND original_path = ?) OR (file_name = ? AND COALESCE(source_url, '') = COALESCE(?, '')))
     ORDER BY source_id ASC LIMIT 1`,
    [eventId, source.original_path || null, source.file_name, source.source_url || null]
  );
  if (existing.length) {
    const sourceId = Number(existing[0].source_id);
    await connection.execute(
      `UPDATE sup_event_result_sources
       SET original_path = ?, file_name = ?, file_type = ?, source_url = ?, parser_name = ?,
           parser_status = 'imported', parser_note = ?, extracted_rows = ?, reviewed_rows = ?,
           imported_rows = ?, metadata = ?, updated_at = NOW()
       WHERE source_id = ?`,
      [
        source.original_path || null,
        source.file_name,
        source.file_type || 'pdf',
        source.source_url || null,
        source.parser_name,
        source.parser_note || null,
        Number(source.extracted_rows || 0),
        Number(source.imported_rows || source.extracted_rows || 0),
        Number(source.imported_rows || source.extracted_rows || 0),
        JSON.stringify(source.metadata || {}),
        sourceId,
      ]
    );
    return sourceId;
  }
  const [inserted] = await connection.execute(
    `INSERT INTO sup_event_result_sources
      (event_id, original_path, file_name, file_type, source_url, parser_name, parser_status,
       parser_note, extracted_rows, reviewed_rows, imported_rows, metadata)
     VALUES (?, ?, ?, ?, ?, ?, 'imported', ?, ?, ?, ?, ?)`,
    [
      eventId,
      source.original_path || null,
      source.file_name,
      source.file_type || 'pdf',
      source.source_url || null,
      source.parser_name,
      source.parser_note || null,
      Number(source.extracted_rows || 0),
      Number(source.imported_rows || source.extracted_rows || 0),
      Number(source.imported_rows || source.extracted_rows || 0),
      JSON.stringify(source.metadata || {}),
    ]
  );
  return Number(inserted.insertId);
}

async function resolveAthleteId(connection, item, athleteCache) {
  const name = String(item.athlete_name_snapshot || '').trim();
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
        existingRows.length > 1 ? '西溪湿地导入发现同名候选，需后台确认' : '西溪湿地导入自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [inserted] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由2024西溪湿地皮划艇桨板马拉松挑战赛成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(inserted.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'confirmed', '西溪湿地导入自动创建草稿运动员')`,
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

async function insertResults(connection, eventId, payload, sourceId, athleteCache, touchedAthletes) {
  const source = payload.source || {};
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
        eventId,
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
        typeof result.time_seconds === 'number' ? result.time_seconds : parseTimeToSeconds(result.finish_time),
        typeof result.points === 'number' && Number.isFinite(result.points) ? result.points : null,
        result.team_name || '个人',
        sourceId,
        source.file_name,
        result.source_locator || null,
        source.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' ? result.parse_confidence : 0.99,
        result.review_status || 'confirmed'
      );
    }
    await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);
  }
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

function summarize(payload) {
  const byModule = new Map();
  const statuses = new Map();
  for (const row of payload.results) {
    const moduleKey = `${row.gender_group} · ${row.discipline}`;
    byModule.set(moduleKey, (byModule.get(moduleKey) || 0) + 1);
    statuses.set(row.result_status_code || 'OK', (statuses.get(row.result_status_code || 'OK') || 0) + 1);
  }
  return {
    byModule: [...byModule.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans')),
    statuses: [...statuses.entries()],
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  if (!payload.source) throw new Error('input must include source');
  if (!Array.isArray(payload.results) || !payload.results.length) throw new Error('input has no results');

  const summary = summarize(payload);
  console.log(`Loaded ${payload.results.length} results from ${args.input}`);
  for (const [key, count] of summary.byModule) console.log(`${String(count).padStart(4, ' ')}  ${key}`);
  for (const [key, count] of summary.statuses) console.log(`${String(count).padStart(4, ' ')}  status:${key}`);

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
  let eventId = 0;
  try {
    await connection.beginTransaction();
    eventId = await upsertEvent(connection, payload.event || {});
    for (const id of await collectCurrentAthleteIds(connection, eventId)) touchedAthletes.add(id);
    const sourceId = await upsertSource(connection, eventId, payload.source);
    await connection.execute(
      `DELETE erm FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE er.event_id = ?`,
      [eventId]
    );
    await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [eventId]);
    await insertResults(connection, eventId, payload, sourceId, athleteCache, touchedAthletes);

    if (args.dryRun) {
      await connection.rollback();
      console.log(JSON.stringify({ dryRun: true, eventId, rows: payload.results.length, touchedAthletes: touchedAthletes.size }, null, 2));
    } else {
      await connection.commit();
      for (const group of chunk([...touchedAthletes], ATHLETE_SYNC_BATCH_SIZE)) await syncAthleteRaceTimesBatch(connection, group);
      console.log(JSON.stringify({ imported: payload.results.length, eventId, touchedAthletes: touchedAthletes.size }, null, 2));
    }
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors.
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
