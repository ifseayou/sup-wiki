#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const SOURCE_TITLE = '体育总局水上中心关于公示中国桨板精英赛事运动员名单的通知';

function usage() {
  console.log(`Usage:
  node scripts/import-official-elite-athletes.js --file "/path/to/1.中国桨板精英赛事正式运动员名单.xlsx" [--dry-run] [--no-reset]
`);
}

function parseArgs(argv) {
  const args = { file: '', dryRun: false, reset: true, help: false };
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--file' || item === '--input') args.file = argv[++index] || '';
    else if (item === '--dry-run') args.dryRun = true;
    else if (item === '--no-reset') args.reset = false;
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

function normalizeName(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '').trim();
}

function cleanText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function dedupeRosterRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const name = cleanText(row.name);
    const group = cleanText(row.group);
    if (!name || !group || name === '姓名' || group === '组别') continue;
    const key = `${normalizeName(name)}|${group}`;
    const current = byKey.get(key);
    const next = {
      name,
      group,
      note: cleanText(row.note),
      sheet: cleanText(row.sheet),
    };
    if (!current) {
      byKey.set(key, next);
      continue;
    }
    if (!current.note && next.note) current.note = next.note;
    if (!current.sheet.includes(next.sheet)) current.sheet = [current.sheet, next.sheet].filter(Boolean).join('、');
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.group.localeCompare(b.group, 'zh-CN'));
}

function groupRosterByName(rows) {
  const byName = new Map();
  for (const row of rows) {
    const key = normalizeName(row.name);
    const item = byName.get(key) || { name: row.name, groups: new Set(), notes: new Set(), rows: [] };
    item.groups.add(row.group);
    if (row.note) item.notes.add(row.note);
    item.rows.push(row);
    byName.set(key, item);
  }
  return [...byName.values()].map((item) => ({
    name: item.name,
    normalizedName: normalizeName(item.name),
    groups: [...item.groups].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    notes: [...item.notes].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    rows: item.rows,
  }));
}

function parseWorkbook(file) {
  const python = `
import json
import sys
from openpyxl import load_workbook

file = sys.argv[1]
wb = load_workbook(file, read_only=True, data_only=True)
rows = []
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    header = None
    indexes = {}
    for values in ws.iter_rows(values_only=True):
        cells = ["" if value is None else str(value).strip() for value in values]
        if not any(cells):
            continue
        if header is None and ("姓名" in cells and "组别" in cells):
            header = cells
            indexes = {name: idx for idx, name in enumerate(header)}
            continue
        if header is None:
            continue
        name = cells[indexes["姓名"]] if indexes["姓名"] < len(cells) else ""
        group = cells[indexes["组别"]] if indexes["组别"] < len(cells) else ""
        note_index = indexes.get("备注", -1)
        note = cells[note_index] if note_index >= 0 and note_index < len(cells) else ""
        if name and group:
            rows.append({"sheet": sheet_name, "name": name, "group": group, "note": note})
print(json.dumps(rows, ensure_ascii=False))
`;
  const result = spawnSync('python3', ['-c', python, file], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Excel 解析失败');
  }
  return dedupeRosterRows(JSON.parse(result.stdout || '[]'));
}

