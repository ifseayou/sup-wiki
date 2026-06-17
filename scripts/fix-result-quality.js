#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 数据驱动的成绩录入修复（事务 + 逐行 fix-log，可回滚）。
 * 修复指令来自 PDF 已核对的 corrections JSON，每条 op：
 *   relabel : { op:'relabel', result_ids:[...], set:{gender_group?,discipline?,round_label?}, note }
 *   rerank  : { op:'rerank',  result_id:N, rank_position:N, note }   // 或 result_ids+rank_map
 *   delete  : { op:'delete',  result_ids:[...], note }               // 整行快照入 log
 * 用法：
 *   node scripts/fix-result-quality.js corrections/<file>.json --dry-run
 *   node scripts/fix-result-quality.js corrections/<file>.json            # 执行
 *   node scripts/fix-result-quality.js --rollback <batch_id>
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const rbIdx = args.indexOf('--rollback');
const ROLLBACK = rbIdx >= 0 ? args[rbIdx + 1] : null;
const FILE = args.find((a) => a.endsWith('.json'));

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
            er.discipline_family, er.entry_type,
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
  await conn.execute('UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?', [JSON.stringify(raceTimes), athleteId]);
}

function batchId() { return `resfix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
const RELABEL_FIELDS = ['gender_group', 'discipline', 'round_label', 'board_class'];

async function fetchRow(conn, rid) {
  const [[r]] = await conn.query('SELECT * FROM sup_event_results WHERE result_id = ?', [rid]);
  return r || null;
}

async function doFix(conn, plan) {
  const bid = batchId();
  const touchedAthletes = new Set();
  const summary = { batch_id: bid, relabel: 0, rerank: 0, delete: 0, ops: [] };
  if (!DRY) await conn.beginTransaction();
  try {
    for (const op of plan.corrections) {
      if (op.op === 'relabel') {
        const ids = op.result_ids || (op.result_id ? [op.result_id] : []);
        for (const rid of ids) {
          const row = await fetchRow(conn, rid);
          if (!row) { console.warn(`  [skip] result_id ${rid} 不存在`); continue; }
          if (row.athlete_id) touchedAthletes.add(Number(row.athlete_id));
          for (const f of RELABEL_FIELDS) {
            if (op.set[f] === undefined) continue;
            const oldV = row[f]; const newV = op.set[f];
            if (String(oldV ?? '') === String(newV)) continue;
            console.log(`  relabel #${rid} [${row.athlete_name_snapshot} rank${row.rank_position}] ${f}: ${oldV ?? '∅'} → ${newV}${DRY ? ' [dry]' : ''}`);
            if (!DRY) {
              await conn.query(
                `INSERT INTO sup_result_fix_log (batch_id,operation,result_id,event_id,field_name,old_value,new_value,note) VALUES (?,?,?,?,?,?,?,?)`,
                [bid, 'relabel', rid, row.event_id, f, oldV == null ? null : String(oldV), String(newV), op.note || null]
              );
              await conn.query(`UPDATE sup_event_results SET ${f} = ? WHERE result_id = ?`, [newV, rid]);
            }
            summary.relabel++;
          }
        }
      } else if (op.op === 'rerank') {
        const map = op.rank_map || (op.result_id ? { [op.result_id]: op.rank_position } : {});
        for (const [rid, rank] of Object.entries(map)) {
          const row = await fetchRow(conn, Number(rid));
          if (!row) { console.warn(`  [skip] result_id ${rid} 不存在`); continue; }
          if (row.athlete_id) touchedAthletes.add(Number(row.athlete_id));
          if (Number(row.rank_position) === Number(rank)) continue;
          console.log(`  rerank #${rid} rank: ${row.rank_position} → ${rank}${DRY ? ' [dry]' : ''}`);
          if (!DRY) {
            await conn.query(
              `INSERT INTO sup_result_fix_log (batch_id,operation,result_id,event_id,field_name,old_value,new_value,note) VALUES (?,?,?,?,?,?,?,?)`,
              [bid, 'rerank', Number(rid), row.event_id, 'rank_position', String(row.rank_position), String(rank), op.note || null]
            );
            await conn.query('UPDATE sup_event_results SET rank_position = ? WHERE result_id = ?', [Number(rank), Number(rid)]);
          }
          summary.rerank++;
        }
      } else if (op.op === 'delete') {
        const ids = op.result_ids || (op.result_id ? [op.result_id] : []);
        for (const rid of ids) {
          const row = await fetchRow(conn, rid);
          if (!row) { console.warn(`  [skip] result_id ${rid} 不存在`); continue; }
          if (row.athlete_id) touchedAthletes.add(Number(row.athlete_id));
          console.log(`  delete #${rid} (${row.gender_group}/${row.discipline}/rank ${row.rank_position} ${row.athlete_name_snapshot})${DRY ? ' [dry]' : ''}`);
          if (!DRY) {
            await conn.query(
              `INSERT INTO sup_result_fix_log (batch_id,operation,result_id,event_id,field_name,snapshot,note) VALUES (?,?,?,?,?,?,?)`,
              [bid, 'delete', rid, row.event_id, null, JSON.stringify(row), op.note || null]
            );
            await conn.query('DELETE FROM sup_event_results WHERE result_id = ?', [rid]);
          }
          summary.delete++;
        }
      } else {
        throw new Error(`未知 op: ${op.op}`);
      }
    }
    if (!DRY) {
      await conn.commit();
      for (const aid of touchedAthletes) await syncAthleteRaceTimes(conn, aid);
    }
  } catch (e) { if (!DRY) await conn.rollback(); throw e; }
  summary.syncedAthletes = touchedAthletes.size;
  return summary;
}

