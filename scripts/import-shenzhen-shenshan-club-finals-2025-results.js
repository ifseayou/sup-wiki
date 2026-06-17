#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { parseTimeToSeconds } = require('./lib/result-time');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 341;
const SUBMISSION_ID = 23;
const SUBMISSION_BATCH_ID = 'mp_1780580462138_gywsnawb';
const RESULT_BATCH_SIZE = 120;

const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
  DNQ: '未晋级',
  OTL: '超过关门时间',
};

function usage() {
  console.log('Usage: node scripts/import-shenzhen-shenshan-club-finals-2025-results.js --input .cache/shenzhen-shenshan-club-finals-2025-results.json [--dry-run]');
}

function parseArgs(argv) {
  const args = { input: '', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--input') args.input = argv[++i] || '';
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = env[key] || value;
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

function normalizeClubTeamName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（［【]/g, '(')
    .replace(/[）］】]/g, ')')
    .replace(/\s+/g, '')
    .replace(/[·•]/g, '')
    .toLowerCase();
}

function cleanClubTeamName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（［【]/g, '(')
    .replace(/[）］】]/g, ')')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function isClaimableClubTeamName(value) {
  const clean = cleanClubTeamName(value);
  const personal = new Set(['', '-', '--', '/', '个人', '无', '無', '无队伍', '个人参赛', '个人报名', '独立参赛', '暂无', '未知']);
  if (!clean || personal.has(clean)) return false;
  const normalized = normalizeClubTeamName(clean);
  return normalized.length >= 2 && !personal.has(normalized);
}

function normalizeTeamMembers(value) {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  return String(value || '').split(/[\n,，、;；/]+/).map((item) => item.trim()).filter(Boolean);
}

function statusCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return STATUS_LABELS[code] ? code : null;
}

async function findExactClubByNormalizedName(connection, normalizedTeamName) {
  const [rows] = await connection.execute(
    `SELECT club_id
     FROM sup_clubs
     WHERE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, ' ', ''), '　', ''), '（', '('), '）', ')'), '·', ''), '•', '')) = ?
     ORDER BY status = 'published' DESC, club_id ASC
     LIMIT 1`,
    [normalizedTeamName]
  );
  return rows[0] ? Number(rows[0].club_id) : null;
}

