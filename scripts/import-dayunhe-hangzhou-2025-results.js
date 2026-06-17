#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
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
  console.log('Usage: node scripts/import-dayunhe-hangzhou-2025-results.js --input .cache/dayunhe-hangzhou-2025-results.json [--dry-run]');
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

function parseTimeToSeconds(input) {
  const raw = String(input || '').trim();
  if (!raw || STATUS_LABELS[raw.toUpperCase()]) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
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
        existingRows.length > 1 ? '大运河杭州站导入发现多个同名候选，需后台确认' : '大运河杭州站导入发现唯一同名档案，等待后台确认后再绑定',
      ]
    );
    athleteCache.set(key, null);
    return null;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由大运河杭州站成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(insertResult.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'pending', '大运河杭州站导入自动创建草稿运动员，等待后台确认身份')`,
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
    });
  }
  for (const [athleteId, raceTimes] of grouped.entries()) {
    await connection.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
  }
  return grouped.size;
}

async function upsertEvent(connection, event) {
  const [existing] = await connection.execute('SELECT event_id FROM sup_events WHERE slug = ? LIMIT 1', [event.slug]);
  if (existing.length) {
    const eventId = Number(existing[0].event_id);
    await connection.execute(
      `UPDATE sup_events
       SET name = ?, event_type = 'race', location = ?, province = ?, city = ?, venue = ?,
           start_date = ?, end_date = ?, description = ?, disciplines = ?,
           source_scope = ?, result_status = 'extended_complete', result_source_note = ?,
           result_source_links = ?, result_last_verified_at = NOW(), status = 'published', event_status = 'completed'
       WHERE event_id = ?`,
      [
        event.name,
        event.location || null,
        event.province || null,
        event.city || null,
        event.venue || null,
        event.start_date || null,
        event.end_date || event.start_date || null,
        event.description || null,
        JSON.stringify(event.disciplines || []),
        event.source_scope || '用户提交成绩册导入',
        event.result_source_note || null,
        JSON.stringify([{ title: '大运河-长距离成绩公告.pdf', url: 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780490167287-s3ehp3-大运河-长距离成绩公告.pdf', type: 'result_submission' }]),
        eventId,
      ]
    );
    return eventId;
  }

  const [inserted] = await connection.execute(
    `INSERT INTO sup_events (
      name, slug, event_type, location, province, city, venue, start_date, end_date, description,
      disciplines, source_scope, result_status, result_source_note, result_source_links,
      result_last_verified_at, status, event_status
    ) VALUES (?, ?, 'race', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'extended_complete', ?, ?, NOW(), 'published', 'completed')`,
    [
      event.name,
      event.slug,
      event.location || null,
      event.province || null,
      event.city || null,
      event.venue || null,
      event.start_date || null,
      event.end_date || event.start_date || null,
      event.description || null,
      JSON.stringify(event.disciplines || []),
      event.source_scope || '用户提交成绩册导入',
      event.result_source_note || null,
      JSON.stringify([{ title: '大运河-长距离成绩公告.pdf', url: 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780490167287-s3ehp3-大运河-长距离成绩公告.pdf', type: 'result_submission' }]),
    ]
  );
  return Number(inserted.insertId);
}

async function upsertSource(connection, eventId, payload) {
  const source = payload.source;
  const metadata = {
    ...(source.metadata || {}),
    source_kind: source.metadata?.source_kind || 'result_submission',
    result_submission_id: Number(source.result_submission_id || 0) || null,
    result_submission_batch_id: source.result_submission_batch_id || null,
  };
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
       SET original_path = ?, source_url = ?, result_submission_id = ?, result_submission_batch_id = ?,
           parser_name = ?, parser_status = 'imported', parser_note = ?, extracted_rows = ?, reviewed_rows = ?, imported_rows = ?, metadata = ?
       WHERE source_id = ?`,
      [
        source.original_path || null,
        source.source_url || null,
        Number(source.result_submission_id || 0) || null,
        source.result_submission_batch_id || null,
        source.parser_name,
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
      eventId,
      source.original_path || null,
      source.file_name,
      source.source_url || null,
      Number(source.result_submission_id || 0) || null,
      source.result_submission_batch_id || null,
      source.parser_name,
      source.parser_note || null,
      payload.results.length,
      payload.results.length,
      payload.results.length,
      JSON.stringify(metadata),
    ]
  );
  return Number(inserted.insertId);
}

