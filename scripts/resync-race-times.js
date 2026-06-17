#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 全量重算所有运动员 race_times，带 family / entry_type / is_team（个人主页分模块+团体分区用）。
 * 与 src/lib/event-results.ts 的 syncAthleteRaceTimes 同口径，仅扩展字段。
 * 用连接池并发加速（远程 DB 往返多）。用法：node scripts/resync-race-times.js [--limit N] [--athlete ID] [--concurrency 12]
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const num = (flag, def) => { const i = process.argv.indexOf(flag); return i >= 0 ? Number(process.argv[i + 1]) : def; };
const LIMIT = num('--limit', 0);
const ONLY = num('--athlete', 0);
const CONC = num('--concurrency', 12);

function loadEnv() {
  const env = { ...process.env };
  const p = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

async function syncOne(pool, athleteId) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT er.discipline, er.round_label, er.result_label, er.finish_time,
            er.result_status_code, er.result_status_note, er.rank_position,
            er.discipline_family, er.normalized_discipline_key, er.entry_type,
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
    event: row.event_name, event_id: row.event_id,
    round: row.round_label || undefined, result: row.result_label || undefined,
    time: row.finish_time, status: row.result_status_code || undefined,
    status_label: row.result_status_note || undefined,
    family: row.discipline_family || 'unknown',
    entry_type: row.entry_type === 'team' ? 'team' : 'individual',
    is_team: row.entry_type === 'team',
  }));
  await pool.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
}

async function main() {
  const env = loadEnv();
  const pool = mysql.createPool({
    host: env.MYSQL_HOST || 'localhost', port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || '', database: env.MYSQL_DATABASE || 'sport_hacker',
    connectionLimit: CONC, waitForConnections: true,
  });
  try {
    let ids;
    if (ONLY) ids = [ONLY];
    else {
      const [rows] = await pool.query(
        `SELECT DISTINCT aid FROM (
           SELECT athlete_id aid FROM sup_event_results WHERE athlete_id IS NOT NULL
           UNION SELECT athlete_id aid FROM sup_event_result_members WHERE athlete_id IS NOT NULL
         ) x ORDER BY aid${LIMIT ? ` LIMIT ${LIMIT}` : ''}`
      );
      ids = rows.map((r) => Number(r.aid));
    }
    console.log(`重算 ${ids.length} 名运动员 race_times（并发 ${CONC}）...`);
    let done = 0; let next = 0;
    async function worker() {
      while (next < ids.length) {
        const aid = ids[next++];
        try { await syncOne(pool, aid); } catch (e) { console.warn(`  #${aid} 失败: ${e.message}`); }
        if (++done % 1000 === 0) console.log(`  ${done}/${ids.length}`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, ids.length) }, worker));
    const [[stat]] = await pool.query("SELECT COUNT(*) n FROM sup_athletes WHERE race_times LIKE '%\"is_team\":true%'");
    console.log(`完成 ${done}；含团体成绩的运动员约 ${stat.n} 名`);
  } finally { await pool.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