async function syncClubTeamAliasesForEvent(connection, eventId) {
  const [rows] = await connection.execute(
    `SELECT
       team_name,
       COUNT(*) AS result_count,
       COUNT(DISTINCT event_id) AS event_count,
       COUNT(DISTINCT COALESCE(athlete_id, athlete_name_snapshot)) AS athlete_count
     FROM sup_event_results
     WHERE event_id = ? AND team_name IS NOT NULL AND team_name <> ''
     GROUP BY team_name`,
    [eventId]
  );
  let touched = 0;
  for (const row of rows) {
    if (!isClaimableClubTeamName(row.team_name)) continue;
    const raw = cleanClubTeamName(row.team_name);
    const normalized = normalizeClubTeamName(raw);
    const clubId = await findExactClubByNormalizedName(connection, normalized);
    await connection.execute(
      `INSERT INTO sup_club_team_aliases (
         team_name_raw, normalized_name, club_id, match_status, confidence,
         result_count, event_count, athlete_count, first_seen_event_id, last_seen_event_id, source_type
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'event_result_team')
       ON DUPLICATE KEY UPDATE
         team_name_raw = VALUES(team_name_raw),
         club_id = CASE
           WHEN sup_club_team_aliases.match_status IN ('confirmed', 'ignored', 'rejected') THEN sup_club_team_aliases.club_id
           ELSE VALUES(club_id)
         END,
         match_status = CASE
           WHEN sup_club_team_aliases.match_status IN ('confirmed', 'ignored', 'rejected') THEN sup_club_team_aliases.match_status
           ELSE VALUES(match_status)
         END,
         confidence = GREATEST(sup_club_team_aliases.confidence, VALUES(confidence)),
         result_count = GREATEST(sup_club_team_aliases.result_count, VALUES(result_count)),
         event_count = GREATEST(sup_club_team_aliases.event_count, VALUES(event_count)),
         athlete_count = GREATEST(sup_club_team_aliases.athlete_count, VALUES(athlete_count)),
         last_seen_event_id = VALUES(last_seen_event_id),
         updated_at = NOW()`,
      [
        raw,
        normalized,
        clubId,
        clubId ? 'confirmed' : 'unmatched',
        clubId ? 1 : 0.6,
        Number(row.result_count || 0),
        Number(row.event_count || 0),
        Number(row.athlete_count || 0),
        eventId,
        eventId,
      ]
    );
    touched += 1;
  }
  return touched;
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
    await connection.execute(
      `INSERT IGNORE INTO sup_athlete_identity_links
        (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
       VALUES (?, ?, ?, ?, ?, '中国', ?, ?, ?)`,
      [
        existingRows.length === 1 ? Number(existingRows[0].athlete_id) : null,
        key,
        name,
        item.gender_group || item.group_name || null,
        item.team_name || null,
        existingRows.length > 1 ? 0.45 : 0.85,
        'pending',
        existingRows.length > 1 ? '深汕站成绩册导入发现多个同名候选，需后台确认' : '深汕站成绩册导入发现唯一同名档案，等待后台确认后再绑定',
      ]
    );
    athleteCache.set(key, null);
    return null;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由2025年中国桨板俱乐部联赛总决赛（深圳深汕站）成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(insertResult.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'pending', '深汕站成绩册导入自动创建草稿运动员，等待后台确认身份')`,
    [athleteId, key, name, item.gender_group || item.group_name || null, item.team_name || null]
  );
  athleteCache.set(key, athleteId);
  return athleteId;
}

async function syncAthleteRaceTimesBatch(connection, athleteIds) {
  const ids = [...new Set(athleteIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.execute(
    `SELECT DISTINCT linked.athlete_id, er.discipline, er.round_label, er.result_label, er.finish_time,
            er.result_status_code, er.result_status_note, er.rank_position, e.start_date, e.event_id, e.name AS event_name
     FROM (
       SELECT result_id, athlete_id FROM sup_event_results WHERE athlete_id IN (${placeholders})
       UNION
       SELECT erm.result_id, erm.athlete_id
       FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE erm.athlete_id IN (${placeholders})
     ) linked
     INNER JOIN sup_event_results er ON er.result_id = linked.result_id
     INNER JOIN sup_events e ON e.event_id = er.event_id
     WHERE er.review_status = 'confirmed' AND er.is_verified = 1
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
      status_label: row.result_status_code ? (row.result_status_note || STATUS_LABELS[row.result_status_code] || row.result_status_code) : undefined,
      rank: Number(row.rank_position) < 9000 ? Number(row.rank_position) : undefined,
    });
  }
  for (const [athleteId, raceTimes] of grouped.entries()) {
    await connection.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
  }
  return grouped.size;
}

async function upsertSource(connection, payload) {
  const source = payload.source || {};
  const metadata = {
    ...(source.metadata || {}),
    source_kind: source.metadata?.source_kind || 'result_submission',
    result_submission_id: Number(source.result_submission_id || 0) || null,
    result_submission_batch_id: source.result_submission_batch_id || null,
    original_submission_url: source.original_submission_url || null,
  };
  const [existing] = await connection.execute(
    `SELECT source_id FROM sup_event_result_sources
     WHERE event_id = ? AND result_submission_id = ?
     ORDER BY source_id ASC LIMIT 1`,
    [EVENT_ID, SUBMISSION_ID]
  );
  if (existing.length) {
    const sourceId = Number(existing[0].source_id);
    await connection.execute(
      `UPDATE sup_event_result_sources
       SET original_path = ?, file_name = ?, file_type = 'pdf', source_url = ?,
           result_submission_id = ?, result_submission_batch_id = ?,
           parser_name = ?, parser_status = 'imported', parser_note = ?, extracted_rows = ?, reviewed_rows = ?, imported_rows = ?, metadata = ?
       WHERE source_id = ?`,
      [
        source.original_path || null,
        source.file_name,
        source.source_url || null,
        SUBMISSION_ID,
        SUBMISSION_BATCH_ID,
        source.parser_name || 'parse-shenzhen-shenshan-club-finals-2025-results.py',
        source.parser_note || null,
        payload.results.length,
        payload.results.length,
        payload.results.length,
        JSON.stringify(metadata),
        sourceId,
      ]
    );
    return sourceId;
  }
  const [inserted] = await connection.execute(
    `INSERT INTO sup_event_result_sources (
      event_id, original_path, file_name, file_type, source_url, result_submission_id, result_submission_batch_id,
      parser_name, parser_status, parser_note, extracted_rows, reviewed_rows, imported_rows, metadata
    ) VALUES (?, ?, ?, 'pdf', ?, ?, ?, ?, 'imported', ?, ?, ?, ?, ?)`,
    [
      EVENT_ID,
      source.original_path || null,
      source.file_name,
      source.source_url || null,
      SUBMISSION_ID,
      SUBMISSION_BATCH_ID,
      source.parser_name || 'parse-shenzhen-shenshan-club-finals-2025-results.py',
      source.parser_note || null,
      payload.results.length,
      payload.results.length,
      payload.results.length,
      JSON.stringify(metadata),
    ]
  );
  return Number(inserted.insertId);
}

