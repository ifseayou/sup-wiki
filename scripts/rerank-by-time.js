#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 按完赛用时重排名次（修复「真完赛者被错给哨兵名次 9000+」「名次错乱」）。
 * 仅对 决赛/无轮次 的个人(entry_type='individual') 单元，且当前名次违反 1224 时才动；
 * 完赛者 = 无 DNS/DNF 状态码 且 time_seconds>0；按 time_seconds 升序赋 1..N(并列同名次)。
 * 仅适用于按用时排名的比赛(长距离/计时决赛)。逐行写 sup_result_fix_log(operation='rerank') 可回滚。
 * 用法：node scripts/rerank-by-time.js --event N [--discipline X] [--apply]   （默认 dry-run）
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const num = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const EVENT = Number(num('--event'));
const DISC = num('--discipline');
const GROUP = num('--group');
const APPLY = process.argv.includes('--apply');

const HEAT_RE = /(预赛|复赛|初赛|半决赛|资格|排位|heat|semi|quarter|prelim)/i;
const isFinalLike = (rl) => rl == null || String(rl).trim() === '' || !HEAT_RE.test(String(rl));

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

async function syncAthleteRaceTimes(conn, athleteId) {
  if (!athleteId) return;
  const [rows] = await conn.execute(
    `SELECT DISTINCT er.discipline, er.round_label, er.result_label, er.finish_time,
            er.result_status_code, er.result_status_note, er.rank_position,
            er.discipline_family, er.entry_type, e.start_date, e.event_id, e.name AS event_name
     FROM sup_event_results er INNER JOIN sup_events e ON e.event_id = er.event_id
     LEFT JOIN sup_event_result_members erm ON erm.result_id = er.result_id
     WHERE er.athlete_id = ? OR erm.athlete_id = ? ORDER BY e.start_date DESC, er.rank_position ASC`,
    [athleteId, athleteId]
  );
  const rt = rows.map((r) => ({
    distance: r.discipline, year: r.start_date ? new Date(r.start_date).getFullYear() : undefined,
    event: r.event_name, event_id: r.event_id, round: r.round_label || undefined, result: r.result_label || undefined,
    time: r.finish_time, status: r.result_status_code || undefined, status_label: r.result_status_note || undefined,
    family: r.discipline_family || 'unknown', entry_type: r.entry_type === 'team' ? 'team' : 'individual', is_team: r.entry_type === 'team',
  }));
  await conn.execute('UPDATE sup_athletes SET race_times=? WHERE athlete_id=?', [JSON.stringify(rt), athleteId]);
}

// 1224 名次：排序后第 i 名(0-based) rank = 比它小的人数+1；时间相等并列。
function assign1224(sorted) {
  const out = []; let smaller = 0; let prevSec = null;
  for (let i = 0; i < sorted.length; i++) {
    if (prevSec === null || sorted[i].sec !== prevSec) smaller = i;
    out.push({ ...sorted[i], newRank: smaller + 1 }); prevSec = sorted[i].sec;
  }
  return out;
}
function currentBad(finishers) {
  const ranks = finishers.map((r) => Number(r.rank_position)).sort((a, b) => a - b);
  if (!ranks.length || ranks[0] !== 1) return true;
  let smaller = 0, prev = null;
  for (let i = 0; i < ranks.length; i++) { if (ranks[i] !== prev) smaller = i; if (ranks[i] !== smaller + 1) return true; prev = ranks[i]; }
  return false;
}
const uKey = (r) => `${r.discipline}||${r.gender_group}||${r.board_class || ''}||${r.round_label || ''}`;

function batchId() { return `rerank-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

async function main() {
  if (!EVENT) throw new Error('需 --event N');
  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost', port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || '', database: env.MYSQL_DATABASE || 'sport_hacker',
  });
  try {
    const params = [EVENT];
    let sql = `SELECT result_id, athlete_id, discipline, gender_group, board_class, round_label, rank_position,
                      athlete_name_snapshot, finish_time, time_seconds, result_status_code, entry_type
               FROM sup_event_results WHERE event_id=? AND entry_type='individual'`;
    if (DISC) { sql += ' AND discipline=?'; params.push(DISC); }
    if (GROUP) { sql += ' AND gender_group=?'; params.push(GROUP); }
    const [rows] = await conn.execute(sql, params);
    const units = new Map();
    for (const r of rows) { const k = uKey(r); if (!units.has(k)) units.set(k, []); units.get(k).push(r); }

    const bid = batchId();
    const touched = new Set();
    let changedUnits = 0, changedRows = 0, skipped = 0;
    if (APPLY) await conn.beginTransaction();
    try {
      for (const [k, urows] of units) {
        const rl = urows[0].round_label;
        if (!isFinalLike(rl)) continue;
        const finishers = urows.filter((r) => (!r.result_status_code || String(r.result_status_code).trim() === '') && Number(r.time_seconds) > 0);
        if (finishers.length < 2) continue;
        if (!currentBad(finishers)) continue; // 已合规不动
        // 是否有完赛者缺 time_seconds（无法时间排序）→ 跳过该单元，需人工
        const validFinisherSet = new Set(finishers.map((r) => r.result_id));
        const noTime = urows.filter((r) => (!r.result_status_code || String(r.result_status_code).trim() === '') && !(Number(r.time_seconds) > 0));
        if (noTime.length) { console.log(`  [skip] ${k} 有 ${noTime.length} 个完赛者无 time_seconds，需人工`); skipped++; continue; }
        const sorted = assign1224([...finishers].map((r) => ({ ...r, sec: Number(r.time_seconds) })).sort((a, b) => a.sec - b.sec));
        const changes = sorted.filter((r) => Number(r.rank_position) !== r.newRank);
        if (!changes.length) continue;
        changedUnits++;
        console.log(`\n[${k}] 完赛 ${finishers.length}，改 ${changes.length} 行:`);
        for (const c of changes) {
          console.log(`   #${c.result_id} ${c.athlete_name_snapshot} ${c.finish_time}  rank ${c.rank_position} → ${c.newRank}`);
          if (APPLY) {
            await conn.query(
              `INSERT INTO sup_result_fix_log (batch_id,operation,result_id,event_id,field_name,old_value,new_value,note) VALUES (?,?,?,?,?,?,?,?)`,
              [bid, 'rerank', c.result_id, EVENT, 'rank_position', String(c.rank_position), String(c.newRank), '按完赛用时重排(修复哨兵/错乱名次)']
            );
            await conn.query('UPDATE sup_event_results SET rank_position=? WHERE result_id=?', [c.newRank, c.result_id]);
            if (c.athlete_id) touched.add(Number(c.athlete_id));
          }
          changedRows++;
        }
      }
      if (APPLY) { await conn.commit(); for (const aid of touched) await syncAthleteRaceTimes(conn, aid); }
    } catch (e) { if (APPLY) await conn.rollback(); throw e; }
    console.log(`\n${APPLY ? '已修改' : 'DRY-RUN'}：单元 ${changedUnits}，行 ${changedRows}，跳过(需人工) ${skipped}${APPLY ? `，batch=${bid}` : ''}`);
  } finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
