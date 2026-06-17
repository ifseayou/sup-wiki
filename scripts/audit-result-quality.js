#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 成绩录入质量审计（只读，不写库）。按「单场比赛单元」= event+discipline+gender_group+board_class+round_label
 * 输出三类问题，供 PDF 核对：
 *   1) multi_first  : 同单元完赛者(rank=1, 非DNS/DNF) 出现 >1 个第一
 *   2) rank_gap     : 仅「决赛/无轮次」(非预赛/复赛 heats) 单元，完赛者名次非 1..N 连续（重号/断号）
 *   3) gender_mismatch: gender_group 含「女」却 join 到 male 运动员（反之亦然）
 * 用法：
 *   node scripts/audit-result-quality.js                 # 全库
 *   node scripts/audit-result-quality.js --event 11      # 只看某赛事
 *   node scripts/audit-result-quality.js --json out.json # 额外导出 JSON 工单
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const evIdx = process.argv.indexOf('--event');
const ONLY_EVENT = evIdx >= 0 ? Number(process.argv[evIdx + 1]) : null;
const jsonIdx = process.argv.indexOf('--json');
const JSON_OUT = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : null;

// 预赛/复赛/初赛/半决赛/排位/heat/semifinal/quarterfinal/preliminary = heats，跨组总名次，名次连续性不适用
const HEAT_RE = /(预赛|复赛|初赛|半决赛|资格|排位|heat|semifinal|quarter|prelim)/i;
function isFinalLike(rl) {
  if (rl === null || rl === undefined || String(rl).trim() === '') return true;
  return !HEAT_RE.test(String(rl));
}

