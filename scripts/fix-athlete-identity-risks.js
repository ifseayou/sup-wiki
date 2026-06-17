#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { parseTimeToSeconds } = require('./lib/result-time');

const repoRoot = path.resolve(__dirname, '..');
const CHANGZHOU_EVENT_ID = 297;

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

function connectionConfig(env) {
  return {
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  };
}

function isApply() {
  return process.argv.includes('--apply');
}

async function findChangzhouTimeFixes(conn) {
  const [rows] = await conn.execute(
    `SELECT result_id, athlete_name_snapshot, gender_group, discipline, finish_time, time_seconds
       FROM sup_event_results
      WHERE event_id = ?
        AND finish_time REGEXP '^[1-9][0-9]{1,2}:[0-9]{2}:[0-9]{2}$'
        AND CAST(SUBSTRING_INDEX(finish_time, ':', 1) AS UNSIGNED) > 2
        AND time_seconds > 7200
      ORDER BY result_id ASC`,
    [CHANGZHOU_EVENT_ID]
  );
  return rows
    .map((row) => ({
      ...row,
      next_time_seconds: parseTimeToSeconds(row.finish_time),
    }))
    .filter((row) => row.next_time_seconds !== null && Math.abs(Number(row.time_seconds) - row.next_time_seconds) > 0.001);
}

async function findInvalidConfirmedLinks(conn) {
  const [rows] = await conn.execute(
    `SELECT link_id, normalized_name, display_name, gender_hint, team_hint, confidence, note
       FROM sup_athlete_identity_links
      WHERE status = 'confirmed' AND athlete_id IS NULL
      ORDER BY updated_at DESC, link_id DESC`
  );
  return rows;
}

async function main() {
  const apply = isApply();
  const conn = await mysql.createConnection(connectionConfig(loadEnv()));
  const changzhouFixes = await findChangzhouTimeFixes(conn);
  const invalidLinks = await findInvalidConfirmedLinks(conn);

  const report = {
    dryRun: !apply,
    changzhouTimeFixes: {
      count: changzhouFixes.length,
      sample: changzhouFixes.slice(0, 12),
    },
    invalidConfirmedLinks: {
      count: invalidLinks.length,
      sample: invalidLinks.slice(0, 12),
    },
  };

  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    await conn.end();
    return;
  }

  await conn.beginTransaction();
  try {
    for (const row of changzhouFixes) {
      await conn.execute(
        `UPDATE sup_event_results
            SET time_seconds = ?
          WHERE result_id = ? AND event_id = ?`,
        [row.next_time_seconds, row.result_id, CHANGZHOU_EVENT_ID]
      );
    }
    const [linkUpdate] = await conn.execute(
      `UPDATE sup_athlete_identity_links
          SET status = 'pending',
              note = CONCAT(COALESCE(note, ''), '；系统修正：原 confirmed 但 athlete_id 为空，降级为 pending 待确认')
        WHERE status = 'confirmed' AND athlete_id IS NULL`
    );
    await conn.commit();
    console.log(JSON.stringify({
      ...report,
      applied: true,
      updatedChangzhouResults: changzhouFixes.length,
      downgradedIdentityLinks: linkUpdate.affectedRows,
    }, null, 2));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
