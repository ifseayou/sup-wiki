#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 回填 sup_event_results 的标准化字段与 category_id（Phase 2）。
 * 复用 src/lib/result-normalization.ts 的 normalizeResultDiscipline/normalizeResultGroup，
 * 与导入写入路径口径一致。category_id 按标准化 key 匹配同赛事 sup_event_categories。
 *
 * 用法：
 *   node scripts/backfill-result-normalization.js --dry-run        # 仅统计覆盖率，不写库
 *   node scripts/backfill-result-normalization.js                  # 实际回填
 *   node scripts/backfill-result-normalization.js --event 123      # 仅回填指定赛事
 *   node scripts/backfill-result-normalization.js --batch 1000     # 批大小（默认500）
 *   node scripts/backfill-result-normalization.js --only-missing   # 仅回填 normalized_discipline_key 为空的行
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const mysql = require('mysql2/promise');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { dryRun: false, batch: 500, eventId: null, onlyMissing: false };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--dry-run') args.dryRun = true;
    else if (item === '--only-missing') args.onlyMissing = true;
    else if (item === '--batch') args.batch = Math.max(50, Number(argv[++i] || 500));
    else if (item === '--event') args.eventId = Number(argv[++i] || 0) || null;
    else if (item === '--help' || item === '-h') args.help = true;
  }
  return args;
}

function loadEnv() {
  const env = { ...process.env };
  for (const fileName of ['.env.local', '.env']) {
    const envPath = path.join(repoRoot, fileName);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (env[key] === undefined) env[key] = value;
    }
  }
  return env;
}

function loadNormalizationModule() {
  const filename = path.join(repoRoot, 'src/lib/result-normalization.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

/** event_id -> Map(`${discKey}__${groupKey}` -> category_id) */
async function buildCategoryIndex(connection, norm) {
  const [rows] = await connection.execute(
    `SELECT category_id, event_id, discipline, gender_group, board_class FROM sup_event_categories`
  );
  const index = new Map();
  for (const row of rows) {
    const disc = norm.normalizeResultDiscipline(String(row.discipline || ''), row.board_class, null);
    // 项目键 unknown 不可靠匹配（多项目赛事会误绑），跳过。
    if (disc.normalized_key === 'unknown') continue;
    const grp = norm.normalizeResultGroup(String(row.gender_group || ''), row.board_class, null);
    const key = `${disc.normalized_key}__${grp.normalized_group_key}`;
    let evMap = index.get(Number(row.event_id));
    if (!evMap) { evMap = new Map(); index.set(Number(row.event_id), evMap); }
    if (!evMap.has(key)) evMap.set(key, Number(row.category_id));
  }
  return index;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/backfill-result-normalization.js [--dry-run] [--only-missing] [--event ID] [--batch N]');
    return;
  }
  const norm = loadNormalizationModule();
  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });

  const stats = {
    total: 0,
    updated: 0,
    discipline_known: 0,
    group_resolved: 0,
    category_hit: 0,
    low_confidence: 0,
  };

  try {
    const categoryIndex = await buildCategoryIndex(connection, norm);
    console.log(`Loaded category index for ${categoryIndex.size} events. dryRun=${args.dryRun} onlyMissing=${args.onlyMissing}${args.eventId ? ` event=${args.eventId}` : ''}`);

    const where = [];
    const baseParams = [];
    if (args.eventId) { where.push('event_id = ?'); baseParams.push(args.eventId); }
    if (args.onlyMissing) where.push('normalized_discipline_key IS NULL');
    let lastId = 0;
    for (;;) {
      const clause = [...where, 'result_id > ?'].join(' AND ');
      const [rows] = await connection.execute(
        `SELECT result_id, event_id, discipline, board_class, round_label, gender_group, team_name
         FROM sup_event_results
         WHERE ${clause}
         ORDER BY result_id ASC
         LIMIT ${args.batch}`,
        [...baseParams, lastId]
      );
      if (!rows.length) break;
      for (const row of rows) {
        lastId = Number(row.result_id);
        stats.total += 1;
        const disc = norm.normalizeResultDiscipline(String(row.discipline || ''), row.board_class, row.round_label);
        const grp = norm.normalizeResultGroup(String(row.gender_group || '公开组'), row.board_class, row.team_name);
        const confidence = Math.min(disc.confidence, grp.confidence);
        const evMap = categoryIndex.get(Number(row.event_id));
        const categoryId = evMap ? (evMap.get(`${disc.normalized_key}__${grp.normalized_group_key}`) ?? null) : null;

        if (disc.normalized_key !== 'unknown') stats.discipline_known += 1;
        if (grp.gender !== 'open_unknown' || grp.age_band !== 'unknown' || grp.team_type !== 'individual') stats.group_resolved += 1;
        if (categoryId) stats.category_hit += 1;
        if (confidence < 0.6) stats.low_confidence += 1;

        if (!args.dryRun) {
          await connection.execute(
            `UPDATE sup_event_results
             SET normalized_discipline_key = ?, discipline_family = ?, normalized_group_key = ?, norm_confidence = ?, category_id = ?
             WHERE result_id = ?`,
            [disc.normalized_key, disc.family, grp.normalized_group_key, confidence, categoryId, row.result_id]
          );
          stats.updated += 1;
        }
      }
      process.stdout.write(`\rprocessed ${stats.total} (lastId=${lastId})`);
    }
    process.stdout.write('\n');

    const pct = (n) => (stats.total ? ((n / stats.total) * 100).toFixed(2) : '0.00');
    console.log('--- Backfill summary ---');
    console.log(`total rows scanned : ${stats.total}`);
    console.log(`updated            : ${stats.updated}${args.dryRun ? ' (dry-run, no writes)' : ''}`);
    console.log(`discipline known   : ${stats.discipline_known} (${pct(stats.discipline_known)}%)`);
    console.log(`group resolved     : ${stats.group_resolved} (${pct(stats.group_resolved)}%)`);
    console.log(`category matched   : ${stats.category_hit} (${pct(stats.category_hit)}%)`);
    console.log(`low confidence<0.6 : ${stats.low_confidence} (${pct(stats.low_confidence)}%) [需人工复核]`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