function loadEnv() {
  const env = { ...process.env };
  const p = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const uKey = (r) => `${r.event_id}||${r.discipline}||${r.gender_group}||${r.board_class || ''}||${r.round_label || ''}`;

async function main() {
  const env = loadEnv();
  const c = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost', port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || '', database: env.MYSQL_DATABASE || 'sport_hacker',
  });
  try {
    const evWhere = ONLY_EVENT ? 'WHERE er.event_id = ?' : '';
    const evParams = ONLY_EVENT ? [ONLY_EVENT] : [];
    const [rows] = await c.execute(
      `SELECT er.result_id, er.event_id, er.discipline, er.gender_group, er.board_class, er.round_label,
              er.rank_position, er.bib_number, er.athlete_name_snapshot, er.finish_time,
              er.result_status_code, er.athlete_id, a.gender AS athlete_gender, a.gender_source
       FROM sup_event_results er
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       ${evWhere}
       ORDER BY er.event_id, er.discipline, er.gender_group, er.board_class, er.round_label, er.rank_position`,
      evParams
    );
    const [evRows] = await c.execute(`SELECT event_id, name FROM sup_events`);
    const eventName = new Map(evRows.map((e) => [Number(e.event_id), e.name]));
    const [srcRows] = await c.execute(
      `SELECT event_id, GROUP_CONCAT(DISTINCT source_url SEPARATOR ' | ') urls
       FROM sup_event_result_sources WHERE source_url IS NOT NULL GROUP BY event_id`
    );
    const eventSrc = new Map(srcRows.map((s) => [Number(s.event_id), s.urls]));

    // group into race-units
    const units = new Map();
    for (const r of rows) {
      const k = uKey(r);
      if (!units.has(k)) units.set(k, { ...r, board_class: r.board_class || '', round_label: r.round_label || '', rows: [] });
      units.get(k).rows.push(r);
    }

    const findings = []; // {event_id, unit, issues:[], detail}
    for (const u of units.values()) {
      // 完赛者：无 DNS/DNF 状态码 且 名次非哨兵值(<9000)。哨兵 9001+ 是非完赛占位（部分缺状态码）。
      const completers = u.rows.filter((r) => (!r.result_status_code || String(r.result_status_code).trim() === '') && Number(r.rank_position) < 9000);
      const issues = [];
      // 1) multi_first —— 仅「决赛/无轮次」单元；预赛/复赛 heats 每组各有一名第一属正常
      const firsts = completers.filter((r) => Number(r.rank_position) === 1);
      if (isFinalLike(u.round_label) && firsts.length > 1) issues.push({ type: 'multi_first', n: firsts.length });
      // 2) rank_gap — only final-like units；用标准竞赛名次(1224)规则，允许并列(同名次)
      // 合法：排序后第 i 名(1-based)的 rank 必须 = 比它名次小的人数 + 1。并列同名次后下一名次跳号。
      let rankInfo = null;
      if (isFinalLike(u.round_label)) {
        const ranks = completers.map((r) => Number(r.rank_position)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
        const n = ranks.length;
        let ok = n === 0 || ranks[0] === 1;
        let smaller = 0; let prev = null;
        for (let i = 0; i < ranks.length; i++) {
          if (ranks[i] !== prev) smaller = i; // 比当前名次小的人数 = 其首次出现的下标
          if (ranks[i] !== smaller + 1) ok = false;
          prev = ranks[i];
        }
        if (n > 0 && !ok) {
          const distinct = new Set(ranks);
          issues.push({ type: 'rank_gap', n, distinct: distinct.size, dup: n - distinct.size, min: ranks[0], max: ranks[n - 1], tier: (n - distinct.size) > 0 ? 'dup' : 'gap' });
        }
        rankInfo = { n, ok };
      }
      // 3) gender_mismatch (matched athletes with manual? note source)
      const fem = /女/.test(u.gender_group);
      const male = /男/.test(u.gender_group) && !fem;
      let gm = 0; const gmRows = [];
      if (fem || male) {
        for (const r of u.rows) {
          if (!r.athlete_gender) continue;
          if (fem && r.athlete_gender === 'male') { gm++; gmRows.push(r); }
          if (male && r.athlete_gender === 'female') { gm++; gmRows.push(r); }
        }
      }
      if (gm > 0) issues.push({ type: 'gender_mismatch', n: gm });

      if (issues.length) {
        findings.push({
          event_id: u.event_id,
          event_name: eventName.get(Number(u.event_id)) || '',
          source_url: eventSrc.get(Number(u.event_id)) || '',
          discipline: u.discipline, gender_group: u.gender_group,
          board_class: u.board_class, round_label: u.round_label,
          completers: completers.length, total: u.rows.length,
          rankInfo,
          issues,
          // 整段错组嫌疑：multi_first 且名次重号成套
          suspect_block_mislabel: issues.some((i) => i.type === 'multi_first') && issues.some((i) => i.type === 'rank_gap' && i.tier === 'dup'),
          sample: u.rows.slice(0, 60).map((r) => ({
            result_id: r.result_id, rank: r.rank_position, name: r.athlete_name_snapshot,
            bib: r.bib_number, time: r.finish_time, st: r.result_status_code, g: r.athlete_gender,
          })),
        });
      }
    }

    // aggregate by event
    const byEvent = new Map();
    for (const f of findings) {
      if (!byEvent.has(f.event_id)) byEvent.set(f.event_id, { event_id: f.event_id, name: f.event_name, source_url: f.source_url, mf: 0, rg: 0, gm: 0, units: [] });
      const agg = byEvent.get(f.event_id);
      for (const is of f.issues) { if (is.type === 'multi_first') agg.mf++; if (is.type === 'rank_gap') agg.rg++; if (is.type === 'gender_mismatch') agg.gm++; }
      agg.units.push(f);
    }
    const events = [...byEvent.values()].sort((a, b) => (b.mf + b.gm) - (a.mf + a.gm) || b.rg - a.rg);

    console.log(`\n审计完成：${units.size} 个比赛单元，命中 ${findings.length} 个问题单元，涉及 ${events.length} 个赛事${ONLY_EVENT ? `（仅 #${ONLY_EVENT}）` : ''}\n`);
    console.log('event_id  多第一  断号/重  性别错组  赛事');
    for (const e of events) {
      console.log(`#${String(e.event_id).padEnd(6)} ${String(e.mf).padStart(5)} ${String(e.rg).padStart(7)} ${String(e.gm).padStart(8)}    ${String(e.name).slice(0, 36)}`);
    }
    if (JSON_OUT) {
      fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify({ generated_units: units.size, events }, null, 2));
      console.log(`\n工单已写入 ${JSON_OUT}`);
    }
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
