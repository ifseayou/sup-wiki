#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const RESULT_BATCH_SIZE = 100;
const EVENT_NAME = '2024年亚洲桨板锦标赛暨中国黄石（国际）桨板邀请赛';
const EVENT_SLUG = 'asian-sup-championship-huangshi-2024';
const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
  DNQ: '未晋级',
  OTL: '超过关门时间',
};

function usage() {
  console.log('Usage: node scripts/import-huangshi-2024-results.js --input .cache/huangshi-2024-results.json [--dry-run]');
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

function normalizeMembers(value) {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  return String(value || '').split(/[\n,，、;；/]+/).map((item) => item.trim()).filter(Boolean);
}

function statusCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return STATUS_LABELS[code] ? code : null;
}

function parseTimeToSeconds(input) {
  const raw = String(input || '').trim();
  if (!raw || statusCode(raw)) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const parts = raw.split(':').map((part) => part.trim());
  if (parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return null;
}

async function findEventId(connection) {
  const [exactRows] = await connection.execute(
    `SELECT event_id, name FROM sup_events
     WHERE name = ? OR slug = ?
     ORDER BY event_id ASC LIMIT 1`,
    [EVENT_NAME, EVENT_SLUG]
  );
  if (exactRows.length) return Number(exactRows[0].event_id);

  const [fuzzyRows] = await connection.execute(
    `SELECT event_id, name FROM sup_events
     WHERE name LIKE '%亚洲桨板锦标赛%' AND (name LIKE '%黄石%' OR city LIKE '%黄石%')
     ORDER BY event_id ASC LIMIT 1`
  );
  if (fuzzyRows.length) return Number(fuzzyRows[0].event_id);

  return null;
}

async function createEvent(connection, payload) {
  const event = payload.event || {};
  const [inserted] = await connection.execute(
    `INSERT INTO sup_events (
      name, name_en, slug, event_type, location, province, city, venue,
      start_date, end_date, organizer, description, requirements, disciplines,
      star_level, score_coefficient, source_scope, result_status, status, event_status
    ) VALUES (?, ?, ?, 'race', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '五星+', 5.5, '亚洲级锦标赛官方成绩册', 'none', 'published', 'completed')`,
    [
      EVENT_NAME,
      '2024 Asian SUP Championship & China Huangshi International SUP Invitational',
      EVENT_SLUG,
      '湖北省黄石市',
      event.province || '湖北省',
      event.city || '黄石市',
      event.venue || '湖北黄石',
      event.start_date || '2024-10-03',
      event.end_date || '2024-10-06',
      '亚洲桨板相关赛事组织、黄石地方承办单位',
      '2024年亚洲桨板锦标赛暨中国黄石（国际）桨板邀请赛，包含长距离、技巧赛、冲刺赛及多个年龄/公开/大师/卡胡纳组别。',
      '参赛组别、器材与晋级规则以官方成绩册和竞赛规程为准。',
      JSON.stringify(['12KM长距离赛', '6KM技巧赛', '200M冲刺赛', '1.5KM充气板技巧赛', '公开组', 'U16组', 'U18组', '大师组', '卡胡纳组']),
    ]
  );
  return Number(inserted.insertId);
}

async function resolveEventId(connection, payload) {
  const eventId = await findEventId(connection);
  if (eventId) return eventId;
  return createEvent(connection, payload);
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        athleteId,
        key,
        name,
        item.gender_group || null,
        item.team_name || null,
        item.nationality_snapshot || '中国',
        existingRows.length > 1 ? 0.5 : 0.9,
        existingRows.length > 1 ? 'pending' : 'confirmed',
        existingRows.length > 1 ? '2024黄石亚洲锦标赛导入发现同名候选，需后台确认' : '2024黄石亚洲锦标赛导入自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, ?, 'race', '由2024年亚洲桨板锦标赛暨中国黄石（国际）桨板邀请赛成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name, item.nationality_snapshot || '中国']
  );
  const athleteId = Number(insertResult.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, ?, 0.85, 'confirmed', '2024黄石亚洲锦标赛导入自动创建草稿运动员')`,
    [athleteId, key, name, item.gender_group || null, item.team_name || null, item.nationality_snapshot || '中国']
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
      rank: row.rank_position < 9000 ? row.rank_position : undefined,
    });
  }
  for (const [athleteId, raceTimes] of grouped.entries()) {
    await connection.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
  }
}

async function upsertSource(connection, eventId, payload) {
  const source = payload.source || {};
  const parserName = source.parser_name || 'parse-huangshi-2024-results.py';
  const fileName = source.file_name || '成绩汇总.pdf';
  const [existing] = await connection.execute(
    `SELECT source_id FROM sup_event_result_sources
     WHERE event_id = ? AND parser_name = ? AND file_name = ?
     ORDER BY source_id ASC LIMIT 1`,
    [eventId, parserName, fileName]
  );
  if (existing.length) {
    const sourceId = Number(existing[0].source_id);
    await connection.execute(
      `UPDATE sup_event_result_sources
       SET original_path = ?, file_type = 'pdf', source_url = ?, parser_status = 'imported',
           parser_note = ?, extracted_rows = ?, imported_rows = ?, metadata = ?
       WHERE source_id = ?`,
      [
        source.original_path || null,
        source.source_url || null,
        source.parser_note || null,
        payload.results.length,
        payload.results.length,
        JSON.stringify(source.metadata || {}),
        sourceId,
      ]
    );
    return sourceId;
  }

  const [inserted] = await connection.execute(
    `INSERT INTO sup_event_result_sources
      (event_id, original_path, file_name, file_type, source_url, parser_name, parser_status, parser_note, extracted_rows, imported_rows, metadata)
     VALUES (?, ?, ?, 'pdf', ?, ?, 'imported', ?, ?, ?, ?)`,
    [
      eventId,
      source.original_path || null,
      fileName,
      source.source_url || null,
      parserName,
      source.parser_note || null,
      payload.results.length,
      payload.results.length,
      JSON.stringify(source.metadata || {}),
    ]
  );
  return Number(inserted.insertId);
}

async function insertResults(connection, eventId, payload, sourceId, athleteCache, touchedAthletes) {
  const sqlPrefix = `INSERT INTO sup_event_results (
    event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
    rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name, nationality_snapshot,
    source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified
  ) VALUES `;
  const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "official", ?, ?, ?, ?, ?, ?, ?, 1)';

  for (const group of chunk(payload.results, RESULT_BATCH_SIZE)) {
    const values = [];
    const memberTasks = [];
    for (const result of group) {
      const members = normalizeMembers(result.team_members);
      const isTeam = members.length > 0;
      const athleteId = isTeam ? null : await resolveAthleteId(connection, result, athleteCache);
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
        result.nationality_snapshot || '中国',
        sourceId,
        payload.source.file_name,
        result.source_locator || null,
        payload.source.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' ? result.parse_confidence : 1,
        result.review_status || 'confirmed'
      );
      if (isTeam) memberTasks.push({ ...result, team_members: members });
    }

    await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);

    for (const result of memberTasks) {
      const [idRows] = await connection.execute(
        `SELECT result_id FROM sup_event_results
         WHERE event_id = ? AND gender_group = ? AND discipline = ? AND round_label = ? AND rank_position = ? AND athlete_name_snapshot = ?
         LIMIT 1`,
        [eventId, result.gender_group || '公开组', result.discipline, result.round_label || null, Number(result.rank_position), result.athlete_name_snapshot]
      );
      const resultId = Number(idRows[0]?.result_id || 0);
      if (!resultId) continue;
      for (let index = 0; index < result.team_members.length; index += 1) {
        const memberName = result.team_members[index];
        const athleteId = await resolveAthleteId(connection, { ...result, athlete_name_snapshot: memberName }, athleteCache);
        if (athleteId) touchedAthletes.add(athleteId);
        await connection.execute(
          `INSERT INTO sup_event_result_members (result_id, athlete_id, member_name, member_order)
           VALUES (?, ?, ?, ?)`,
          [resultId, athleteId || null, memberName, index]
        );
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  if (!Array.isArray(payload.results)) throw new Error('Invalid payload: results must be an array');
  console.log(`payload results=${payload.results.length}`);

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
    let eventId = await findEventId(connection);
    if (!eventId && args.dryRun) {
      console.log(`target event=not found; dry-run would create event="${EVENT_NAME}" and import results=${payload.results.length}`);
      return;
    }
    if (!eventId) eventId = await createEvent(connection, payload);
    const [eventRows] = await connection.execute('SELECT event_id, name, result_status FROM sup_events WHERE event_id = ? LIMIT 1', [eventId]);
    if (!eventRows.length) throw new Error(`event_id=${eventId} not found`);
    const [countRows] = await connection.execute('SELECT COUNT(*) AS count FROM sup_event_results WHERE event_id = ?', [eventId]);
    console.log(`target event_id=${eventId} event=${eventRows[0].name} old_results=${countRows[0].count}`);
    if (args.dryRun) {
      console.log(`dry-run would replace event_id=${eventId} with results=${payload.results.length}`);
      return;
    }

    const [oldAthletes] = await connection.execute(
      `SELECT athlete_id FROM sup_event_results WHERE event_id = ? AND athlete_id IS NOT NULL
       UNION
       SELECT erm.athlete_id
       FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE er.event_id = ? AND erm.athlete_id IS NOT NULL`,
      [eventId, eventId]
    );
    oldAthletes.forEach((row) => touchedAthletes.add(Number(row.athlete_id)));

    await connection.beginTransaction();
    const sourceId = await upsertSource(connection, eventId, payload);
    await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [eventId]);
    await insertResults(connection, eventId, payload, sourceId, athleteCache, touchedAthletes);
    await connection.execute(
      `UPDATE sup_events
       SET name = ?, province = ?, city = ?, venue = ?, start_date = ?, end_date = ?,
           result_status = 'extended_complete',
           result_source_note = '已按2024年亚洲桨板锦标赛暨中国黄石（国际）桨板邀请赛成绩汇总PDF第22页至最后一页文本解析导入完整成绩。',
           result_source_links = JSON_ARRAY(JSON_OBJECT('title', ?, 'url', ?)),
           result_last_verified_at = NOW(),
           status = 'published',
           event_status = 'completed'
       WHERE event_id = ?`,
      [
        EVENT_NAME,
        payload.event?.province || '湖北省',
        payload.event?.city || '黄石市',
        payload.event?.venue || '湖北黄石',
        payload.event?.start_date || '2024-10-03',
        payload.event?.end_date || '2024-10-06',
        payload.source.file_name,
        payload.source.source_url,
        eventId,
      ]
    );
    await connection.execute(
      'UPDATE sup_event_result_sources SET imported_rows = ?, extracted_rows = ?, parser_status = "imported" WHERE source_id = ?',
      [payload.results.length, payload.results.length, sourceId]
    );
    await connection.commit();

    const ids = [...touchedAthletes].filter(Number.isFinite);
    for (const group of chunk(ids, RESULT_BATCH_SIZE)) {
      await syncAthleteRaceTimesBatch(connection, group);
    }
    console.log(`done event_id=${eventId} results=${payload.results.length} touchedAthletes=${ids.length}`);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure if no transaction is active.
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
