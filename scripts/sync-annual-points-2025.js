#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const SOURCE = {
  sourceKey: 'jinshuju-2025-sup-race-points',
  year: 2025,
  title: '桨板竞速2025年度积分',
  sourceUrl: 'https://jsj.top/f/J9j65S/s/CgPeBv',
  formToken: 'J9j65S',
  openSearchId: 'CgPeBv',
  parserName: 'sync-annual-points-2025',
};
const GROUPS = [
  { code: 'TcSz', label: '女子U9组' },
  { code: 'Hn6i', label: '男子U9组' },
  { code: 'd0Bv', label: '女子U12组' },
  { code: 'xjpA', label: '男子U12组' },
  { code: '7H7Q', label: '女子U15组' },
  { code: '2O7f', label: '男子U15组' },
  { code: 'IFbB', label: '女子U18组' },
  { code: 'bIMw', label: '男子U18组' },
  { code: 'y8OL', label: '女子高校组' },
  { code: 'vzFt', label: '男子高校组' },
  { code: 'JwSa', label: '女子卡胡纳组' },
  { code: 'RyFK', label: '男子卡胡纳组' },
  { code: 'XYw3', label: '女子大师组' },
  { code: '9HhG', label: '男子大师组' },
  { code: 't0iq', label: '女子公开组' },
  { code: 'amGW', label: '男子公开组' },
];

const QUERY = `query publishedOpenSearchEntries($formToken: ID!, $openSearchId: ID, $openResultId: ID, $forceProtected: Boolean, $first: Int, $after: String, $sortColumns: [SortColumnAttributes!], $queries: [JSON!], $scopeConditions: [ScopeConditionAttributes!]) {
  publishedOpenSearchEntries(formId: $formToken, openSearchId: $openSearchId, openResultId: $openResultId, first: $first, after: $after, sortColumns: $sortColumns, fieldFilter: $queries, scopeConditions: $scopeConditions) {
    nodes { id token fieldValues(openResultId: $openResultId, openSearchId: $openSearchId, forceProtected: $forceProtected) }
    pageInfo { endCursor hasNextPage }
    totalCount
  }
}`;

function usage() {
  console.log(`Usage:
  node scripts/sync-annual-points-2025.js [--dry-run] [--group amGW|all] [--limit 10] [--page-size 100]

Examples:
  node scripts/sync-annual-points-2025.js --dry-run --group amGW --limit 10
  node scripts/sync-annual-points-2025.js --group all
`);
}

