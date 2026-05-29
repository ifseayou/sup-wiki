#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function usage() {
  console.log(`Usage:
  node scripts/fix-annual-point-ranks.js --source-key wechat-annual-points-xxx [--dry-run]
  node scripts/fix-annual-point-ranks.js --year 2024 [--dry-run]
`);
}

function parseArgs(argv) {
  const args = { sourceKey: '', year: 0, dryRun: false, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--source-key') args.sourceKey = argv[++i] || '';
    else if (item === '--year') args.year = Number(argv[++i] || 0);
    else if (item === '--dry-run') args.dryRun = true;
    else if (item === '--help' || item === '-h') args.help = true;
  }
  return args;
}

function loadEnv() {
  const env = { ...process.env };
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function rawJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function rawRank(value) {
  const raw = rawJson(value);
  return String(raw?.ocr_row?.rank || '');
}

function parseRank(value) {
  const numbers = rawRank(value).replace(/[Oo]/g, '0').replace(/l/g, '1').match(/\d+/g);
  if (!numbers?.length) return null;
  return Number(numbers[numbers.length - 1]);
}

function imageIndex(value) {
  const raw = rawJson(value);
  return Number(raw.image_index || 0);
}

function rowIndex(value) {
  const raw = rawJson(value);
  return Number(raw.row_index || 0);
}

function samePoints(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return Math.abs(Number(a) - Number(b)) < 0.001;
}

function inferRanks(rows) {
  const ordered = [...rows].sort((a, b) => (
    imageIndex(a.raw_json) - imageIndex(b.raw_json)
    || rowIndex(a.raw_json) - rowIndex(b.raw_json)
    || Number(a.standing_id) - Number(b.standing_id)
  ));
  let ordinal = 0;
  let prevRank = 0;
  let prevPoints = null;
  let tieGroupSize = 0;
  return ordered.map((row) => {
    ordinal += 1;
    const candidate = parseRank(row.raw_json);
    const plausible = candidate !== null
      && candidate >= prevRank
      && candidate >= 1
      && candidate <= ordinal + 20;
    const inferred = plausible
      ? candidate
      : (
        samePoints(row.total_points, prevPoints) && prevRank
          ? prevRank
          : (prevRank ? prevRank + Math.max(1, tieGroupSize) : ordinal)
      );
    tieGroupSize = samePoints(row.total_points, prevPoints) && inferred === prevRank ? tieGroupSize + 1 : 1;
    prevRank = inferred;
    prevPoints = row.total_points;
    return { row, nextRank: inferred, candidate, rawRank: rawRank(row.raw_json) };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.sourceKey && !args.year)) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });

  const sourceWhere = args.sourceKey ? 'source_key = ?' : 'year = ?';
  const [sources] = await conn.execute(
    `SELECT source_id, source_key, title FROM sup_annual_point_sources WHERE ${sourceWhere} ORDER BY source_id`,
    [args.sourceKey || args.year]
  );
  const summary = [];
  try {
    await conn.beginTransaction();
    for (const source of sources) {
      const [rows] = await conn.execute(
        `SELECT standing_id, rank_position, total_points, raw_json
         FROM sup_annual_point_standings
         WHERE source_id = ?
         ORDER BY standing_id`,
        [source.source_id]
      );
      const changes = inferRanks(rows).filter((item) => Number(item.row.rank_position || 0) !== item.nextRank);
      summary.push({
        source_key: source.source_key,
        title: source.title,
        rows: rows.length,
        changes: changes.length,
        sample: changes.slice(0, 8).map((item) => ({
          standing_id: item.row.standing_id,
          old_rank: item.row.rank_position,
          new_rank: item.nextRank,
          raw_rank: item.rawRank,
        })),
      });
      if (!args.dryRun) {
        for (const item of changes) {
          await conn.execute('UPDATE sup_annual_point_standings SET rank_position = ? WHERE standing_id = ?', [
            item.nextRank,
            item.row.standing_id,
          ]);
        }
      }
    }
    if (args.dryRun) await conn.rollback();
    else await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
  console.log(JSON.stringify({ dryRun: args.dryRun, sources: sources.length, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