function chunkArray(items, size = 300) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function createMatcher(conn, entries) {
  const names = [...new Set(entries.map((item) => item.name))];
  const keys = [...new Set(entries.map((item) => item.normalizedName))];
  const exactByName = new Map();
  const confirmedByKey = new Map();

  for (const chunk of chunkArray(names)) {
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const [rows] = await conn.execute(
      `SELECT athlete_id, name FROM sup_athletes WHERE name IN (${placeholders}) ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, athlete_id ASC`,
      chunk
    );
    for (const row of rows) {
      const list = exactByName.get(row.name) || [];
      list.push(Number(row.athlete_id));
      exactByName.set(row.name, list);
    }
  }

  for (const chunk of chunkArray(keys)) {
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const [rows] = await conn.execute(
      `SELECT normalized_name, athlete_id
         FROM sup_athlete_identity_links
        WHERE normalized_name IN (${placeholders})
          AND status = 'confirmed'
          AND athlete_id IS NOT NULL
        ORDER BY confidence DESC, link_id ASC`,
      chunk
    );
    for (const row of rows) {
      const key = String(row.normalized_name || '');
      const list = confirmedByKey.get(key) || [];
      list.push(Number(row.athlete_id));
      confirmedByKey.set(key, list);
    }
  }

  return (entry) => {
    const exact = exactByName.get(entry.name) || [];
    if (exact.length === 1) return { status: 'matched', athleteId: exact[0], method: 'exact' };
    if (exact.length > 1) return { status: 'conflict', athleteIds: exact, method: 'exact' };
    const confirmed = [...new Set(confirmedByKey.get(entry.normalizedName) || [])];
    if (confirmed.length === 1) return { status: 'matched', athleteId: confirmed[0], method: 'identity' };
    if (confirmed.length > 1) return { status: 'conflict', athleteIds: confirmed, method: 'identity' };
    return { status: 'unmatched', athleteIds: [], method: 'none' };
  };
}

async function applyImport(conn, matched, reset) {
  await conn.beginTransaction();
  try {
    if (reset) {
      await conn.execute(
        `UPDATE sup_athletes
            SET elite_event_status = 'none',
                elite_event_groups = NULL,
                elite_event_note = NULL,
                elite_event_source_title = NULL,
                elite_event_updated_at = NULL
          WHERE elite_event_status = 'formal'`
      );
    }
    for (const item of matched) {
      await conn.execute(
        `UPDATE sup_athletes
            SET elite_event_status = 'formal',
                elite_event_groups = ?,
                elite_event_note = ?,
                elite_event_source_title = ?,
                elite_event_updated_at = NOW()
          WHERE athlete_id = ?`,
        [
          JSON.stringify(item.groups),
          item.notes.join('；').slice(0, 255) || null,
          SOURCE_TITLE,
          item.athleteId,
        ]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

function printSummary({ rows, entries, matched, unmatched, conflicts, dryRun }) {
  console.log(`Excel 去重后名单：${rows.length} 条姓名+组别，${entries.length} 名运动员`);
  console.log(`匹配成功：${matched.length}`);
  console.log(`未匹配：${unmatched.length}`);
  console.log(`同名冲突：${conflicts.length}`);
  console.log(`模式：${dryRun ? 'dry-run，仅预览' : '已写入数据库'}`);
  if (unmatched.length) {
    console.log('\n未匹配前 30 名：');
    for (const item of unmatched.slice(0, 30)) console.log(`- ${item.name}｜${item.groups.join('、')}`);
  }
  if (conflicts.length) {
    console.log('\n同名冲突：');
    for (const item of conflicts.slice(0, 30)) console.log(`- ${item.name} -> athlete_id ${item.athleteIds.join(', ')}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.file) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const file = path.resolve(args.file);
  if (!fs.existsSync(file)) throw new Error(`文件不存在：${file}`);

  const rows = parseWorkbook(file);
  const entries = groupRosterByName(rows);
  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });

  try {
    const match = await createMatcher(conn, entries);
    const matched = [];
    const unmatched = [];
    const conflicts = [];
    for (const entry of entries) {
      const result = match(entry);
      if (result.status === 'matched') matched.push({ ...entry, athleteId: result.athleteId, matchMethod: result.method });
      else if (result.status === 'conflict') conflicts.push({ ...entry, athleteIds: result.athleteIds, matchMethod: result.method });
      else unmatched.push(entry);
    }
    if (!args.dryRun) {
      await applyImport(conn, matched, args.reset);
    }
    printSummary({ rows, entries, matched, unmatched, conflicts, dryRun: args.dryRun });
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`导入官方精英名单失败：${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  SOURCE_TITLE,
  normalizeName,
  cleanText,
  dedupeRosterRows,
  groupRosterByName,
};
