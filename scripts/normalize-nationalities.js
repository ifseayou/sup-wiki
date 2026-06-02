#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const mysql = require('mysql2/promise');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  const env = { ...process.env };
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

function loadNationalityModule() {
  const filename = path.join(repoRoot, 'src/lib/nationality.ts');
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

function parseArgs(argv) {
  return {
    commit: argv.includes('--commit'),
    includeUnknown: argv.includes('--include-unknown'),
  };
}

async function createConnection(env) {
  return mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || '3306'),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
    charset: 'utf8mb4',
    multipleStatements: false,
  });
}

async function collectValues(connection, columnSql) {
  const [rows] = await connection.execute(`
    SELECT raw_value, SUM(count_value) AS count_value
    FROM (${columnSql}) source_values
    WHERE NULLIF(TRIM(raw_value), '') IS NOT NULL
      AND TRIM(raw_value) NOT IN ('-', 'null')
    GROUP BY raw_value
    ORDER BY count_value DESC, raw_value ASC
  `);
  return rows;
}

function buildPlan(rows, explainNationalityNormalization, includeUnknown) {
  return rows.map((row) => {
    const explained = explainNationalityNormalization(row.raw_value);
    return {
      original: String(row.raw_value),
      normalized: explained.normalized,
      count: Number(row.count_value || 0),
      known: explained.known,
      changed: explained.changed,
      writable: explained.changed && (explained.known || includeUnknown),
    };
  });
}

function printPlan(title, plan) {
  const changed = plan.filter((item) => item.changed);
  const writable = plan.filter((item) => item.writable);
  const unknown = plan.filter((item) => !item.known && item.original && item.normalized);
  console.log(`\n${title}`);
  console.log(`原始值 ${plan.length} 个，需归一化 ${changed.length} 个，本次可写入 ${writable.length} 个`);
  if (changed.length) {
    console.table(changed.slice(0, 80).map((item) => ({
      原值: item.original,
      新值: item.normalized,
      数量: item.count,
      已知映射: item.known ? '是' : '否',
      写入: item.writable ? '是' : '否',
    })));
  }
  if (unknown.length) {
    console.log('未识别为标准国籍的值会保留原样：');
    console.table(unknown.slice(0, 80).map((item) => ({ 原值: item.original, 数量: item.count })));
  }
}

async function applyAthletePlan(connection, plan) {
  for (const item of plan.filter((entry) => entry.writable)) {
    await connection.execute(
      `UPDATE sup_athletes SET nationality = ? WHERE TRIM(nationality) = ?`,
      [item.normalized, item.original]
    );
  }
}

async function applyResultPlan(connection, plan) {
  for (const item of plan.filter((entry) => entry.writable)) {
    await connection.execute(
      `UPDATE sup_event_results SET nationality_snapshot = ? WHERE TRIM(nationality_snapshot) = ?`,
      [item.normalized, item.original]
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv();
  const { explainNationalityNormalization } = loadNationalityModule();
  const connection = await createConnection(env);
  try {
    const athleteRows = await collectValues(connection, `
      SELECT TRIM(nationality) AS raw_value, COUNT(*) AS count_value
      FROM sup_athletes
      GROUP BY TRIM(nationality)
    `);
    const resultRows = await collectValues(connection, `
      SELECT TRIM(nationality_snapshot) AS raw_value, COUNT(*) AS count_value
      FROM sup_event_results
      GROUP BY TRIM(nationality_snapshot)
    `);

    const athletePlan = buildPlan(athleteRows, explainNationalityNormalization, args.includeUnknown);
    const resultPlan = buildPlan(resultRows, explainNationalityNormalization, args.includeUnknown);

    console.log(`国籍归一化 ${args.commit ? 'commit' : 'dry-run'}${args.includeUnknown ? '（含未知值写回）' : ''}`);
    printPlan('sup_athletes.nationality', athletePlan);
    printPlan('sup_event_results.nationality_snapshot', resultPlan);

    if (!args.commit) {
      console.log('\n未写入数据库。确认无误后运行：node scripts/normalize-nationalities.js --commit');
      return;
    }

    await connection.beginTransaction();
    await applyAthletePlan(connection, athletePlan);
    await applyResultPlan(connection, resultPlan);
    await connection.commit();
    console.log('\n已完成国籍归一化写入。');
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors outside a transaction.
    }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
