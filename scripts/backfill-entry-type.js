#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 回填 sup_event_results.entry_type：团体 ⇐ discipline_family='team' / normalized_key team_* /
 * 关键词(龙板/团体/接力/家庭/混双/双人/多人/dragon/relay) / ≥2 名队员；其余 individual。
 * 用法：node scripts/backfill-entry-type.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

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

const TEXT = "CONCAT_WS(' ', COALESCE(er.discipline,''), COALESCE(er.gender_group,''), COALESCE(er.round_label,''), COALESCE(er.team_name,''))";
const TEAM_DETECT = `(
  er.discipline_family = 'team'
  OR er.normalized_discipline_key LIKE 'team\\_%'
  OR ${TEXT} LIKE '%龙板%' OR LOWER(${TEXT}) LIKE '%dragon%'
  OR ${TEXT} LIKE '%团体%' OR ${TEXT} LIKE '%团队%' OR ${TEXT} LIKE '%接力%' OR LOWER(${TEXT}) LIKE '%relay%'
  OR ${TEXT} LIKE '%家庭%' OR ${TEXT} LIKE '%混合双人%' OR ${TEXT} LIKE '%双人%' OR ${TEXT} LIKE '%四人%' OR ${TEXT} LIKE '%多人%'
  OR EXISTS (SELECT 1 FROM sup_event_result_members erm_t WHERE erm_t.result_id = er.result_id LIMIT 1 OFFSET 1)
)`;

async function main() {
  const env = loadEnv();
  const c = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost', port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || '', database: env.MYSQL_DATABASE || 'sport_hacker',
  });
  try {
    const [[before]] = await c.query("SELECT SUM(entry_type='team') t, SUM(entry_type='individual') i FROM sup_event_results");
    const [[detect]] = await c.query(`SELECT COUNT(*) n FROM sup_event_results er WHERE ${TEAM_DETECT}`);
    console.log(`当前 entry_type: team=${before.t} individual=${before.i}；检测为团体的行=${detect.n}${DRY ? ' (dry-run)' : ''}`);
    if (!DRY) {
      const [r1] = await c.query(`UPDATE sup_event_results er SET entry_type='team' WHERE ${TEAM_DETECT}`);
      const [r2] = await c.query(`UPDATE sup_event_results er SET entry_type='individual' WHERE NOT ${TEAM_DETECT}`);
      console.log(`已置 team: ${r1.affectedRows}，置 individual: ${r2.affectedRows}`);
      const [[after]] = await c.query("SELECT SUM(entry_type='team') t, SUM(entry_type='individual') i FROM sup_event_results");
      console.log(`回填后: team=${after.t} individual=${after.i}`);
      const [[gap]] = await c.query("SELECT COUNT(*) n FROM (SELECT er.result_id FROM sup_event_results er JOIN sup_event_result_members m ON m.result_id=er.result_id WHERE er.entry_type<>'team' GROUP BY er.result_id HAVING COUNT(*)>=2) x");
      console.log(`残留(≥2队员却非team): ${gap.n}（应为0）`);
    }
  } finally { await c.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
