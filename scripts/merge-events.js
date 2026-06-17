#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 赛事合并：把 merge 赛事的全部子记录(成绩/组别/奖金/官员/积分/来源+软链)重指到 keep 赛事，
 * keep 改名，被合并赛事草稿化(不硬删)。逐行写 sup_event_merge_log，可按 batch_id 回滚。
 *
 * 默认合并 2024/2023 ICF 世锦赛三册。用法：
 *   node scripts/merge-events.js --dry-run         # 只看将搬动多少行
 *   node scripts/merge-events.js                   # 执行
 *   node scripts/merge-events.js --rollback <batch_id>
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const rbIdx = process.argv.indexOf('--rollback');
const ROLLBACK = rbIdx >= 0 ? process.argv[rbIdx + 1] : null;

const MERGES = [
  { keep: 345, merge: [349, 350], name: '2024 ICF SUP World Championships' },
  { keep: 347, merge: [346, 348], name: '2023 ICF SUP World Championships' },
];

const EVENT_FK_TABLES = [
  { table: 'sup_event_results', fk: 'event_id' },
  { table: 'sup_event_categories', fk: 'event_id' },
  { table: 'sup_event_category_prizes', fk: 'event_id' },
  { table: 'sup_event_officials', fk: 'event_id' },
  { table: 'sup_event_point_standings', fk: 'event_id' },
  { table: 'sup_event_result_sources', fk: 'event_id' },
  { table: 'sup_event_submissions', fk: 'event_id' },
  { table: 'sup_event_result_submissions', fk: 'event_id' },
  { table: 'sup_annual_point_event_mappings', fk: 'matched_event_id' },
  { table: 'sup_wechat_articles', fk: 'event_id' },
];

function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env.local', '.env']) {
    const p = path.join(repoRoot, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('='); if (i < 0) continue;
      const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

async function tableExists(conn, table) {
  const [r] = await conn.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [table]);
  return r[0].n > 0;
}
async function pkColumn(conn, table) {
  const [r] = await conn.query("SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION LIMIT 1", [table]);
  return r.length ? r[0].COLUMN_NAME : null;
}
function batchId() { return `evmerge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

async function doMerge(conn) {
  for (const m of MERGES) {
    const bid = batchId();
    console.log(`\n=== 合并 keep=#${m.keep} ← merge=[${m.merge.join(',')}]  batch=${bid} ===`);
    if (!DRY) await conn.beginTransaction();
    try {
      for (const fromId of m.merge) {
        for (const { table, fk } of EVENT_FK_TABLES) {
          if (!await tableExists(conn, table)) continue;
          const pk = await pkColumn(conn, table);
          if (!pk) continue;
          const [rows] = await conn.query(`SELECT ${pk} AS pk FROM ${table} WHERE ${fk} = ?`, [fromId]);
          if (!rows.length) continue;
          console.log(`  ${table}: ${rows.length} 行 (${fromId}→${m.keep})${DRY ? ' [dry]' : ''}`);
          if (DRY) continue;
          const values = rows.map((r) => [bid, 'merge', table, pk, Number(r.pk), fk, fromId, m.keep]);
          await conn.query(
            `INSERT INTO sup_event_merge_log (batch_id, operation, table_name, pk_column, row_pk, fk_column, from_event_id, to_event_id) VALUES ?`,
            [values]
          );
          await conn.query(`UPDATE ${table} SET ${fk} = ? WHERE ${fk} = ?`, [m.keep, fromId]);
        }
        // 草稿化被合并 event（先快照）
        if (!DRY) {
          const [[ev]] = await conn.query('SELECT status, event_status, name, name_en FROM sup_events WHERE event_id = ?', [fromId]);
          await conn.query(
            `INSERT INTO sup_event_merge_log (batch_id, operation, table_name, pk_column, row_pk, fk_column, from_event_id, to_event_id, snapshot) VALUES (?,?,?,?,?,?,?,?,?)`,
            [bid, 'merge', 'sup_events', 'event_id', fromId, 'event_id', fromId, m.keep, JSON.stringify(ev || {})]
          );
          await conn.query("UPDATE sup_events SET status='draft', event_status='cancelled' WHERE event_id = ?", [fromId]);
          console.log(`  event #${fromId} → draft/cancelled`);
        }
      }
      if (!DRY) {
        await conn.query('UPDATE sup_events SET name = ?, name_en = ? WHERE event_id = ?', [m.name, m.name, m.keep]);
        await conn.commit();
        const [[cnt]] = await conn.query('SELECT COUNT(*) n FROM sup_event_results WHERE event_id = ?', [m.keep]);
        console.log(`  keep #${m.keep} 改名「${m.name}」，现成绩数=${cnt.n}`);
      }
    } catch (e) { if (!DRY) await conn.rollback(); throw e; }
  }
}

async function doRollback(conn, bid) {
  console.log(`回滚 batch=${bid}`);
  const [logs] = await conn.query("SELECT * FROM sup_event_merge_log WHERE batch_id=? AND rolled_back=0 ORDER BY (table_name='sup_events') DESC, log_id DESC", [bid]);
  if (!logs.length) { console.log('该批次无可回滚记录'); return; }
  await conn.beginTransaction();
  try {
    for (const lg of logs) {
      if (lg.table_name === 'sup_events' && lg.snapshot) {
        const snap = typeof lg.snapshot === 'string' ? JSON.parse(lg.snapshot) : lg.snapshot;
        await conn.query('UPDATE sup_events SET status=?, event_status=?, name=?, name_en=? WHERE event_id=?',
          [snap.status, snap.event_status, snap.name, snap.name_en, Number(lg.row_pk)]);
      } else {
        await conn.query(`UPDATE ${lg.table_name} SET ${lg.fk_column} = ? WHERE ${lg.pk_column} = ?`, [lg.from_event_id, Number(lg.row_pk)]);
      }
    }
    await conn.query('UPDATE sup_event_merge_log SET rolled_back=1 WHERE batch_id=? AND rolled_back=0', [bid]);
    await conn.commit();
    console.log(`已回滚 ${logs.length} 行`);
  } catch (e) { await conn.rollback(); throw e; }
}

async function main() {
  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || '127.0.0.1', port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || '', database: env.MYSQL_DATABASE || 'sport_hacker',
    multipleStatements: false,
  });
  try {
    if (ROLLBACK) await doRollback(conn, ROLLBACK);
    else await doMerge(conn);
  } finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
