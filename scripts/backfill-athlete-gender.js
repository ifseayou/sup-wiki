#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');
const { inferGenderFromGroup, inferGenderFromVotes } = require('./athlete-gender-utils');

function readArgs(argv) {
  return {
    commit: argv.includes('--commit'),
    limit: Number(argv[argv.indexOf('--limit') + 1]) || 0,
  };
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

async function main() {
  const args = readArgs(process.argv);
  const connection = await createConnection();
  try {
    const [rows] = await connection.execute(`
      SELECT a.athlete_id, er.gender_group, er.board_class, er.team_name
      FROM sup_athletes a
      INNER JOIN sup_event_results er ON er.athlete_id = a.athlete_id
      WHERE a.status = 'published'
        AND COALESCE(a.gender_source, 'unknown') <> 'manual'
        AND er.is_verified = 1
        AND er.review_status = 'confirmed'
    `);
    const votesByAthlete = new Map();
    for (const row of rows) {
      const id = Number(row.athlete_id);
      const votes = votesByAthlete.get(id) || { male: 0, female: 0, mixed: 0, unknown: 0 };
      const gender = inferGenderFromGroup(row);
      votes[gender] += 1;
      votesByAthlete.set(id, votes);
    }

    const updates = Array.from(votesByAthlete.entries()).map(([athleteId, votes]) => ({
      athleteId,
      votes,
      ...inferGenderFromVotes(votes),
    }));
    const selected = args.limit > 0 ? updates.slice(0, args.limit) : updates;
    const writable = selected.filter((item) => item.gender !== 'unknown');
    const summary = selected.reduce((acc, item) => {
      acc[item.gender] = (acc[item.gender] || 0) + 1;
      return acc;
    }, {});
    console.log(`运动员性别回填 ${args.commit ? 'commit' : 'dry-run'}，待处理 ${selected.length} 人`);
    console.table(summary);
    if (!args.commit) return;

    for (const item of writable) {
      await connection.execute(
        `UPDATE sup_athletes
         SET gender = ?, gender_source = 'result_inferred', gender_confidence = ?
         WHERE athlete_id = ? AND COALESCE(gender_source, 'unknown') <> 'manual'`,
        [item.gender, item.confidence || null, item.athleteId]
      );
    }
    console.log(`已回填 ${writable.length} 名运动员性别，跳过 ${selected.length - writable.length} 名无法稳定判断的运动员`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
