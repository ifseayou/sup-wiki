#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 回填 sup_events.nationality（与运动员国籍同体系）。
 * 信号：province 能被国籍体系识别为已知国家(如 Thailand/USA/UAE)→该国；否则(中文省份等)→中国。
 * 用法：node scripts/backfill-event-nationality.js [--dry-run] [--force]
 *   默认只填 nationality 为空的；--force 覆盖全部重算。
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const mysql = require('mysql2/promise');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

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

function loadNationalityModule() {
  const filename = path.join(repoRoot, 'src/lib/nationality.ts');
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(out, filename);
  return mod.exports;
}

async function main() {
  const { explainNationalityNormalization } = loadNationalityModule();
  const env = loadEnv();
  const c = await mysql.createConnection({
    host: env.MYSQL_HOST || '127.0.0.1', port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || '', database: env.MYSQL_DATABASE || 'sport_hacker',
  });
  try {
    const where = FORCE ? '' : "WHERE nationality IS NULL OR nationality = ''";
    const [rows] = await c.execute(`SELECT event_id, name, province, nationality FROM sup_events ${where}`);
    const dist = {};
    let updated = 0;
    for (const e of rows) {
      const ex = explainNationalityNormalization(e.province);
      const nat = ex && ex.known ? ex.normalized : '中国';
      dist[nat] = (dist[nat] || 0) + 1;
      if (nat !== '中国' || e.province) { /* always set */ }
      if (!DRY) { await c.execute('UPDATE sup_events SET nationality = ? WHERE event_id = ?', [nat, e.event_id]); updated += 1; }
    }
    console.log(`扫描 ${rows.length} 个赛事${DRY ? '（dry-run，未写库）' : ''}`);
    console.log('国家分布:', Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
    if (!DRY) console.log('已更新:', updated);
    // 列出非中国的，便于人工核对
    const foreign = rows.filter((e) => { const ex = explainNationalityNormalization(e.province); return ex && ex.known && ex.normalized !== '中国'; });
    if (foreign.length) { console.log('非中国赛事:'); for (const e of foreign) console.log(`  #${e.event_id} province=${e.province} → ${explainNationalityNormalization(e.province).normalized} | ${String(e.name).slice(0, 30)}`); }
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