async function insertResults(connection, payload, sourceId, athleteCache, touchedAthletes) {
  const sqlPrefix = `INSERT INTO sup_event_results (
    event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
    rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points,
    team_name, team_name_normalized, nationality_snapshot, source_type, source_id, source_title, source_locator,
    source_url, source_note, parse_confidence, review_status, is_verified
  ) VALUES `;
  const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "official", ?, ?, ?, ?, ?, ?, ?, ?)';

  for (const group of chunk(payload.results, RESULT_BATCH_SIZE)) {
    const values = [];
    const memberItems = [];
    for (const result of group) {
      const members = normalizeTeamMembers(result.team_members);
      const isTeamResult = members.length > 0;
      const athleteId = isTeamResult ? null : await resolveAthleteId(connection, result, athleteCache);
      if (athleteId) touchedAthletes.add(athleteId);
      const code = statusCode(result.result_status_code || result.finish_time);
      values.push(
        EVENT_ID,
        athleteId,
        result.athlete_name_snapshot,
        result.bib_number || null,
        result.gender_group,
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
        normalizeClubTeamName(result.team_name || '个人') || null,
        result.nationality_snapshot || '中国',
        sourceId,
        payload.source.file_name,
        result.source_locator || null,
        payload.source.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' ? result.parse_confidence : 1,
        result.review_status || 'confirmed',
        result.is_verified === false ? 0 : 1
      );
      if (isTeamResult) memberItems.push({ result, members });
    }
    await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);

    for (const item of memberItems) {
      const result = item.result;
      const [idRows] = await connection.execute(
        `SELECT result_id FROM sup_event_results
         WHERE event_id = ? AND gender_group = ? AND discipline = ? AND (round_label <=> ?) AND rank_position = ? AND athlete_name_snapshot = ?
         ORDER BY result_id ASC LIMIT 1`,
        [EVENT_ID, result.gender_group, result.discipline, result.round_label || null, Number(result.rank_position), result.athlete_name_snapshot]
      );
      const resultId = Number(idRows[0]?.result_id || 0);
      if (!resultId) continue;
      for (let index = 0; index < item.members.length; index += 1) {
        const memberName = item.members[index];
        const athleteId = await resolveAthleteId(connection, { ...result, athlete_name_snapshot: memberName, team_members: [] }, athleteCache);
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
  for (const group of chunk(payload.point_standings || [], RESULT_BATCH_SIZE)) {
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
      ) VALUES ${group.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',')}`,
      values
    );
  }
}

async function backfillSubeventPoints(connection, payload) {
  let updates = 0;
  for (const row of payload.point_standings || []) {
    const groupName = row.group_name;
    for (const sub of Object.values(row.subevents || {})) {
      if (!sub || sub.points == null || !sub.discipline || !/^\d+$/.test(String(sub.rank || ''))) continue;
      const [result] = await connection.execute(
        `UPDATE sup_event_results
         SET points = ?
         WHERE event_id = ? AND gender_group = ? AND discipline = ? AND rank_position = ? AND round_label = '决赛'`,
        [Number(sub.points), EVENT_ID, groupName, sub.discipline, Number(sub.rank)]
      );
      updates += Number(result.affectedRows || 0);
    }
  }
  return updates;
}

async function markSubmissionImported(connection, payload) {
  const note = `导入完成：${payload.source.file_name}，成绩 ${payload.results.length} 条，个人赛积分 ${payload.point_standings.length} 条，event_id=${EVENT_ID}`;
  await connection.execute(
    `UPDATE sup_event_result_submissions
     SET event_id = ?, status = 'imported',
         admin_note = TRIM(CONCAT(COALESCE(admin_note, ''), CASE WHEN COALESCE(admin_note, '') = '' THEN '' ELSE '\n' END, ?))
     WHERE submission_id = ? AND batch_id = ?`,
    [EVENT_ID, note, SUBMISSION_ID, SUBMISSION_BATCH_ID]
  );
}

async function existingAthletesForEvent(connection) {
  const [rows] = await connection.execute(
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
  return rows.map((row) => Number(row.athlete_id)).filter(Number.isFinite);
}

function validatePayload(payload) {
  if (Number(payload.event?.event_id) !== EVENT_ID) throw new Error(`unexpected event_id: ${payload.event?.event_id}`);
  if (Number(payload.source?.result_submission_id) !== SUBMISSION_ID) throw new Error(`unexpected submission_id: ${payload.source?.result_submission_id}`);
  if (payload.source?.result_submission_batch_id !== SUBMISSION_BATCH_ID) throw new Error(`unexpected batch_id: ${payload.source?.result_submission_batch_id}`);
  if (!Array.isArray(payload.results) || payload.results.length !== 426) throw new Error(`expected 426 results, got ${payload.results?.length || 0}`);
  if (!Array.isArray(payload.point_standings) || payload.point_standings.length !== 204) throw new Error(`expected 204 point_standings, got ${payload.point_standings?.length || 0}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(fs.readFileSync(path.resolve(repoRoot, args.input), 'utf8'));
  validatePayload(payload);
  console.log(JSON.stringify({
    event_id: payload.event.event_id,
    event: payload.event.name,
    results: payload.results.length,
    point_standings: payload.point_standings.length,
    submission_id: payload.source.result_submission_id,
    batch_id: payload.source.result_submission_batch_id,
    dryRun: args.dryRun,
  }, null, 2));

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
    const [eventRows] = await connection.execute(
      `SELECT event_id, name, slug, result_status FROM sup_events WHERE event_id = ? LIMIT 1`,
      [EVENT_ID]
    );
    if (!eventRows.length || eventRows[0].slug !== payload.event.slug) throw new Error(`target event_id=${EVENT_ID} not found or slug mismatch`);
    const [countRows] = await connection.execute('SELECT COUNT(*) AS count FROM sup_event_results WHERE event_id = ?', [EVENT_ID]);
    const [pointCountRows] = await connection.execute('SELECT COUNT(*) AS count FROM sup_event_point_standings WHERE event_id = ?', [EVENT_ID]);
    const [submissionRows] = await connection.execute(
      'SELECT submission_id, batch_id, status FROM sup_event_result_submissions WHERE submission_id = ? AND batch_id = ? LIMIT 1',
      [SUBMISSION_ID, SUBMISSION_BATCH_ID]
    );
    if (!submissionRows.length) throw new Error('submission lock row not found');
    console.log(`target event=${eventRows[0].name} old_results=${countRows[0].count} old_points=${pointCountRows[0].count} submission_status=${submissionRows[0].status}`);
    if (args.dryRun) {
      console.log(`dry-run would replace event_id=${EVENT_ID} with results=${payload.results.length} point_standings=${payload.point_standings.length}`);
      return;
    }

    for (const athleteId of await existingAthletesForEvent(connection)) touchedAthletes.add(athleteId);
    await connection.beginTransaction();
    const sourceId = await upsertSource(connection, payload);
    await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [EVENT_ID]);
    await connection.execute('DELETE FROM sup_event_point_standings WHERE event_id = ?', [EVENT_ID]);
    await insertResults(connection, payload, sourceId, athleteCache, touchedAthletes);
    const subeventUpdates = await backfillSubeventPoints(connection, payload);
    await insertPointStandings(connection, payload, sourceId, athleteCache, touchedAthletes);
    const teamAliases = await syncClubTeamAliasesForEvent(connection, EVENT_ID);
    await markSubmissionImported(connection, payload);
    await connection.execute(
      `UPDATE sup_events
       SET name = ?, province = ?, city = ?, venue = ?, start_date = ?, end_date = ?,
           star_level = ?, score_coefficient = ?, source_scope = ?,
           result_status = 'extended_complete',
           result_source_note = ?,
           result_source_links = ?,
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
        payload.event.star_level,
        payload.event.score_coefficient,
        payload.event.source_scope,
        payload.event.result_source_note,
        JSON.stringify([{ title: payload.source.file_name, url: payload.source.source_url, type: 'result_submission' }]),
        EVENT_ID,
      ]
    );
    await connection.commit();

    const ids = [...touchedAthletes].filter(Number.isFinite);
    for (const group of chunk(ids, RESULT_BATCH_SIZE)) {
      await syncAthleteRaceTimesBatch(connection, group);
    }
    console.log(`done event_id=${EVENT_ID} results=${payload.results.length} point_standings=${payload.point_standings.length} subeventBackfill=${subeventUpdates} touchedAthletes=${ids.length} teamAliases=${teamAliases}`);
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