async function existingAthletesForEvent(connection, eventId) {
  const [rows] = await connection.execute(
    `SELECT athlete_id FROM sup_event_results WHERE event_id = ? AND athlete_id IS NOT NULL
     UNION
     SELECT erm.athlete_id
     FROM sup_event_result_members erm
     INNER JOIN sup_event_results er ON er.result_id = erm.result_id
     WHERE er.event_id = ? AND erm.athlete_id IS NOT NULL
     UNION
     SELECT athlete_id FROM sup_event_point_standings WHERE event_id = ? AND athlete_id IS NOT NULL`,
    [eventId, eventId, eventId]
  );
  return rows.map((row) => Number(row.athlete_id)).filter(Number.isFinite);
}

async function insertResults(connection, eventId, sourceId, payload, athleteCache, touchedAthletes) {
  const sqlPrefix = `INSERT INTO sup_event_results (
    event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
    rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points,
    team_name, team_name_normalized, nationality_snapshot, source_type, source_id, source_title, source_locator,
    source_url, source_note, parse_confidence, review_status, is_verified
  ) VALUES `;
  const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "official", ?, ?, ?, ?, ?, ?, ?, ?)';
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
        result.gender_group,
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
    }
    await connection.execute(`${sqlPrefix}${group.map(() => placeholder).join(',')}`, values);
  }
}

async function insertPointStandings(connection, eventId, sourceId, payload, athleteCache, touchedAthletes) {
  const rows = payload.point_standings || [];
  if (!rows.length) return;
  for (const group of chunk(rows, RESULT_BATCH_SIZE)) {
    const values = [];
    for (const row of group) {
      const athleteId = await resolveAthleteId(connection, row, athleteCache);
      if (athleteId) touchedAthletes.add(athleteId);
      values.push(
        eventId,
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

async function markSubmissionImported(connection, payload, eventId) {
  const source = payload.source || {};
  const note = `导入完成：${source.file_name || '成绩册'}，桨板成绩 ${payload.results.length} 条，积分 ${payload.point_standings?.length || 0} 条`;
  if (Number(source.result_submission_id || 0) > 0) {
    await connection.execute(
      `UPDATE sup_event_result_submissions
       SET event_id = ?, status = 'imported',
           admin_note = TRIM(CONCAT(COALESCE(admin_note, ''), CASE WHEN COALESCE(admin_note, '') = '' THEN '' ELSE '\n' END, ?))
       WHERE submission_id = ?`,
      [eventId, note, Number(source.result_submission_id)]
    );
  }
}

function validatePayload(payload) {
  if (!payload.event?.slug || !payload.event?.name) throw new Error('payload.event is incomplete');
  if (!payload.source?.file_name) throw new Error('payload.source.file_name is required');
  if (!Array.isArray(payload.results) || payload.results.length !== 148) throw new Error(`expected 148 results, got ${payload.results?.length || 0}`);
  if (!Array.isArray(payload.point_standings) || payload.point_standings.length !== 103) throw new Error(`expected 103 point standings, got ${payload.point_standings?.length || 0}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(fs.readFileSync(path.resolve(repoRoot, args.input), 'utf8'));
  validatePayload(payload);
  const groupCounts = payload.results.reduce((acc, item) => {
    acc[item.gender_group] = (acc[item.gender_group] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({
    event: payload.event.name,
    slug: payload.event.slug,
    results: payload.results.length,
    point_standings: payload.point_standings.length,
    groups: groupCounts,
    dryRun: args.dryRun,
  }, null, 2));
  if (args.dryRun) return;

  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });

  const athleteCache = new Map();
  const touchedAthletes = new Set();
  let eventId = null;
  try {
    await connection.beginTransaction();
    eventId = await upsertEvent(connection, payload.event);
    const sourceId = await upsertSource(connection, eventId, payload);
    for (const athleteId of await existingAthletesForEvent(connection, eventId)) touchedAthletes.add(athleteId);
    await connection.execute('DELETE FROM sup_event_point_standings WHERE event_id = ?', [eventId]);
    await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [eventId]);
    await insertResults(connection, eventId, sourceId, payload, athleteCache, touchedAthletes);
    await insertPointStandings(connection, eventId, sourceId, payload, athleteCache, touchedAthletes);
    const teamAliases = await syncClubTeamAliasesForEvent(connection, eventId);
    await markSubmissionImported(connection, payload, eventId);
    await connection.commit();

    const ids = [...touchedAthletes].filter(Number.isFinite);
    for (const group of chunk(ids, RESULT_BATCH_SIZE)) {
      await syncAthleteRaceTimesBatch(connection, group);
    }
    console.log(`done event_id=${eventId} results=${payload.results.length} point_standings=${payload.point_standings.length} touchedAthletes=${ids.length} teamAliases=${teamAliases}`);
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
