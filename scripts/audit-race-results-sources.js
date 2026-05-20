#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function usage() {
  console.log(`Usage:
  node scripts/audit-race-results-sources.js --input payload.json [--input more.json] [--output audit.json]

Compares parsed local result payloads against imported database rows by event/source.`);
}

function parseArgs(argv) {
  const args = { inputs: [], output: '' };
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--input') args.inputs.push(argv[++index] || '');
    else if (item === '--output') args.output = argv[++index] || '';
    else if (item === '--help' || item === '-h') args.help = true;
  }
  return args;
}

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function readPayloads(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  if (filePath.endsWith('.jsonl')) return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function groupCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = [
      row.discipline || '',
      row.gender_group || '',
      row.round_label || '',
      row.file_name || '',
    ].join('|');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort().map(([key, count]) => {
    const [discipline, gender_group, round_label, file_name] = key.split('|');
    return { discipline, gender_group, round_label: round_label || null, file_name, count };
  });
}

function buildExpected(payloads) {
  return payloads.map((payload) => ({
    event_name: payload.event?.name || '',
    start_date: payload.event?.start_date || null,
    file_name: payload.source?.file_name || '',
    original_path: payload.source?.original_path || '',
    parser_status: payload.source?.parser_status || null,
    parser_note: payload.source?.parser_note || null,
    expected_rows: Array.isArray(payload.results) ? payload.results.length : 0,
    expected_groups: groupCounts((payload.results || []).map((row) => ({ ...row, file_name: payload.source?.file_name || '' }))),
  }));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.inputs.length) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const payloads = args.inputs.flatMap((input) => readPayloads(input));
  const expected = buildExpected(payloads);

  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });

  try {
    const findings = [];
    const manualReview = [];
    const autoVerified = [];
    for (const item of expected) {
      if (!item.event_name || !item.file_name) continue;
      if (item.parser_status && item.parser_status !== 'parsed') {
        manualReview.push({ ...item, reason: `parser_status=${item.parser_status}`, expected_groups: undefined });
        continue;
      }
      if (!item.expected_rows) {
        manualReview.push({ ...item, reason: 'parsed payload has no result rows', expected_groups: undefined });
        continue;
      }

      const [rows] = await connection.execute(
        `SELECT e.event_id, e.name, e.start_date, src.file_name,
                er.discipline, er.gender_group, er.round_label, COUNT(DISTINCT er.result_id) AS count,
                SUM(er.team_name <> '个人') AS team_rows,
                SUM(erm.member_id IS NOT NULL) AS member_links
         FROM sup_events e
         LEFT JOIN sup_event_result_sources src ON src.event_id = e.event_id
         LEFT JOIN sup_event_results er ON er.source_id = src.source_id
         LEFT JOIN sup_event_result_members erm ON erm.result_id = er.result_id
         WHERE e.name = ? AND src.file_name = ?
         GROUP BY e.event_id, e.name, e.start_date, src.file_name, er.discipline, er.gender_group, er.round_label
         ORDER BY er.discipline, er.gender_group, er.round_label`,
        [item.event_name, item.file_name]
      );
      const actualRows = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
      const actualGroups = rows.map((row) => ({
        discipline: row.discipline || '',
        gender_group: row.gender_group || '',
        round_label: row.round_label || null,
        file_name: row.file_name || '',
        count: Number(row.count || 0),
      }));
      const expectedKey = JSON.stringify(item.expected_groups);
      const actualKey = JSON.stringify(actualGroups);
      if (actualRows === item.expected_rows && expectedKey === actualKey) {
        autoVerified.push({ event_name: item.event_name, file_name: item.file_name, rows: actualRows });
      } else {
        findings.push({
          event_name: item.event_name,
          file_name: item.file_name,
          original_path: item.original_path,
          expected_rows: item.expected_rows,
          actual_rows: actualRows,
          expected_groups: item.expected_groups,
          actual_groups: actualGroups,
          reason: actualRows === 0 ? 'not imported or source mismatch' : 'row/group count mismatch',
        });
      }
    }

    const [suspectRows] = await connection.execute(
      `SELECT e.event_id, e.name, src.file_name, er.discipline, er.gender_group, er.round_label, COUNT(*) AS count
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       LEFT JOIN sup_event_result_sources src ON src.source_id = er.source_id
       WHERE er.discipline REGEXP '^[0-9]+[[:space:]][A-Z][0-9]+'
          OR er.gender_group REGEXP '^[0-9]+[[:space:]][A-Z][0-9]+'
          OR er.round_label REGEXP '^[0-9]+[[:space:]][A-Z][0-9]+'
          OR er.finish_time REGEXP '[一-龥]{2,}'
       GROUP BY e.event_id, e.name, src.file_name, er.discipline, er.gender_group, er.round_label
       ORDER BY count DESC
       LIMIT 100`
    );

    const report = {
      generated_at: new Date().toISOString(),
      inputs: args.inputs,
      summary: {
        payload_sources: expected.length,
        auto_verified: autoVerified.length,
        needs_fix: findings.length,
        manual_review: manualReview.length,
        suspect_db_groups: suspectRows.length,
      },
      auto_verified: autoVerified,
      needs_fix: findings,
      manual_review: manualReview,
      suspect_db_groups: suspectRows,
    };
    const output = JSON.stringify(report, null, 2);
    if (args.output) fs.writeFileSync(args.output, output);
    console.log(output);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
