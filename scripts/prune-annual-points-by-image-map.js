#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function usage() {
  console.log(`Usage:
  node scripts/prune-annual-points-by-image-map.js --map .cache/annual-points-2022-total-image-map.json [--dry-run]
`);
}

function parseArgs(argv) {
  const args = { map: '', dryRun: false, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--map') args.map = argv[++i] || '';
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

function chunkArray(items, size = 500) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function imageIndex(row) {
  if (row.image_index !== null && row.image_index !== undefined) return Number(row.image_index);
  try {
    return Number(JSON.parse(String(row.raw_json || '{}')).image_index || 0);
  } catch {
    return 0;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.map) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const imageMap = JSON.parse(fs.readFileSync(args.map, 'utf8'));
  const entries = Object.entries(imageMap).filter(([, config]) => Array.isArray(config.keep_image_indexes) && config.keep_image_indexes.length > 0);

  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });

  const summary = [];
  try {
    await conn.beginTransaction();
    for (const [sourceKey, config] of entries) {
      const keep = new Set(config.keep_image_indexes.map((item) => Number(item)));
      const [sources] = await conn.execute(
        'SELECT source_id, title FROM sup_annual_point_sources WHERE source_key = ? LIMIT 1',
        [sourceKey]
      );
      if (!sources.length) {
        summary.push({ source_key: sourceKey, skipped: 'missing_source' });
        continue;
      }
      const sourceId = Number(sources[0].source_id);
      const [rows] = await conn.execute(
        `SELECT
           standing_id,
           JSON_UNQUOTE(JSON_EXTRACT(raw_json, '$.image_index')) AS image_index,
           raw_json
         FROM sup_annual_point_standings
         WHERE source_id = ?`,
        [sourceId]
      );
      const deleteIds = rows
        .filter((row) => !keep.has(imageIndex(row)))
        .map((row) => Number(row.standing_id));
      const keepCount = rows.length - deleteIds.length;
      summary.push({
        source_key: sourceKey,
        title: sources[0].title,
        keep_images: Array.from(keep).sort((a, b) => a - b),
        before: rows.length,
        keep: keepCount,
        delete: deleteIds.length,
      });
      if (!args.dryRun && deleteIds.length) {
        for (const chunk of chunkArray(deleteIds)) {
          const placeholders = chunk.map(() => '?').join(',');
          await conn.execute(`DELETE FROM sup_annual_point_breakdowns WHERE standing_id IN (${placeholders})`, chunk);
          await conn.execute(`DELETE FROM sup_annual_point_standings WHERE standing_id IN (${placeholders})`, chunk);
        }
      }
      if (!args.dryRun) {
        await conn.execute(
          `UPDATE sup_annual_point_sources
           SET total_records = ?, imported_records = ?, last_synced_at = CURRENT_TIMESTAMP
           WHERE source_id = ?`,
          [keepCount, keepCount, sourceId]
        );
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

  console.log(JSON.stringify({ dryRun: args.dryRun, sources: summary.length, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
