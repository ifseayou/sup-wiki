#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

const PERSONAL_TEAM_NAMES = new Set(['', '-', '--', '/', '个人', '无', '无队伍', '个人参赛', '个人报名', '独立参赛', '暂无', '未知']);

function loadEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  const env = { ...process.env };
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

function cleanTeamName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（［【]/g, '(')
    .replace(/[）］】]/g, ')')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function normalizeTeamName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（［【]/g, '(')
    .replace(/[）］】]/g, ')')
    .replace(/\s+/g, '')
    .replace(/[·•]/g, '')
    .toLowerCase();
}

function isClaimableTeamName(value) {
  const clean = cleanTeamName(value);
  if (!clean || PERSONAL_TEAM_NAMES.has(clean)) return false;
  const normalized = normalizeTeamName(clean);
  return normalized.length >= 2 && !PERSONAL_TEAM_NAMES.has(normalized);
}

async function findClubId(connection, normalizedName) {
  const [rows] = await connection.execute(
    `SELECT club_id
     FROM sup_clubs
     WHERE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, ' ', ''), '　', ''), '（', '('), '）', ')'), '·', ''), '•', '')) = ?
     ORDER BY status = 'published' DESC, club_id ASC
     LIMIT 1`,
    [normalizedName]
  );
  return rows[0] ? Number(rows[0].club_id) : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
    charset: 'utf8mb4',
  });

  try {
    const [rows] = await connection.execute(
      `SELECT
         team_name,
         MIN(event_id) AS first_event_id,
         MAX(event_id) AS last_event_id,
         COUNT(*) AS result_count,
         COUNT(DISTINCT event_id) AS event_count,
         COUNT(DISTINCT COALESCE(athlete_id, athlete_name_snapshot)) AS athlete_count
       FROM sup_event_results
       WHERE team_name IS NOT NULL AND team_name <> ''
       GROUP BY team_name
       ORDER BY result_count DESC, team_name ASC`
    );

    let considered = 0;
    let skipped = 0;
    let confirmed = 0;
    let unmatched = 0;

    for (const row of rows) {
      if (!isClaimableTeamName(row.team_name)) {
        skipped += 1;
        continue;
      }
      considered += 1;
      const raw = cleanTeamName(row.team_name);
      const normalized = normalizeTeamName(raw);
      const clubId = await findClubId(connection, normalized);
      if (clubId) confirmed += 1;
      else unmatched += 1;

      if (!dryRun) {
        await connection.execute(
          `UPDATE sup_event_results
           SET team_name_normalized = ?
           WHERE team_name = ? AND (team_name_normalized IS NULL OR team_name_normalized <> ?)`,
          [normalized, row.team_name, normalized]
        );
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
             result_count = VALUES(result_count),
             event_count = VALUES(event_count),
             athlete_count = VALUES(athlete_count),
             first_seen_event_id = VALUES(first_seen_event_id),
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
            row.first_event_id || null,
            row.last_event_id || null,
          ]
        );
      }
    }

    console.log(JSON.stringify({ dryRun, sourceRows: rows.length, considered, skipped, confirmed, unmatched }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