async function doRollback(conn, bid) {
  const [logs] = await conn.query(
    "SELECT * FROM sup_result_fix_log WHERE batch_id=? AND rolled_back=0 ORDER BY (operation='delete') DESC, log_id DESC",
    [bid]
  );
  if (!logs.length) { console.log('该批次无可回滚记录'); return; }
  const touched = new Set();
  await conn.beginTransaction();
  try {
    for (const lg of logs) {
      if (lg.operation === 'delete') {
        const snap = typeof lg.snapshot === 'string' ? JSON.parse(lg.snapshot) : lg.snapshot;
        const cols = Object.keys(snap);
        const placeholders = cols.map(() => '?').join(',');
        await conn.query(
          `INSERT INTO sup_event_results (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${placeholders})`,
          cols.map((c) => snap[c])
        );
        if (snap.athlete_id) touched.add(Number(snap.athlete_id));
      } else {
        await conn.query(`UPDATE sup_event_results SET ${lg.field_name} = ? WHERE result_id = ?`, [lg.old_value, Number(lg.result_id)]);
        const [[r]] = await conn.query('SELECT athlete_id FROM sup_event_results WHERE result_id = ?', [Number(lg.result_id)]);
        if (r && r.athlete_id) touched.add(Number(r.athlete_id));
      }
    }
    await conn.query('UPDATE sup_result_fix_log SET rolled_back=1 WHERE batch_id=? AND rolled_back=0', [bid]);
    await conn.commit();
    for (const aid of touched) await syncAthleteRaceTimes(conn, aid);
    console.log(`已回滚 ${logs.length} 条，重算 ${touched.size} 名运动员`);
  } catch (e) { await conn.rollback(); throw e; }
}

async function main() {
  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost', port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || '', database: env.MYSQL_DATABASE || 'sport_hacker',
  });
  try {
    if (ROLLBACK) { await doRollback(conn, ROLLBACK); return; }
    if (!FILE) throw new Error('需提供 corrections JSON 路径，或 --rollback <batch_id>');
    const plan = JSON.parse(fs.readFileSync(path.resolve(FILE), 'utf8'));
    console.log(`修复计划：${FILE}${DRY ? ' （dry-run，未写库）' : ''}\n${plan.batch_note || ''}`);
    const summary = await doFix(conn, plan);
    console.log('\n' + JSON.stringify(summary, null, 2));
  } finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
