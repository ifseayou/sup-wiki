#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 297;
const RESULT_BATCH_SIZE = 100;
const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
  DNQ: '未晋级',
  OTL: '超过关门时间',
};

function usage() {
  console.log('Usage: node scripts/import-changzhou-2025-results.js --input .cache/changzhou-2025-results.json [--dry-run]');
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

function parseTimeToSeconds(input) {
  const raw = String(input || '').trim();
  if (!raw || STATUS_LABELS[raw.toUpperCase()]) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const dottedTime = raw.match(/^(\d+):(\d{2})\.(\d{1,2})$/);
  if (dottedTime) return Number(dottedTime[1]) * 60 + Number(`${dottedTime[2]}.${dottedTime[3]}`);
  const parts = raw.split(':').map((part) => part.trim());
  if (parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return null;
}

function statusCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return STATUS_LABELS[code] ? code : null;
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
        item.gender_group || item.group_name || null,
        item.team_name || null,
        existingRows.length > 1 ? 0.5 : 0.9,
        existingRows.length > 1 ? 'pending' : 'confirmed',
        existingRows.length > 1 ? '常州站重导发现同名候选，需后台确认' : '常州站重导自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由常州站成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(insertResult.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'confirmed', '常州站重导自动创建草稿运动员')`,
    [athleteId, key, name, item.gender_group || item.group_name || null, item.team_name || null]
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
  const [existing] = await connection.execute(
    `SELECT source_id FROM sup_event_result_sources
     WHERE event_id = ? AND ((original_path IS NOT NULL AND original_path = ?) OR (file_name = ? AND COALESCE(source_url, '') = COALESCE(?, '')))
     ORDER BY source_id ASC LIMIT 1`,
    [EVENT_ID, source.original_path || null, source.file_name, source.source_url || null]
  );
  if (existing.length) {
    const sourceId = Number(existing[0].source_id);
    await connection.execute(
      `UPDATE sup_event_result_sources
       SET original_path = ?, source_url = ?, parser_name = ?, parser_status = 'imported', parser_note = ?, extracted_rows = ?, imported_rows = ?, metadata = ?
       WHERE source_id = ?`,
      [
        source.original_path || null,
        source.source_url || null,
        source.parser_name,
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
  const updateSql = ` ON DUPLICATE KEY UPDATE
    athlete_id = VALUES(athlete_id),
    bib_number = VALUES(bib_number),
    board_class = VALUES(board_class),
    result_label = VALUES(result_label),
    finish_time = VALUES(finish_time),
    result_status_code = VALUES(result_status_code),
    result_status_note = VALUES(result_status_note),
    time_seconds = VALUES(time_seconds),
    points = VALUES(points),
    team_name = VALUES(team_name),
    source_id = VALUES(source_id),
    source_title = VALUES(source_title),
    source_locator = VALUES(source_locator),
    source_url = VALUES(source_url),
    source_note = VALUES(source_note),
    parse_confidence = VALUES(parse_confidence),
    review_status = VALUES(review_status),
    is_verified = VALUES(is_verified)`;

  for (const group of chunk(payload.results, RESULT_BATCH_SIZE)) {
    const values = [];
    const memberTasks = [];
    for (const result of group) {
      const isTeam = normalizeMembers(result.team_members).length > 0;
      const athleteId = isTeam ? null : await resolveAthleteId(connection, result, athleteCache);
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
      if (isTeam) memberTasks.push(result);
    }
    await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}${updateSql}`, values);

    for (const result of memberTasks) {
      const [idRows] = await connection.execute(
        `SELECT result_id FROM sup_event_results
         WHERE event_id = ? AND gender_group = ? AND discipline = ? AND round_label = ? AND rank_position = ? AND athlete_name_snapshot = ?
         LIMIT 1`,
        [EVENT_ID, result.gender_group || '公开组', result.discipline, result.round_label || null, Number(result.rank_position), result.athlete_name_snapshot]
      );
      const resultId = Number(idRows[0]?.result_id || 0);
      if (!resultId) continue;
      await connection.execute('DELETE FROM sup_event_result_members WHERE result_id = ?', [resultId]);
      const members = normalizeMembers(result.team_members);
      for (let index = 0; index < members.length; index += 1) {
        const memberName = members[index];
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

async function insertPointStandings(connection, payload, sourceId, athleteCache, touchedAthletes) {
  const rows = payload.point_standings || [];
  for (const group of chunk(rows, RESULT_BATCH_SIZE)) {
    const values = [];
    for (const row of group) {
      const athleteId = await resolveAthleteId(connection, row, athleteCache);
      if (athleteId) touchedAthletes.add(athleteId);
      values.push(
        EVENT_ID,
        sourceId,
        row.group_name,
        row.rank_position || null,
        row.status_rank || null,
        row.bib_number || null,
        athleteId,
        row.athlete_name_snapshot,
        row.team_name || '个人',
        row.endurance_rank || null,
        row.endurance_points == null ? null : Number(row.endurance_points),
        row.sprint_rank || null,
        row.sprint_points == null ? null : Number(row.sprint_points),
        row.total_points == null ? null : Number(row.total_points),
        row.source_locator || null
      );
    }
    await connection.execute(
      `INSERT INTO sup_event_point_standings (
        event_id, source_id, group_name, rank_position, status_rank, bib_number, athlete_id, athlete_name_snapshot,
        team_name, endurance_rank, endurance_points, sprint_rank, sprint_points, total_points, source_locator
      ) VALUES ${group.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',')}
      ON DUPLICATE KEY UPDATE
        source_id = VALUES(source_id),
        rank_position = VALUES(rank_position),
        status_rank = VALUES(status_rank),
        athlete_id = VALUES(athlete_id),
        team_name = VALUES(team_name),
        endurance_rank = VALUES(endurance_rank),
        endurance_points = VALUES(endurance_points),
        sprint_rank = VALUES(sprint_rank),
        sprint_points = VALUES(sprint_points),
        total_points = VALUES(total_points),
        source_locator = VALUES(source_locator)`,
      values
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  console.log(`payload results=${payload.results.length} point_standings=${(payload.point_standings || []).length}`);
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
    await connection.query(fs.readFileSync(path.join(repoRoot, 'database/migrate-event-point-standings-2026-05-20.sql'), 'utf8'));
    const [oldAthletes] = await connection.execute(
      `SELECT athlete_id FROM sup_event_results WHERE event_id = ? AND athlete_id IS NOT NULL
       UNION
       SELECT erm.athlete_id
       FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE er.event_id = ? AND erm.athlete_id IS NOT NULL
       UNION
       SELECT athlete_id FROM sup_event_point_standings WHERE event_id = ? AND athlete_id IS NOT NULL`,
      [EVENT_ID, EVENT_ID, EVENT_ID]
    );
    oldAthletes.forEach((row) => touchedAthletes.add(Number(row.athlete_id)));

    await connection.beginTransaction();
    const sourceId = await upsertSource(connection, payload);
    await connection.execute(
      `UPDATE sup_events
       SET name = ?, province = ?, city = ?, venue = ?, start_date = ?, end_date = ?,
           result_status = 'extended_complete',
           result_source_note = ?,
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
        payload.source.parser_note,
        EVENT_ID,
      ]
    );
    await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [EVENT_ID]);
    await connection.execute('DELETE FROM sup_event_point_standings WHERE event_id = ?', [EVENT_ID]);
    await insertResults(connection, payload, sourceId, athleteCache, touchedAthletes);
    await insertPointStandings(connection, payload, sourceId, athleteCache, touchedAthletes);
    await connection.execute(
      'UPDATE sup_event_result_sources SET imported_rows = ?, extracted_rows = ?, parser_status = "imported" WHERE source_id = ?',
      [payload.results.length, payload.results.length, sourceId]
    );
    await connection.commit();

    const ids = [...touchedAthletes].filter(Number.isFinite);
    for (const group of chunk(ids, RESULT_BATCH_SIZE)) {
      await syncAthleteRaceTimesBatch(connection, group);
    }
    console.log(`done event_id=${EVENT_ID} results=${payload.results.length} point_standings=${payload.point_standings.length} touchedAthletes=${ids.length}`);
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