function parseArgs(argv) {
  const args = { dryRun: false, group: 'all', limit: 0, pageSize: 100, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--dry-run') args.dryRun = true;
    else if (item === '--group') args.group = String(argv[++i] || 'all');
    else if (item === '--limit') args.limit = Math.max(0, Number(argv[++i] || 0));
    else if (item === '--page-size') args.pageSize = Math.min(100, Math.max(10, Number(argv[++i] || 100)));
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function normalizedName(name) {
  return String(name || '').replace(/\s+/g, '').toLowerCase();
}

function chunkArray(items, size = 500) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function numberOrNull(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-') return null;
  const next = Number(raw);
  return Number.isFinite(next) ? Number(next.toFixed(3)) : null;
}

function rankOrNull(value) {
  const next = numberOrNull(value);
  return next == null ? null : Math.trunc(next);
}

function normalize(node, group) {
  const values = node.fieldValues || {};
  return {
    sourceRecordId: String(node.id),
    sourceToken: node.token || null,
    groupCode: group.code,
    groupName: group.label,
    rankPosition: rankOrNull(values.field_2),
    athleteName: String(values.field_3 || '').trim(),
    totalPoints: numberOrNull(values.field_8),
    endurancePoints: numberOrNull(values.field_7),
    sprintPoints: numberOrNull(values.field_5),
    technicalPoints: numberOrNull(values.field_6),
    baseDetailText: String(values.field_9 || '').trim(),
    adjustmentDetailText: String(values.field_10 || '').trim(),
    rawJson: values,
  };
}

function segmentPoints(text) {
  const pick = (label) => {
    const match = String(text || '').match(new RegExp(`${label}：\\s*([\\d.]+)`));
    return match ? numberOrNull(match[1]) : null;
  };
  return { endurancePoints: pick('耐力赛'), sprintPoints: pick('冲刺赛'), technicalPoints: pick('技术赛') };
}

function breakdowns(row) {
  const out = [];
  for (const line of row.baseDetailText.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    const starMatch = line.match(/(✮+)/);
    out.push({
      detailType: 'base',
      eventName: starMatch ? line.slice(0, starMatch.index).trim() : line.split(/\s+耐力赛：/)[0]?.trim() || null,
      starLevel: starMatch ? starMatch[1].length : null,
      rawText: line,
      ...segmentPoints(line),
    });
  }
  for (const line of row.adjustmentDetailText.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    out.push({ detailType: 'adjustment', eventName: null, starLevel: null, rawText: line, ...segmentPoints(line) });
  }
  return out;
}

async function fetchPage(groupCode, first, after) {
  const res = await fetch('https://jsj.top/graphql', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', referer: SOURCE.sourceUrl },
    body: JSON.stringify({
      operationName: 'publishedOpenSearchEntries',
      variables: {
        formToken: SOURCE.formToken,
        openSearchId: SOURCE.openSearchId,
        openResultId: null,
        forceProtected: false,
        first,
        after: after || null,
        queries: [{ field_14: groupCode }],
      },
      query: QUERY,
    }),
  });
  if (!res.ok) throw new Error(`金数据接口请求失败：HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((item) => item.message).join('；'));
  const data = json.data && json.data.publishedOpenSearchEntries;
  if (!data) throw new Error('金数据接口返回结构异常');
  return {
    nodes: data.nodes || [],
    endCursor: data.pageInfo && data.pageInfo.endCursor,
    hasNextPage: Boolean(data.pageInfo && data.pageInfo.hasNextPage),
    totalCount: Number(data.totalCount || 0),
  };
}

async function fetchGroup(group, args) {
  const rows = [];
  let totalCount = 0;
  let after = null;
  do {
    const remaining = args.limit > 0 && args.group !== 'all' ? args.limit - rows.length : args.pageSize;
    if (args.limit > 0 && args.group !== 'all' && remaining <= 0) break;
    const page = await fetchPage(group.code, Math.min(args.pageSize, remaining || args.pageSize), after);
    totalCount = page.totalCount;
    rows.push(...page.nodes.map((node) => normalize(node, group)).filter((row) => row.athleteName));
    after = page.endCursor;
    if (!page.hasNextPage) break;
  } while (true);
  return { rows, totalCount };
}

async function ensureSource(conn) {
  await conn.execute(
    `INSERT INTO sup_annual_point_sources
      (source_key, year, title, source_url, form_token, open_search_id, parser_name, sync_status, raw_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'syncing', ?)
     ON DUPLICATE KEY UPDATE sync_status = 'syncing', error_message = NULL, raw_config = VALUES(raw_config), source_id = LAST_INSERT_ID(source_id)`,
    [SOURCE.sourceKey, SOURCE.year, SOURCE.title, SOURCE.sourceUrl, SOURCE.formToken, SOURCE.openSearchId, SOURCE.parserName, JSON.stringify({ groups: GROUPS })]
  );
  const [rows] = await conn.execute('SELECT LAST_INSERT_ID() AS source_id');
  return Number(rows[0].source_id);
}

async function matchAthlete(conn, row) {
  const key = normalizedName(row.athleteName);
  const [confirmed] = await conn.execute(
    `SELECT link_id, athlete_id, confidence FROM sup_athlete_identity_links
     WHERE normalized_name = ? AND status = 'confirmed' AND athlete_id IS NOT NULL
     ORDER BY confidence DESC, link_id ASC LIMIT 1`,
    [key]
  );
  if (confirmed.length) return { athleteId: Number(confirmed[0].athlete_id), identityLinkId: Number(confirmed[0].link_id), matchStatus: 'confirmed', confidence: Number(confirmed[0].confidence || 0.95) };

  const [athletes] = await conn.execute('SELECT athlete_id FROM sup_athletes WHERE name = ? ORDER BY athlete_id ASC LIMIT 5', [row.athleteName]);
  if (athletes.length === 1) {
    const athleteId = Number(athletes[0].athlete_id);
    await conn.execute(
      `INSERT IGNORE INTO sup_athlete_identity_links
        (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
       VALUES (?, ?, ?, ?, NULL, '中国', 0.850, 'pending', '2025年度积分同步生成的待确认候选')`,
      [athleteId, key, row.athleteName, row.groupName]
    );
    const [links] = await conn.execute(
      'SELECT link_id FROM sup_athlete_identity_links WHERE normalized_name = ? AND display_name = ? AND athlete_id = ? ORDER BY link_id DESC LIMIT 1',
      [key, row.athleteName, athleteId]
    );
    return { athleteId, identityLinkId: links.length ? Number(links[0].link_id) : null, matchStatus: 'candidate', confidence: 0.85 };
  }
  if (athletes.length > 1) return { athleteId: null, identityLinkId: null, matchStatus: 'conflict', confidence: 0.45 };
  return { athleteId: null, identityLinkId: null, matchStatus: 'unmatched', confidence: 0.3 };
}

async function createMatcher(conn, rows) {
  const names = Array.from(new Set(rows.map((row) => row.athleteName).filter(Boolean)));
  const normalizedKeys = Array.from(new Set(names.map((name) => normalizedName(name)).filter(Boolean)));
  const confirmedByKey = new Map();
  const athletesByName = new Map();
  const candidatesByKey = new Map();

  for (const chunk of chunkArray(normalizedKeys)) {
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const [confirmed] = await conn.execute(
      `SELECT link_id, athlete_id, normalized_name, confidence
       FROM sup_athlete_identity_links
       WHERE normalized_name IN (${placeholders}) AND status = 'confirmed' AND athlete_id IS NOT NULL
       ORDER BY confidence DESC, link_id ASC`,
      chunk
    );
    for (const item of confirmed) {
      const key = String(item.normalized_name || '');
      if (confirmedByKey.has(key)) continue;
      confirmedByKey.set(key, { athleteId: Number(item.athlete_id), identityLinkId: Number(item.link_id), matchStatus: 'confirmed', confidence: Number(item.confidence || 0.95) });
    }
  }

  for (const chunk of chunkArray(names)) {
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const [athletes] = await conn.execute(
      `SELECT athlete_id, name, status
       FROM sup_athletes
       WHERE name IN (${placeholders})
       ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, athlete_id ASC`,
      chunk
    );
    for (const athlete of athletes) {
      const name = String(athlete.name || '');
      const current = athletesByName.get(name) || [];
      current.push({ athleteId: Number(athlete.athlete_id), status: String(athlete.status || '') });
      athletesByName.set(name, current);
    }
  }

  return async (row) => {
    const key = normalizedName(row.athleteName);
    if (confirmedByKey.has(key)) return confirmedByKey.get(key);

    const athletes = athletesByName.get(row.athleteName) || [];
    if (athletes.length === 1) {
      const candidateKey = `${key}|${row.athleteName}|${row.groupName}`;
      if (candidatesByKey.has(candidateKey)) return candidatesByKey.get(candidateKey);

      const athleteId = Number(athletes[0].athleteId);
      await conn.execute(
        `INSERT IGNORE INTO sup_athlete_identity_links
          (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
         VALUES (?, ?, ?, ?, NULL, '中国', 0.850, 'pending', '2025年度积分同步生成的待确认候选')`,
        [athleteId, key, row.athleteName, row.groupName]
      );
      const [links] = await conn.execute(
        'SELECT link_id FROM sup_athlete_identity_links WHERE normalized_name = ? AND display_name = ? AND gender_hint = ? AND athlete_id = ? ORDER BY link_id DESC LIMIT 1',
        [key, row.athleteName, row.groupName, athleteId]
      );
      const result = { athleteId, identityLinkId: links.length ? Number(links[0].link_id) : null, matchStatus: 'candidate', confidence: 0.85 };
      candidatesByKey.set(candidateKey, result);
      return result;
    }

    if (athletes.length > 1) return { athleteId: null, identityLinkId: null, matchStatus: 'conflict', confidence: 0.45 };
    return { athleteId: null, identityLinkId: null, matchStatus: 'unmatched', confidence: 0.3 };
  };
}

async function upsert(conn, sourceId, row, match) {
  await conn.execute(
    `INSERT INTO sup_annual_point_standings
      (source_id, year, group_code, group_name, rank_position, athlete_id, athlete_name_snapshot,
       total_points, endurance_points, sprint_points, technical_points, base_detail_text, adjustment_detail_text,
       source_record_id, source_token, raw_json, identity_link_id, match_status, match_confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       group_code = VALUES(group_code), group_name = VALUES(group_name), rank_position = VALUES(rank_position),
       athlete_id = VALUES(athlete_id), athlete_name_snapshot = VALUES(athlete_name_snapshot),
       total_points = VALUES(total_points), endurance_points = VALUES(endurance_points), sprint_points = VALUES(sprint_points), technical_points = VALUES(technical_points),
       base_detail_text = VALUES(base_detail_text), adjustment_detail_text = VALUES(adjustment_detail_text),
       source_token = VALUES(source_token), raw_json = VALUES(raw_json), identity_link_id = VALUES(identity_link_id),
       match_status = VALUES(match_status), match_confidence = VALUES(match_confidence), standing_id = LAST_INSERT_ID(standing_id)`,
    [sourceId, SOURCE.year, row.groupCode, row.groupName, row.rankPosition, match.athleteId, row.athleteName, row.totalPoints, row.endurancePoints, row.sprintPoints, row.technicalPoints, row.baseDetailText || null, row.adjustmentDetailText || null, row.sourceRecordId, row.sourceToken, JSON.stringify(row.rawJson), match.identityLinkId, match.matchStatus, match.confidence]
  );
  const [ids] = await conn.execute('SELECT LAST_INSERT_ID() AS standing_id');
  const standingId = Number(ids[0].standing_id);
  await conn.execute('DELETE FROM sup_annual_point_breakdowns WHERE standing_id = ?', [standingId]);
  for (const item of breakdowns(row)) {
    await conn.execute(
      `INSERT INTO sup_annual_point_breakdowns
        (standing_id, detail_type, event_name, star_level, endurance_points, sprint_points, technical_points, raw_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [standingId, item.detailType, item.eventName, item.starLevel, item.endurancePoints, item.sprintPoints, item.technicalPoints, item.rawText]
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  const groups = args.group === 'all' ? GROUPS : GROUPS.filter((group) => group.code === args.group);
  if (!groups.length) throw new Error(`未知组别编码：${args.group}`);

  const fetched = [];
  for (const group of groups) {
    const data = await fetchGroup(group, args);
    fetched.push({ group, ...data });
    console.log(`${group.label}(${group.code}): fetched ${data.rows.length}, total ${data.totalCount}`);
  }

  if (args.dryRun) {
    console.log(JSON.stringify(fetched.flatMap((item) => item.rows).slice(0, 10), null, 2));
    return;
  }

  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });
  let sourceId = null;
  let imported = 0;
  try {
    sourceId = await ensureSource(conn);
    const matcher = await createMatcher(conn, fetched.flatMap((item) => item.rows));
    for (const groupData of fetched) {
      for (const row of groupData.rows) {
        await upsert(conn, sourceId, row, await matcher(row));
        imported += 1;
      }
    }
    const groupCounts = {};
    for (const item of fetched) groupCounts[item.group.code] = { label: item.group.label, fetched: item.rows.length, totalCount: item.totalCount };
    await conn.execute(
      `UPDATE sup_annual_point_sources
       SET sync_status = 'imported',
           total_records = (SELECT COUNT(*) FROM sup_annual_point_standings WHERE source_id = ?),
           imported_records = ?,
           group_counts = ?,
           error_message = NULL,
           last_synced_at = CURRENT_TIMESTAMP
       WHERE source_id = ?`,
      [sourceId, imported, JSON.stringify(groupCounts), sourceId]
    );
    console.log(`Imported ${imported} annual point rows.`);
  } catch (error) {
    if (sourceId) await conn.execute('UPDATE sup_annual_point_sources SET sync_status = ?, error_message = ?, last_synced_at = CURRENT_TIMESTAMP WHERE source_id = ?', ['failed', error.message, sourceId]);
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
