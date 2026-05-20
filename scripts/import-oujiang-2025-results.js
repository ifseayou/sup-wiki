#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 191;
const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
};

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs() {
  const args = { input: '', dryRun: false, batchSize: 200 };
  for (let i = 2; i < process.argv.length; i += 1) {
    const item = process.argv[i];
    if (item === '--input') args.input = process.argv[++i] || '';
    else if (item === '--dry-run') args.dryRun = true;
    else if (item === '--batch-size') args.batchSize = Math.max(20, Number(process.argv[++i] || 200));
  }
  if (!args.input) throw new Error('Usage: node scripts/import-oujiang-2025-results.js --input /path/oujiang.json [--dry-run]');
  return args;
}

function normalizedName(name) {
  return String(name || '').replace(/\s+/g, '').toLowerCase();
}

function parseTimeToSeconds(input) {
  const raw = String(input || '').trim();
  if (!raw || STATUS_LABELS[raw]) return null;
  const parts = raw.split(':').map(Number);
  if (parts.length !== 3 || parts.some((item) => !Number.isFinite(item))) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

async function resolveAthleteId(connection, cache, result, name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return null;
  const key = normalizedName(cleanName);
  if (cache.has(key)) return cache.get(key);

  const [linkRows] = await connection.execute(
    `SELECT athlete_id FROM sup_athlete_identity_links
     WHERE normalized_name = ? AND status = 'confirmed' AND athlete_id IS NOT NULL
     ORDER BY confidence DESC, link_id ASC LIMIT 1`,
    [key]
  );
  if (linkRows.length) {
    const id = Number(linkRows[0].athlete_id);
    cache.set(key, id);
    return id;
  }

  const [athleteRows] = await connection.execute(
    `SELECT athlete_id FROM sup_athletes WHERE REPLACE(LOWER(name), ' ', '') = ? ORDER BY athlete_id ASC LIMIT 1`,
    [key]
  );
  if (athleteRows.length) {
    const id = Number(athleteRows[0].athlete_id);
    await connection.execute(
      `INSERT IGNORE INTO sup_athlete_identity_links
        (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
       VALUES (?, ?, ?, ?, ?, '中国', 0.92, 'confirmed', '八百里瓯江重导自动确认')`,
      [id, key, cleanName, result.gender_group || null, result.team_name || null]
    );
    cache.set(key, id);
    return id;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由八百里瓯江成绩册导入自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [cleanName]
  );
  const id = Number(insertResult.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'confirmed', '八百里瓯江重导自动创建草稿运动员')`,
    [id, key, cleanName, result.gender_group || null, result.team_name || null]
  );
  cache.set(key, id);
  return id;
}

async function syncAthleteRaceTimes(connection, athleteIds) {
  const ids = [...new Set(athleteIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return 0;
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
  return grouped.size;
}

async function main() {
  const args = parseArgs();
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
    multipleStatements: false,
  });
  const athleteCache = new Map();
  const touchedAthletes = new Set();
  const results = payload.results || [];

  await connection.beginTransaction();
  try {
    await connection.execute(
      `UPDATE sup_events
       SET name = ?, start_date = ?, end_date = ?, province = ?, city = ?, venue = ?,
           result_status = 'extended_complete', result_source_note = '八百里瓯江成绩册坐标重解析',
           result_last_verified_at = NOW()
       WHERE event_id = ?`,
      [
        payload.event.name,
        payload.event.start_date,
        payload.event.end_date,
        payload.event.province,
        payload.event.city,
        payload.event.venue,
        EVENT_ID,
      ]
    );

    await connection.execute(
      `UPDATE sup_event_result_sources
       SET parser_name = ?, parser_status = 'imported', parser_note = '八百里瓯江成绩册按页坐标重解析并人工核验状态行',
           extracted_rows = ?, reviewed_rows = ?, imported_rows = ?, updated_at = NOW()
       WHERE source_id = ?`,
      [payload.source.parser_name, results.length, results.length, results.length, payload.source.source_id]
    );

    await connection.execute(
      `DELETE erm FROM sup_event_result_members erm
       INNER JOIN sup_event_results er ON er.result_id = erm.result_id
       WHERE er.event_id = ?`,
      [EVENT_ID]
    );
    await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [EVENT_ID]);

    const insertSql = `INSERT INTO sup_event_results (
      event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
      rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name,
      source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified
    ) VALUES ?`;

    for (let offset = 0; offset < results.length; offset += args.batchSize) {
      const batch = results.slice(offset, offset + args.batchSize);
      const values = [];
      const memberJobs = [];
      for (const item of batch) {
        const members = Array.isArray(item.team_members) ? item.team_members.filter(Boolean) : [];
        const primaryName = item.athlete_name_snapshot;
        const athleteId = await resolveAthleteId(connection, athleteCache, item, primaryName);
        if (athleteId) touchedAthletes.add(athleteId);
        values.push([
          EVENT_ID,
          athleteId,
          primaryName,
          item.bib_number || null,
          item.gender_group,
          item.discipline,
          item.board_class || null,
          item.round_label || '决赛',
          Number(item.rank_position),
          item.result_label || null,
          item.finish_time,
          item.result_status_code || null,
          item.result_status_note || (item.result_status_code ? STATUS_LABELS[item.result_status_code] : null),
          parseTimeToSeconds(item.finish_time),
          item.points || null,
          item.team_name || '个人',
          'official',
          payload.source.source_id,
          payload.source.file_name,
          item.source_locator || null,
          payload.source.source_url,
          item.source_note || null,
          item.parse_confidence || 0.9,
          item.review_status || 'confirmed',
          1,
        ]);
        memberJobs.push({ item, members, athleteId });
      }
      const [inserted] = await connection.query(insertSql, [values]);
      const firstId = Number(inserted.insertId);
      for (let index = 0; index < memberJobs.length; index += 1) {
        const job = memberJobs[index];
        const resultId = firstId + index;
        for (let order = 0; order < job.members.length; order += 1) {
          const memberName = job.members[order];
          const memberAthleteId = normalizedName(memberName) === normalizedName(job.item.athlete_name_snapshot)
            ? job.athleteId
            : await resolveAthleteId(connection, athleteCache, job.item, memberName);
          if (memberAthleteId) touchedAthletes.add(memberAthleteId);
          await connection.execute(
            `INSERT INTO sup_event_result_members (result_id, athlete_id, member_name, member_order)
             VALUES (?, ?, ?, ?)`,
            [resultId, memberAthleteId || null, memberName, order]
          );
        }
      }
    }

    const synced = await syncAthleteRaceTimes(connection, [...touchedAthletes]);
    if (args.dryRun) {
      await connection.rollback();
      console.log(JSON.stringify({ dryRun: true, rows: results.length, touchedAthletes: touchedAthletes.size, synced }, null, 2));
    } else {
      await connection.commit();
      console.log(JSON.stringify({ imported: results.length, touchedAthletes: touchedAthletes.size, synced }, null, 2));
    }
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
