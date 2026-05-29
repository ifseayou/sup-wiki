#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function usage() {
  console.log(`Usage:
  node scripts/import-annual-points-archive.js --input .cache/annual-points-2022-2024/standings.json [--dry-run]
`);
}

function parseArgs(argv) {
  const args = { input: '', dryRun: false, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--input') args.input = argv[++i] || '';
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

function normalizedName(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function normalizedTeam(value) {
  return String(value || '').replace(/\s+/g, '').replace(/[（）()·・,，。:：;；\-—–_【】[\]「」“”"《》]/g, '').toLowerCase();
}

function cleanClubName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（［【]/g, '(')
    .replace(/[）］】]/g, ')')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function slugifyClubName(name, fallback) {
  const ascii = String(name || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 120);
  if (ascii) return ascii;
  const suffix = fallback || Buffer.from(String(name || 'club')).toString('hex').slice(0, 12);
  return `club-${suffix}`;
}

async function uniqueClubSlug(conn, name) {
  const base = slugifyClubName(name);
  for (let index = 0; index < 1000; index += 1) {
    const slug = index ? `${base}-${index + 1}` : base;
    const [rows] = await conn.execute('SELECT club_id FROM sup_clubs WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) return slug;
  }
  return slugifyClubName(name, Date.now());
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? Number(next.toFixed(3)) : null;
}

function chunkArray(items, size = 500) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function placeholders(rows, columns) {
  return rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
}

async function createAthleteMatcher(conn, rows) {
  const names = Array.from(new Set(rows.map((row) => row.athlete_name_snapshot).filter(Boolean)));
  const keys = Array.from(new Set(names.map(normalizedName).filter(Boolean)));
  const confirmedByKey = new Map();
  const athletesByName = new Map();

  for (const chunk of chunkArray(keys)) {
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const [links] = await conn.execute(
      `SELECT link_id, athlete_id, normalized_name, confidence
       FROM sup_athlete_identity_links
       WHERE normalized_name IN (${placeholders}) AND status = 'confirmed' AND athlete_id IS NOT NULL
       ORDER BY confidence DESC, link_id ASC`,
      chunk
    );
    for (const link of links) {
      const key = String(link.normalized_name || '');
      if (!confirmedByKey.has(key)) {
        confirmedByKey.set(key, {
          athleteId: Number(link.athlete_id),
          identityLinkId: Number(link.link_id),
          matchStatus: 'confirmed',
          confidence: Number(link.confidence || 0.95),
        });
      }
    }
  }

  for (const chunk of chunkArray(names)) {
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const [athletes] = await conn.execute(
      `SELECT athlete_id, name FROM sup_athletes WHERE name IN (${placeholders}) ORDER BY athlete_id ASC`,
      chunk
    );
    for (const athlete of athletes) {
      const key = String(athlete.name || '');
      const list = athletesByName.get(key) || [];
      list.push(Number(athlete.athlete_id));
      athletesByName.set(key, list);
    }
  }

  const candidateByKey = new Map();
  return async (row) => {
    const key = normalizedName(row.athlete_name_snapshot);
    if (confirmedByKey.has(key)) return confirmedByKey.get(key);
    const athletes = athletesByName.get(row.athlete_name_snapshot) || [];
    if (athletes.length === 1) {
      const candidateKey = `${key}|${row.group_name || ''}`;
      if (candidateByKey.has(candidateKey)) return candidateByKey.get(candidateKey);
      const athleteId = athletes[0];
      const result = { athleteId, identityLinkId: null, matchStatus: 'candidate', confidence: 0.85 };
      candidateByKey.set(candidateKey, result);
      return result;
    }
    if (athletes.length > 1) return { athleteId: null, identityLinkId: null, matchStatus: 'conflict', confidence: 0.45 };
    return { athleteId: null, identityLinkId: null, matchStatus: 'unmatched', confidence: 0.3 };
  };
}

async function createClubMatcher(conn, rows) {
  const names = Array.from(new Set(rows.map((row) => cleanClubName(row.club_name_snapshot)).filter(Boolean)));
  const keys = Array.from(new Set(names.map((name) => normalizedTeam(name)).filter(Boolean)));
  const matchesByNormalized = new Map();
  const sourceStats = new Map();

  for (const row of rows) {
    const rawName = cleanClubName(row.club_name_snapshot);
    const key = normalizedTeam(rawName);
    if (!key) continue;
    const stats = sourceStats.get(key) || { name: rawName, standings: 0, years: new Set() };
    stats.standings += 1;
    stats.years.add(Number(row.year));
    sourceStats.set(key, stats);
  }

  for (const chunk of chunkArray(keys)) {
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const [aliasRows] = await conn.execute(
      `SELECT normalized_name, club_id, confidence
       FROM sup_club_team_aliases
       WHERE normalized_name IN (${placeholders}) AND match_status = 'confirmed' AND club_id IS NOT NULL
       ORDER BY confidence DESC, alias_id ASC`,
      chunk
    );
    for (const alias of aliasRows) {
      const key = String(alias.normalized_name || '');
      if (!matchesByNormalized.has(key)) {
        matchesByNormalized.set(key, {
          clubId: Number(alias.club_id),
          matchStatus: 'confirmed',
          confidence: Number(alias.confidence || 0.95),
        });
      }
    }
  }

  for (const chunk of keys) {
    const [clubs] = await conn.execute(
      `SELECT club_id, name
       FROM sup_clubs
       WHERE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, ' ', ''), '　', ''), '（', '('), '）', ')'), '·', ''), '•', '')) = ?
       ORDER BY status = 'published' DESC, club_id ASC
       LIMIT 2`,
      [chunk]
    );
    if (clubs.length === 1 && !matchesByNormalized.has(chunk)) {
      matchesByNormalized.set(chunk, {
        clubId: Number(clubs[0].club_id),
        matchStatus: 'confirmed',
        confidence: 1,
      });
    } else if (clubs.length > 1 && !matchesByNormalized.has(chunk)) {
      matchesByNormalized.set(chunk, {
        clubId: null,
        matchStatus: 'conflict',
        confidence: 0.45,
      });
    }
  }

  for (const [key, stats] of sourceStats.entries()) {
    const existing = matchesByNormalized.get(key);
    if (!existing) {
      const slug = await uniqueClubSlug(conn, stats.name);
      const [result] = await conn.execute(
        `INSERT INTO sup_clubs
          (slug, name, claim_status, verification_status, source_type, source_note, status)
         VALUES (?, ?, 'unclaimed', 'unverified', 'annual_point_club', '年度俱乐部积分自动生成，待俱乐部认领完善资料', 'draft')`,
        [slug, stats.name]
      );
      matchesByNormalized.set(key, {
        clubId: Number(result.insertId),
        matchStatus: 'confirmed',
        confidence: 0.95,
      });
    }
    const match = matchesByNormalized.get(key);
    await conn.execute(
      `INSERT INTO sup_club_team_aliases
        (team_name_raw, normalized_name, club_id, match_status, confidence, result_count, event_count, athlete_count, source_type, admin_note, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'annual_point_club', '年度俱乐部积分导入自动确认', NOW())
       ON DUPLICATE KEY UPDATE
         team_name_raw = VALUES(team_name_raw),
         club_id = CASE
           WHEN sup_club_team_aliases.match_status IN ('ignored', 'rejected') THEN sup_club_team_aliases.club_id
           ELSE VALUES(club_id)
         END,
         match_status = CASE
           WHEN sup_club_team_aliases.match_status IN ('ignored', 'rejected') THEN sup_club_team_aliases.match_status
           ELSE VALUES(match_status)
         END,
         confidence = GREATEST(sup_club_team_aliases.confidence, VALUES(confidence)),
         result_count = GREATEST(sup_club_team_aliases.result_count, VALUES(result_count)),
         event_count = GREATEST(sup_club_team_aliases.event_count, VALUES(event_count)),
         source_type = VALUES(source_type),
         admin_note = COALESCE(sup_club_team_aliases.admin_note, VALUES(admin_note)),
         reviewed_at = COALESCE(sup_club_team_aliases.reviewed_at, VALUES(reviewed_at)),
         updated_at = NOW()`,
      [
        stats.name,
        key,
        match.clubId,
        match.matchStatus,
        match.confidence,
        Math.max(1, stats.standings),
        Math.max(1, stats.years.size),
      ]
    );
  }

  return (row) => {
    const match = matchesByNormalized.get(normalizedTeam(row.club_name_snapshot));
    return match || { clubId: null, matchStatus: 'unmatched', confidence: 0.3 };
  };
}

async function upsertSource(conn, source) {
  await conn.execute(
    `INSERT INTO sup_annual_point_sources
      (source_key, year, title, source_url, form_token, open_search_id, parser_name, sync_status, raw_config)
     VALUES (?, ?, ?, ?, '', '', ?, 'syncing', ?)
     ON DUPLICATE KEY UPDATE
       year = VALUES(year),
       title = VALUES(title),
       source_url = VALUES(source_url),
       parser_name = VALUES(parser_name),
       sync_status = 'syncing',
       raw_config = VALUES(raw_config),
       error_message = NULL,
       source_id = LAST_INSERT_ID(source_id)`,
    [
      source.source_key,
      Number(source.year),
      source.title,
      source.source_url || '',
      source.parser_name || 'parse-annual-points-archive.py',
      JSON.stringify(source.raw_config || {}),
    ]
  );
  const [rows] = await conn.execute('SELECT LAST_INSERT_ID() AS source_id');
  return Number(rows[0].source_id);
}

function parseBreakdowns(row) {
  const lines = String(row.base_detail_text || '').split(/\n+/).map((item) => item.trim()).filter(Boolean);
  return lines.map((line) => ({
    detailType: 'base',
    eventName: line.split(/\s+耐力赛：/)[0] || null,
    rawText: line,
  }));
}

async function upsertStanding(conn, sourceId, row, match) {
  await conn.execute(
    `INSERT INTO sup_annual_point_standings
      (source_id, year, group_code, group_name, rank_position, athlete_id, athlete_name_snapshot, team_name, team_name_normalized,
       total_points, endurance_points, sprint_points, technical_points, base_detail_text, adjustment_detail_text,
       source_record_id, source_token, raw_json, identity_link_id, match_status, match_confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       year = VALUES(year),
       group_code = VALUES(group_code),
       group_name = VALUES(group_name),
       rank_position = VALUES(rank_position),
       athlete_id = VALUES(athlete_id),
       athlete_name_snapshot = VALUES(athlete_name_snapshot),
       team_name = VALUES(team_name),
       team_name_normalized = VALUES(team_name_normalized),
       total_points = VALUES(total_points),
       endurance_points = VALUES(endurance_points),
       sprint_points = VALUES(sprint_points),
       technical_points = VALUES(technical_points),
       base_detail_text = VALUES(base_detail_text),
       adjustment_detail_text = VALUES(adjustment_detail_text),
       raw_json = VALUES(raw_json),
       identity_link_id = VALUES(identity_link_id),
       match_status = VALUES(match_status),
       match_confidence = VALUES(match_confidence),
       standing_id = LAST_INSERT_ID(standing_id)`,
    [
      sourceId,
      Number(row.year),
      row.group_code,
      row.group_name,
      row.rank_position == null ? null : Number(row.rank_position),
      match.athleteId,
      row.athlete_name_snapshot,
      row.team_name || null,
      row.team_name ? normalizedTeam(row.team_name) : null,
      numberOrNull(row.total_points),
      numberOrNull(row.endurance_points),
      numberOrNull(row.sprint_points),
      numberOrNull(row.technical_points),
      row.base_detail_text || null,
      row.adjustment_detail_text || null,
      row.source_record_id,
      row.source_token || null,
      JSON.stringify(row.raw_json || {}),
      match.identityLinkId,
      match.matchStatus,
      match.confidence,
    ]
  );
  const [ids] = await conn.execute('SELECT LAST_INSERT_ID() AS standing_id');
  const standingId = Number(ids[0].standing_id);
  await conn.execute('DELETE FROM sup_annual_point_breakdowns WHERE standing_id = ?', [standingId]);
  for (const item of parseBreakdowns(row)) {
    await conn.execute(
      `INSERT INTO sup_annual_point_breakdowns
        (standing_id, detail_type, event_name, star_level, endurance_points, sprint_points, technical_points, raw_text)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?)`,
      [standingId, item.detailType, item.eventName, item.rawText]
    );
  }
}

async function bulkUpsertStandings(conn, rows, sourceIds, athleteMatcher) {
  const columns = [
    'source_id',
    'year',
    'group_code',
    'group_name',
    'rank_position',
    'athlete_id',
    'athlete_name_snapshot',
    'team_name',
    'team_name_normalized',
    'total_points',
    'endurance_points',
    'sprint_points',
    'technical_points',
    'base_detail_text',
    'adjustment_detail_text',
    'source_record_id',
    'source_token',
    'raw_json',
    'identity_link_id',
    'match_status',
    'match_confidence',
  ];
  let imported = 0;
  for (const chunk of chunkArray(rows, 300)) {
    const values = [];
    for (const row of chunk) {
      const sourceId = sourceIds.get(row.source_key);
      if (!sourceId) throw new Error(`unknown source_key ${row.source_key}`);
      const match = await athleteMatcher(row);
      values.push(
        sourceId,
        Number(row.year),
        row.group_code,
        row.group_name,
        row.rank_position == null ? null : Number(row.rank_position),
        match.athleteId,
        row.athlete_name_snapshot,
        row.team_name || null,
        row.team_name ? normalizedTeam(row.team_name) : null,
        numberOrNull(row.total_points),
        numberOrNull(row.endurance_points),
        numberOrNull(row.sprint_points),
        numberOrNull(row.technical_points),
        row.base_detail_text || null,
        row.adjustment_detail_text || null,
        row.source_record_id,
        row.source_token || null,
        JSON.stringify(row.raw_json || {}),
        match.identityLinkId,
        match.matchStatus,
        match.confidence
      );
    }
    await conn.query(
      `INSERT INTO sup_annual_point_standings (${columns.join(',')})
       VALUES ${placeholders(chunk, columns)}
       ON DUPLICATE KEY UPDATE
         year = VALUES(year),
         group_code = VALUES(group_code),
         group_name = VALUES(group_name),
         rank_position = VALUES(rank_position),
         athlete_id = VALUES(athlete_id),
         athlete_name_snapshot = VALUES(athlete_name_snapshot),
         team_name = VALUES(team_name),
         team_name_normalized = VALUES(team_name_normalized),
         total_points = VALUES(total_points),
         endurance_points = VALUES(endurance_points),
         sprint_points = VALUES(sprint_points),
         technical_points = VALUES(technical_points),
         base_detail_text = VALUES(base_detail_text),
         adjustment_detail_text = VALUES(adjustment_detail_text),
         raw_json = VALUES(raw_json),
         identity_link_id = VALUES(identity_link_id),
         match_status = VALUES(match_status),
         match_confidence = VALUES(match_confidence)`,
      values
    );
    imported += chunk.length;
    if (imported % 3000 === 0 || imported === rows.length) {
      console.log(`standings ${imported}/${rows.length}`);
    }
  }
}

async function upsertClubStanding(conn, sourceId, row, match) {
  await conn.execute(
    `INSERT INTO sup_annual_club_point_standings
      (source_id, year, rank_position, club_id, club_name_snapshot, club_name_normalized, total_points,
       source_record_id, raw_json, match_status, match_confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       year = VALUES(year),
       rank_position = VALUES(rank_position),
       club_id = VALUES(club_id),
       club_name_snapshot = VALUES(club_name_snapshot),
       club_name_normalized = VALUES(club_name_normalized),
       total_points = VALUES(total_points),
       raw_json = VALUES(raw_json),
       match_status = VALUES(match_status),
       match_confidence = VALUES(match_confidence)`,
    [
      sourceId,
      Number(row.year),
      row.rank_position == null ? null : Number(row.rank_position),
      match.clubId,
      row.club_name_snapshot,
      normalizedTeam(row.club_name_snapshot),
      numberOrNull(row.total_points),
      row.source_record_id,
      JSON.stringify(row.raw_json || {}),
      match.matchStatus,
      match.confidence,
    ]
  );
}

async function bulkUpsertClubStandings(conn, rows, sourceIds, clubMatcher) {
  const columns = [
    'source_id',
    'year',
    'rank_position',
    'club_id',
    'club_name_snapshot',
    'club_name_normalized',
    'total_points',
    'source_record_id',
    'raw_json',
    'match_status',
    'match_confidence',
  ];
  for (const chunk of chunkArray(rows, 500)) {
    const values = [];
    for (const row of chunk) {
      const sourceId = sourceIds.get(row.source_key);
      if (!sourceId) throw new Error(`unknown source_key ${row.source_key}`);
      const match = clubMatcher(row);
      values.push(
        sourceId,
        Number(row.year),
        row.rank_position == null ? null : Number(row.rank_position),
        match.clubId,
        row.club_name_snapshot,
        normalizedTeam(row.club_name_snapshot),
        numberOrNull(row.total_points),
        row.source_record_id,
        JSON.stringify(row.raw_json || {}),
        match.matchStatus,
        match.confidence
      );
    }
    await conn.query(
      `INSERT INTO sup_annual_club_point_standings (${columns.join(',')})
       VALUES ${placeholders(chunk, columns)}
       ON DUPLICATE KEY UPDATE
         year = VALUES(year),
         rank_position = VALUES(rank_position),
         club_id = VALUES(club_id),
         club_name_snapshot = VALUES(club_name_snapshot),
         club_name_normalized = VALUES(club_name_normalized),
         total_points = VALUES(total_points),
         raw_json = VALUES(raw_json),
         match_status = VALUES(match_status),
         match_confidence = VALUES(match_confidence)`,
      values
    );
  }
  console.log(`club_standings ${rows.length}/${rows.length}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const standings = Array.isArray(payload.standings) ? payload.standings : [];
  const clubStandings = Array.isArray(payload.club_standings) ? payload.club_standings : [];
  const anomalies = Array.isArray(payload.anomalies) ? payload.anomalies : [];
  const manualReview = Array.isArray(payload.manual_review) ? payload.manual_review : [];
  const counts = {
    sources: sources.length,
    standings: standings.length,
    clubStandings: clubStandings.length,
    anomalies: anomalies.length,
    manualReview: manualReview.length,
  };

  if (args.dryRun) {
    const byYear = {};
    for (const row of standings) {
      const key = `${row.year}|${row.group_name}`;
      byYear[key] = (byYear[key] || 0) + 1;
    }
    console.log(JSON.stringify({ dryRun: true, ...counts, groups: byYear }, null, 2));
    return;
  }
  if (anomalies.length) {
    throw new Error(`存在 ${anomalies.length} 条 OCR/清洗异常，请先复核 .cache 中的 review/anomalies.csv`);
  }

  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
  });

  const sourceIds = new Map();
  try {
    await conn.beginTransaction();
    for (const source of sources) {
      sourceIds.set(source.source_key, await upsertSource(conn, source));
    }
    const athleteMatcher = await createAthleteMatcher(conn, standings);
    await bulkUpsertStandings(conn, standings, sourceIds, athleteMatcher);
    const clubMatcher = await createClubMatcher(conn, clubStandings);
    await bulkUpsertClubStandings(conn, clubStandings, sourceIds, clubMatcher);
    for (const source of sources) {
      const sourceId = sourceIds.get(source.source_key);
      const sourceStandingCount = standings.filter((row) => row.source_key === source.source_key).length;
      const sourceClubCount = clubStandings.filter((row) => row.source_key === source.source_key).length;
      const groupCounts = {};
      for (const row of standings.filter((item) => item.source_key === source.source_key)) {
        groupCounts[row.group_code] = groupCounts[row.group_code] || { label: row.group_name, fetched: 0, totalCount: 0 };
        groupCounts[row.group_code].fetched += 1;
        groupCounts[row.group_code].totalCount += 1;
      }
      await conn.execute(
        `UPDATE sup_annual_point_sources
         SET sync_status = 'imported',
             total_records = ?,
             imported_records = ?,
             group_counts = ?,
             error_message = NULL,
             last_synced_at = CURRENT_TIMESTAMP
         WHERE source_id = ?`,
        [sourceStandingCount + sourceClubCount, sourceStandingCount + sourceClubCount, JSON.stringify(groupCounts), sourceId]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }

  console.log(JSON.stringify({ dryRun: false, imported: counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
