#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');
const {
  SOURCE_TITLE,
  compareCandidates,
  isMaleGroup,
  isPersonalChineseName,
  isYouthGroup,
} = require('./coach-certificate-candidate-utils');
const { inferGenderFromGroup } = require('./athlete-gender-utils');

function readArgs(argv) {
  const args = { commit: false, dryRun: true, excludeYouth: true, limit: 200 };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--commit') {
      args.commit = true;
      args.dryRun = false;
    } else if (arg === '--dry-run') {
      args.commit = false;
      args.dryRun = true;
    } else if (arg === '--limit' && next) {
      args.limit = Number(next);
      index += 1;
    } else if (arg === '--include-youth') {
      args.excludeYouth = false;
    }
  }
  args.limit = Number.isFinite(args.limit) && args.limit > 0 ? Math.floor(args.limit) : 200;
  return args;
}

async function createConnection() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sport_hacker',
    charset: 'utf8mb4',
  });
}

async function loadCandidates(connection, args) {
  const [rows] = await connection.execute(`
    SELECT
      a.athlete_id,
      a.name,
      a.gender,
      er.gender_group,
      e.start_date
    FROM sup_event_results er
    INNER JOIN sup_athletes a ON a.athlete_id = er.athlete_id
    INNER JOIN sup_events e ON e.event_id = er.event_id
    LEFT JOIN sup_coach_certificate_checks c ON c.query_name = a.name
    WHERE a.status = 'published'
      AND er.athlete_id IS NOT NULL
      AND er.is_verified = 1
      AND er.review_status = 'confirmed'
      AND c.check_id IS NULL
    ORDER BY e.start_date DESC, er.result_id DESC
    LIMIT 20000
  `);
  const map = new Map();
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const group = String(row.gender_group || '');
    if (!isPersonalChineseName(name)) continue;
    if (args.excludeYouth && isYouthGroup(group)) continue;
    const athleteGender = String(row.gender || 'unknown');
    const groupGender = inferGenderFromGroup(group);
    const isMalePriority = athleteGender === 'male'
      || ((athleteGender === 'unknown' || !athleteGender) && (groupGender === 'male' || isMaleGroup(group)));
    const current = map.get(name) || {
      name,
      athleteIds: new Set(),
      primaryAthleteId: Number(row.athlete_id),
      maleScore: 0,
      resultCount: 0,
      lastResultDate: '',
    };
    current.athleteIds.add(Number(row.athlete_id));
    current.resultCount += 1;
    current.maleScore = Math.max(current.maleScore, isMalePriority ? 1 : 0);
    const date = row.start_date ? String(row.start_date).slice(0, 10) : '';
    if (date > current.lastResultDate) current.lastResultDate = date;
    map.set(name, current);
  }
  return Array.from(map.values()).sort(compareCandidates).slice(0, args.limit);
}

async function upsertCandidate(connection, candidate, rank) {
  await connection.execute(
    `INSERT INTO sup_coach_certificate_checks (
       athlete_id, candidate_athlete_ids, athlete_name, query_name, gender_priority,
       result_count, candidate_rank, query_status, match_status, source_title
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 'pending', ?)
     ON DUPLICATE KEY UPDATE
       athlete_id = VALUES(athlete_id),
       candidate_athlete_ids = VALUES(candidate_athlete_ids),
       athlete_name = VALUES(athlete_name),
       gender_priority = VALUES(gender_priority),
       result_count = VALUES(result_count),
       candidate_rank = VALUES(candidate_rank),
       updated_at = CURRENT_TIMESTAMP`,
    [
      candidate.primaryAthleteId,
      JSON.stringify(Array.from(candidate.athleteIds)),
      candidate.name,
      candidate.name,
      candidate.maleScore ? 'male' : 'other',
      candidate.resultCount,
      rank,
      SOURCE_TITLE,
    ]
  );
}

async function main() {
  const args = readArgs(process.argv);
  const connection = await createConnection();
  try {
    const candidates = await loadCandidates(connection, args);
    console.log(`候选运动员 ${candidates.length} 人，模式：${args.commit ? '写库' : 'dry-run'}`);
    candidates.slice(0, 50).forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} ${item.maleScore ? '男子优先' : '其他'} 成绩${item.resultCount}条`);
    });
    if (args.dryRun) return;
    for (let index = 0; index < candidates.length; index += 1) {
      await upsertCandidate(connection, candidates[index], index + 1);
    }
    console.log(`已写入候选队列 ${candidates.length} 条`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
