#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const mysql = require('mysql2/promise');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    json: false,
    unmatchedOnly: false,
    minCount: 1,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--json') args.json = true;
    else if (item === '--unmatched-only') args.unmatchedOnly = true;
    else if (item === '--min-count') args.minCount = Math.max(1, Number(argv[++i] || 1));
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

async function fetchRows(connection) {
  const [disciplineRows] = await connection.execute(
    `SELECT discipline, board_class, round_label, COUNT(*) AS cnt,
            COUNT(DISTINCT event_id) AS event_count,
            COUNT(DISTINCT athlete_name_snapshot) AS athlete_name_count
     FROM sup_event_results
     GROUP BY discipline, board_class, round_label
     ORDER BY cnt DESC`
  );
  const [groupRows] = await connection.execute(
    `SELECT gender_group, board_class, team_name, COUNT(*) AS cnt,
            COUNT(DISTINCT event_id) AS event_count,
            COUNT(DISTINCT discipline) AS discipline_count,
            COUNT(DISTINCT athlete_name_snapshot) AS athlete_name_count
     FROM sup_event_results
     GROUP BY gender_group, board_class, team_name
     ORDER BY cnt DESC`
  );
  return { disciplineRows, groupRows };
}

function summarizeDiscipline(rows, normalizeResultDiscipline, minCount) {
  const summary = new Map();
  for (const row of rows) {
    const normalized = normalizeResultDiscipline(row.discipline, row.board_class, row.round_label);
    const key = `${row.discipline || ''}\u0000${row.board_class || ''}\u0000${row.round_label || ''}`;
    if (!summary.has(key)) {
      summary.set(key, {
        original: row.discipline || '',
        board_class: row.board_class || null,
        round_label: row.round_label || null,
        cnt: 0,
        event_count: 0,
        athlete_name_count: 0,
        normalized,
      });
    }
    const item = summary.get(key);
    item.cnt += Number(row.cnt || 0);
    item.event_count += Number(row.event_count || 0);
    item.athlete_name_count += Number(row.athlete_name_count || 0);
  }
  return [...summary.values()].filter((item) => item.cnt >= minCount).sort((a, b) => b.cnt - a.cnt);
}

function summarizeGroup(rows, normalizeResultGroup, minCount) {
  const summary = new Map();
  for (const row of rows) {
    const normalized = normalizeResultGroup(row.gender_group, row.board_class, row.team_name);
    const key = `${row.gender_group || ''}\u0000${row.board_class || ''}\u0000${row.team_name || ''}`;
    if (!summary.has(key)) {
      summary.set(key, {
        original: row.gender_group || '',
        board_class: row.board_class || null,
        team_name: row.team_name || null,
        cnt: 0,
        event_count: 0,
        discipline_count: 0,
        athlete_name_count: 0,
        normalized,
      });
    }
    const item = summary.get(key);
    item.cnt += Number(row.cnt || 0);
    item.event_count += Number(row.event_count || 0);
    item.discipline_count += Number(row.discipline_count || 0);
    item.athlete_name_count += Number(row.athlete_name_count || 0);
  }
  return [...summary.values()].filter((item) => item.cnt >= minCount).sort((a, b) => b.cnt - a.cnt);
}

function coverage(items, isMatched) {
  const totalRows = items.reduce((sum, item) => sum + item.cnt, 0);
  const matchedRows = items.filter(isMatched).reduce((sum, item) => sum + item.cnt, 0);
  return {
    total_rows: totalRows,
    matched_rows: matchedRows,
    unmatched_rows: totalRows - matchedRows,
    coverage: totalRows ? Number((matchedRows / totalRows).toFixed(4)) : 0,
  };
}

function printTable(title, items, formatter, limit = 80) {
  console.log(`\n${title}`);
  for (const item of items.slice(0, limit)) {
    console.log(formatter(item));
  }
  if (items.length > limit) console.log(`... ${items.length - limit} more`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/audit-result-normalization.js [--json] [--unmatched-only] [--min-count N]');
    return;
  }
  const { normalizeResultDiscipline, normalizeResultGroup } = loadNormalizationModule();
  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });
  try {
    const { disciplineRows, groupRows } = await fetchRows(connection);
    const disciplines = summarizeDiscipline(disciplineRows, normalizeResultDiscipline, args.minCount);
    const groups = summarizeGroup(groupRows, normalizeResultGroup, args.minCount);
    const disciplineMatched = (item) => item.normalized.normalized_key !== 'unknown' && item.normalized.confidence >= 0.65;
    const groupMatched = (item) => item.normalized.confidence >= 0.65
      && (item.normalized.gender !== 'open_unknown' || item.normalized.age_band !== 'unknown' || item.normalized.team_type !== 'individual');
    const report = {
      generated_at: new Date().toISOString(),
      min_count: args.minCount,
      discipline_coverage: coverage(disciplines, disciplineMatched),
      group_coverage: coverage(groups, groupMatched),
      disciplines: args.unmatchedOnly ? disciplines.filter((item) => !disciplineMatched(item)) : disciplines,
      groups: args.unmatchedOnly ? groups.filter((item) => !groupMatched(item)) : groups,
    };

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`Discipline coverage: ${(report.discipline_coverage.coverage * 100).toFixed(2)}% (${report.discipline_coverage.matched_rows}/${report.discipline_coverage.total_rows})`);
    console.log(`Group coverage: ${(report.group_coverage.coverage * 100).toFixed(2)}% (${report.group_coverage.matched_rows}/${report.group_coverage.total_rows})`);

    printTable(
      args.unmatchedOnly ? 'Unmatched disciplines' : 'Disciplines',
      report.disciplines,
      (item) => `${item.cnt}\t${item.original}\t${item.board_class || '-'}\t${item.round_label || '-'}\t=> ${item.normalized.normalized_key}\t${item.normalized.confidence}\t${item.normalized.reason}`,
    );
    printTable(
      args.unmatchedOnly ? 'Unmatched groups' : 'Groups',
      report.groups,
      (item) => `${item.cnt}\t${item.original}\t${item.board_class || '-'}\t${item.team_name || '-'}\t=> ${item.normalized.normalized_group_key}\t${item.normalized.confidence}\t${item.normalized.reason}`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
