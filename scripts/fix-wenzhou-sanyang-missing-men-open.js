#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const EVENT_ID = 305;
const SOURCE_ID = 374;
const STATUS_LABELS = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
  DNQ: '未晋级',
  OTL: '超过关门时间',
};

const missingMenOpenRows = [
  [13, 'A011', '胡辛泽', '42:37.28'],
  [14, 'A037', '林聪', '43:33.36'],
  [15, 'A013', '邱健', '45:33.53'],
  [16, 'A024', '陈凯', '46:43.80'],
  [17, 'A003', '俞挺', '47:02.07'],
  [18, 'A033', '陈友谊', '47:51.66'],
  [19, 'A015', '刘丰', '48:10.46'],
  [20, 'A025', '曹学林', '49:40.27'],
  [21, 'A027', '赖立新', '52:29.52'],
  [22, 'A017', '余梦涛', '54:40.76'],
  [23, 'A010', '刘伟江', '56:13.90'],
  [24, 'A019', '虞建东', '59:43.07'],
  [25, 'A034', '陈立', '1:00:17.30'],
  [26, 'A022', '王国强', '1:01:25.30'],
  [27, 'A014', '诸海敏', '1:10:27.39'],
  [28, 'A020', '袁渊鸣', '1:11:04.22'],
  [29, 'A026', '蔡忠义', '1:12:25.67'],
  [30, 'A032', '高雷', '1:12:43.64'],
];

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
  const normalized = raw.replace(/^(\d+):(\d{2})\.(\d{2})\.(\d{2})$/, '$1:$2:$3.$4');
  const parts = normalized.split(':').map((part) => part.trim());
  if (parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return null;
}

