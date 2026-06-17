#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 同名身份拆分：一个 athlete_id 实为两个不同真人(重名)，把指定成绩行拆到新建的同名异性运动员。
 * 写 sup_athlete_merge_log(operation='split')，与后台「运动员迁移/回滚」范式一致，可 --rollback。
 * 用法：
 *   node scripts/split-athlete-identity.js corrections/athlete-splits.json --dry-run
 *   node scripts/split-athlete-identity.js corrections/athlete-splits.json
 *   node scripts/split-athlete-identity.js --rollback <batch_id>
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

function batchId() { return `split-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

async function doSplit(conn, plan) {
  const bid = batchId();
  const touched = new Set();
  const created = [];
  const summary = { batch_id: bid, splits: [] };
  if (!DRY) await conn.beginTransaction();
  try {
    for (const s of plan.splits) {
      const [[keep]] = await conn.query('SELECT athlete_id, name, nationality, discipline, status FROM sup_athletes WHERE athlete_id = ?', [s.keep_aid]);
      if (!keep) throw new Error(`keep athlete #${s.keep_aid} 不存在`);
      let newAid = null;
      const bio = `由同名身份拆分自原运动员 #${s.keep_aid}（与之为重名的不同真人）。`;
      console.log(`\n拆分「${s.name}」: keep #${s.keep_aid}(${keep.name}) → 新建${s.new_gender} ，移 ${s.move_result_ids.length} 行${DRY ? ' [dry]' : ''}`);
      if (!DRY) {
        const [ins] = await conn.query(
          `INSERT INTO sup_athletes (name, gender, gender_source, gender_confidence, nationality, discipline, bio, status)
           VALUES (?, ?, 'manual', 1.000, ?, ?, ?, ?)`,
          [s.name, s.new_gender, keep.nationality || '中国', keep.discipline || 'race', bio, keep.status || 'published']
        );
        newAid = ins.insertId;
        created.push(newAid);
        console.log(`  新运动员 #${newAid} (${s.name}/${s.new_gender})`);
      }
      // 重指成绩行 + 写日志
      for (const rid of s.move_result_ids) {
        const [[r]] = await conn.query('SELECT result_id, athlete_id, gender_group, discipline, rank_position, athlete_name_snapshot FROM sup_event_results WHERE result_id = ?', [rid]);
        if (!r) { console.warn(`  [skip] result #${rid} 不存在`); continue; }
        if (Number(r.athlete_id) !== Number(s.keep_aid)) { console.warn(`  [warn] result #${rid} 当前 athlete_id=${r.athlete_id} != keep ${s.keep_aid}`); }
        console.log(`  move result #${rid} [${r.gender_group}/${r.discipline}/rank${r.rank_position}] ${r.athlete_id} → ${newAid || 'NEW'}${DRY ? ' [dry]' : ''}`);
        if (!DRY) {
          await conn.query(
            `INSERT INTO sup_athlete_merge_log (batch_id, operation, table_name, pk_column, row_pk, from_athlete_id, to_athlete_id, note)
             VALUES (?, 'split', 'sup_event_results', 'result_id', ?, ?, ?, ?)`,
            [bid, rid, s.keep_aid, newAid, s.note || null]
          );
          await conn.query('UPDATE sup_event_results SET athlete_id = ? WHERE result_id = ?', [newAid, rid]);
          // 团队成员行同步
          const [mrows] = await conn.query('SELECT member_id FROM sup_event_result_members WHERE result_id = ? AND athlete_id = ?', [rid, s.keep_aid]);
          for (const m of mrows) {
            await conn.query(
              `INSERT INTO sup_athlete_merge_log (batch_id, operation, table_name, pk_column, row_pk, from_athlete_id, to_athlete_id, note)
               VALUES (?, 'split', 'sup_event_result_members', 'member_id', ?, ?, ?, ?)`,
              [bid, m.member_id, s.keep_aid, newAid, s.note || null]
            );
            await conn.query('UPDATE sup_event_result_members SET athlete_id = ? WHERE member_id = ?', [newAid, m.member_id]);
          }
        }
      }
      if (!DRY) { touched.add(Number(s.keep_aid)); touched.add(Number(newAid)); }
      summary.splits.push({ name: s.name, keep_aid: s.keep_aid, new_aid: newAid, moved: s.move_result_ids.length });
    }
    if (!DRY) {
      await conn.commit();
      for (const aid of touched) await syncAthleteRaceTimes(conn, aid);
    }
  } catch (e) { if (!DRY) await conn.rollback(); throw e; }
  summary.created_athletes = created;
  return summary;
}

async function doRollback(conn, bid) {
  const [logs] = await conn.query(
    "SELECT * FROM sup_athlete_merge_log WHERE batch_id=? AND operation='split' AND rolled_back=0 ORDER BY log_id DESC", [bid]
  );
  if (!logs.length) { console.log('该批次无可回滚记录'); return; }
  const touched = new Set();
  const newAids = new Set(logs.map((l) => Number(l.to_athlete_id)).filter(Boolean));
  await conn.beginTransaction();
  try {
    for (const lg of logs) {
      await conn.query(`UPDATE ${lg.table_name} SET athlete_id = ? WHERE ${lg.pk_column} = ?`, [lg.from_athlete_id, Number(lg.row_pk)]);
      touched.add(Number(lg.from_athlete_id));
    }
    await conn.query("UPDATE sup_athlete_merge_log SET rolled_back=1 WHERE batch_id=? AND operation='split' AND rolled_back=0", [bid]);
    // 删除本批拆出的、现已 0 成绩/0 成员的新运动员
    for (const aid of newAids) {
      const [[c]] = await conn.query(
        'SELECT (SELECT COUNT(*) FROM sup_event_results WHERE athlete_id=?) + (SELECT COUNT(*) FROM sup_event_result_members WHERE athlete_id=?) AS n', [aid, aid]
      );
      if (Number(c.n) === 0) { await conn.query('DELETE FROM sup_athletes WHERE athlete_id = ?', [aid]); console.log(`  删除空新运动员 #${aid}`); }
    }
    await conn.commit();
    for (const aid of touched) await syncAthleteRaceTimes(conn, aid);
    console.log(`已回滚 ${logs.length} 行`);
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
    if (!FILE) throw new Error('需提供 splits JSON 路径，或 --rollback <batch_id>');
    const plan = JSON.parse(fs.readFileSync(path.resolve(FILE), 'utf8'));
    console.log(`拆分计划：${FILE}${DRY ? ' （dry-run，未写库）' : ''}\n${plan.batch_note || ''}`);
    const summary = await doSplit(conn, plan);
    console.log('\n' + JSON.stringify(summary, null, 2));
  } finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