async function resolveAthleteId(connection, name, genderGroup, teamName, athleteCache) {
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

  const [athleteRows] = await connection.execute(
    `SELECT athlete_id FROM sup_athletes
     WHERE name = ?
     ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC
     LIMIT 5`,
    [name]
  );
  if (athleteRows.length) {
    const athleteId = Number(athleteRows[0].athlete_id);
    await connection.execute(
      `INSERT IGNORE INTO sup_athlete_identity_links
        (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
       VALUES (?, ?, ?, ?, ?, '中国', ?, ?, ?)`,
      [
        athleteId,
        key,
        name,
        genderGroup,
        teamName,
        athleteRows.length > 1 ? 0.5 : 0.9,
        athleteRows.length > 1 ? 'pending' : 'confirmed',
        athleteRows.length > 1 ? '温州三垟补录发现同名候选，需后台确认' : '温州三垟补录自动确认同名运动员',
      ]
    );
    athleteCache.set(key, athleteId);
    return athleteId;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由温州三垟湿地第二届桨板比赛成绩册补录自动生成的运动员草稿档案，待补充完整人物资料。', 'draft')`,
    [name]
  );
  const athleteId = Number(insertResult.insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, '中国', 0.85, 'confirmed', '温州三垟补录自动创建草稿运动员')`,
    [athleteId, key, name, genderGroup, teamName]
  );
  athleteCache.set(key, athleteId);
  return athleteId;
}

async function syncAthleteRaceTimes(connection, athleteId) {
  const [rows] = await connection.execute(
    `SELECT DISTINCT er.discipline, er.round_label, er.result_label, er.finish_time,
            er.result_status_code, er.result_status_note, er.rank_position,
            e.start_date, e.event_id, e.name AS event_name
     FROM sup_event_results er
     INNER JOIN sup_events e ON e.event_id = er.event_id
     LEFT JOIN sup_event_result_members erm ON erm.result_id = er.result_id
     WHERE er.athlete_id = ? OR erm.athlete_id = ?
     ORDER BY e.start_date DESC, er.rank_position ASC`,
    [athleteId, athleteId]
  );
  const raceTimes = rows.map((row) => ({
    distance: row.discipline,
    year: row.start_date ? new Date(row.start_date).getFullYear() : undefined,
    event: row.event_name,
    event_id: row.event_id,
    round: row.round_label || undefined,
    result: row.result_label || undefined,
    time: row.finish_time,
    status: row.result_status_code || undefined,
    status_label: row.result_status_note || STATUS_LABELS[row.result_status_code] || undefined,
  }));
  await connection.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
}

async function main() {
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

  try {
    await connection.beginTransaction();
    for (const [rank, bib, name, finishTime] of missingMenOpenRows) {
      const athleteId = await resolveAthleteId(connection, name, '男子公开组', '个人', athleteCache);
      if (athleteId) touchedAthletes.add(athleteId);
      await connection.execute(
        `INSERT INTO sup_event_results (
          event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
          rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points,
          team_name, nationality_snapshot, source_type, source_id, source_title, source_locator, source_url,
          source_note, parse_confidence, review_status, is_verified
        ) VALUES (?, ?, ?, ?, '男子公开组', '6公里', NULL, '决赛', ?, NULL, ?, NULL, NULL, ?, NULL,
          '个人', '中国', 'official', ?, '温州三垟湿地第二届桨板比赛成绩册.pdf', 'page:1',
          '/result-books/温州三垟湿地第二届桨板比赛成绩册.pdf',
          '补录 PDF 第 1 页无显式名次续行：按表格顺序补齐男子公开组第 13-30 名。', 0.950, 'confirmed', 1)
        ON DUPLICATE KEY UPDATE
          athlete_id = VALUES(athlete_id),
          bib_number = VALUES(bib_number),
          finish_time = VALUES(finish_time),
          time_seconds = VALUES(time_seconds),
          source_note = VALUES(source_note),
          parse_confidence = VALUES(parse_confidence),
          review_status = VALUES(review_status),
          is_verified = VALUES(is_verified)`,
        [EVENT_ID, athleteId, name, bib, rank, finishTime, parseTimeToSeconds(finishTime), SOURCE_ID]
      );
    }

    const [malformedRows] = await connection.execute(
      `SELECT result_id, athlete_id, finish_time
       FROM sup_event_results
       WHERE event_id = ? AND finish_time REGEXP '^[0-9]+:[0-9]{2}[.][0-9]{2}[.][0-9]{2}$'`,
      [EVENT_ID]
    );
    for (const row of malformedRows) {
      const normalized = String(row.finish_time).replace(/^(\d+):(\d{2})\.(\d{2})\.(\d{2})$/, '$1:$2:$3.$4');
      await connection.execute(
        `UPDATE sup_event_results
         SET finish_time = ?, time_seconds = ?, source_note = TRIM(CONCAT(COALESCE(source_note, ''), ' 规范 PDF 点号误识别的小时成绩格式。'))
         WHERE result_id = ?`,
        [normalized, parseTimeToSeconds(normalized), row.result_id]
      );
      if (row.athlete_id) touchedAthletes.add(Number(row.athlete_id));
    }

    const [countRows] = await connection.execute('SELECT COUNT(*) AS total FROM sup_event_results WHERE event_id = ?', [EVENT_ID]);
    const total = Number(countRows[0]?.total || 0);
    await connection.execute(
      `UPDATE sup_event_result_sources
       SET imported_rows = ?, extracted_rows = ?, parser_status = 'imported',
           parser_note = '补录男子公开组第 13-30 名，并校正小时成绩格式。'
       WHERE source_id = ?`,
      [total, total, SOURCE_ID]
    );

    await connection.commit();

    for (const athleteId of touchedAthletes) {
      await syncAthleteRaceTimes(connection, athleteId);
    }

    console.log(JSON.stringify({
      insertedOrUpdatedMenOpen: missingMenOpenRows.length,
      normalizedTimeRows: malformedRows.length,
      touchedAthletes: touchedAthletes.size,
    }, null, 2));
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
