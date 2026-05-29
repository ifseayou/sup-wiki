#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const WJX_QUERY_URL = 'https://www.wjx.cn/resultquery.aspx?activity=251493134';
const WJX_NAME_FIELD = '20000';
const SOURCE_TITLE = '全国桨板教练员信息公示';
const REQUEST_TIMEOUT_MS = 12000;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = process.env[key] || value;
  }
}

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' '));
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function dateOrNull(value) {
  const text = textOrNull(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})/);
  if (!match) return text;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function normalizeExpiryDate(value) {
  const text = textOrNull(value);
  if (!text) return null;
  const standard = dateOrNull(text);
  if (standard && /^\d{4}-\d{2}-\d{2}$/.test(standard)) return standard;
  const shortSlash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortSlash) {
    return `20${shortSlash[3]}-${shortSlash[1].padStart(2, '0')}-${shortSlash[2].padStart(2, '0')}`;
  }
  return null;
}

function maskCertificateNo(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length <= 8) return text;
  return `${text.slice(0, 6)}****${text.slice(-4)}`;
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function readInputValue(html, name) {
  const tag = html.match(new RegExp(`<input[^>]*name=["']${name}["'][^>]*>`, 'i'))?.[0] || '';
  return decodeHtml(tag.match(/\svalue=["']([^"']*)["']/i)?.[1] || '');
}

async function getTokens() {
  const response = await fetchWithTimeout(WJX_QUERY_URL, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 SUP-Wiki Admin Certificate Sync',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`问卷星查询页打开失败：HTTP ${response.status}`);
  const html = await response.text();
  const tokens = {
    viewState: readInputValue(html, '__VIEWSTATE'),
    viewStateGenerator: readInputValue(html, '__VIEWSTATEGENERATOR'),
    eventValidation: readInputValue(html, '__EVENTVALIDATION'),
  };
  if (!tokens.viewState || !tokens.viewStateGenerator || !tokens.eventValidation) {
    throw new Error('问卷星查询页缺少表单令牌');
  }
  return tokens;
}

function parseDataItems(blockHtml) {
  const values = {};
  const chunks = blockHtml.split(/<div[^>]*class=["'][^"']*data__items[^"']*["'][^>]*>/i).slice(1);
  for (const itemHtml of chunks) {
    const titleMatch = itemHtml.match(/<div[^>]*class=["'][^"']*(?:data__tit|data__topic)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const valueMatch = itemHtml.match(/<div[^>]*class=["'][^"']*(?:data__value|data__key)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const title = titleMatch ? stripTags(titleMatch[1]) : '';
    const value = valueMatch ? stripTags(valueMatch[1]) : '';
    if (title) values[title] = value;
  }
  return values;
}

function buildRecord(values) {
  const name = textOrNull(values['姓名']);
  const certificateNo = textOrNull(values['证书编号']);
  const clubName = textOrNull(values['所属俱乐部']);
  const expiryDate = normalizeExpiryDate(values['证书有效期截止']);
  const publicIndex = textOrNull(values['序号']);
  if (!name && !certificateNo && !clubName && !expiryDate) return null;
  const sourceExcerpt = [
    publicIndex ? `序号 ${publicIndex}` : null,
    name ? `姓名 ${name}` : null,
    certificateNo ? `证书编号 ${certificateNo}` : null,
    clubName ? `所属俱乐部 ${clubName}` : null,
    expiryDate ? `证书有效期截止 ${expiryDate}` : null,
  ].filter(Boolean).join(' | ');
  return {
    publicIndex,
    name,
    certificateNo,
    certificateNoMasked: maskCertificateNo(certificateNo),
    clubName,
    expiryDate,
    sourceTitle: SOURCE_TITLE,
    sourceUrl: WJX_QUERY_URL,
    sourceExcerpt,
    rawHash: crypto.createHash('sha256').update(sourceExcerpt).digest('hex'),
  };
}

function parseResultHtml(html) {
  if (/访问过于频繁|操作频繁|安全验证|请完成验证|滑动验证/i.test(html)) {
    return { status: 'blocked', records: [], errorMessage: '问卷星返回安全验证或访问频率限制' };
  }
  const records = html
    .split(/<div[^>]*class=["'][^"']*query__data-result[^"']*["'][^>]*>/i)
    .slice(1)
    .map((block) => buildRecord(parseDataItems(block)))
    .filter(Boolean);
  if (!records.length) return { status: 'not_found', records, errorMessage: null };
  if (records.length === 1) return { status: 'hit', records, errorMessage: null };
  return { status: 'ambiguous', records, errorMessage: `查询到 ${records.length} 条同名证书记录` };
}

async function queryByName(name) {
  const queryName = textOrNull(name);
  if (!queryName) return { status: 'error', records: [], errorMessage: '姓名为空' };
  try {
    const tokens = await getTokens();
    const body = new URLSearchParams({
      __VIEWSTATE: tokens.viewState,
      __VIEWSTATEGENERATOR: tokens.viewStateGenerator,
      __EVENTVALIDATION: tokens.eventValidation,
      hfPostType: '1',
      hfQuery: `${WJX_NAME_FIELD}|${queryName}`,
    });
    const response = await fetchWithTimeout(WJX_QUERY_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 SUP-Wiki Admin Certificate Sync',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: WJX_QUERY_URL,
      },
      body,
    });
    if (!response.ok) return { status: 'error', records: [], errorMessage: `问卷星查询失败：HTTP ${response.status}` };
    return parseResultHtml(await response.text());
  } catch (error) {
    return { status: 'error', records: [], errorMessage: error instanceof Error ? error.message : '问卷星查询失败' };
  }
}

function summarizeRecords(records) {
  return records.map((record, index) => `${index + 1}. ${record.sourceExcerpt}`).join('\n').slice(0, 5000);
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  loadEnv(path.join(repoRoot, '.env.local'));

  const limit = Math.min(100, Math.max(1, Number(readArg('--limit', '50')) || 50));
  const delayMs = Math.min(5000, Math.max(800, Number(readArg('--delay-ms', '1500')) || 1500));
  const dryRun = hasArg('--dry-run');
  const statuses = readArg('--statuses', 'queued,error')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const placeholders = statuses.map(() => '?').join(',');

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sport_hacker',
  });

  const summary = { total: 0, hit: 0, not_found: 0, ambiguous: 0, blocked: 0, error: 0, updated: 0, dry_run: dryRun };
  try {
    const [rows] = await conn.execute(
      `SELECT check_id, athlete_name, query_name, query_status
       FROM sup_coach_certificate_checks
       WHERE match_status <> 'confirmed' AND query_status IN (${placeholders})
       ORDER BY
         CASE query_status WHEN 'queued' THEN 0 WHEN 'error' THEN 1 WHEN 'not_found' THEN 2 ELSE 3 END,
         candidate_rank ASC,
         updated_at ASC
       LIMIT ${limit}`,
      statuses
    );
    summary.total = rows.length;
    for (const [index, row] of rows.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const result = await queryByName(row.query_name || row.athlete_name);
      summary[result.status] += 1;
      const first = result.records[0] || null;
      const sourceExcerpt = result.records.length > 1 ? summarizeRecords(result.records) : first?.sourceExcerpt || null;
      if (!dryRun) {
        if (result.status === 'hit' && first) {
          await conn.execute(
            `UPDATE sup_coach_certificate_checks
             SET query_status = 'hit',
                 certificate_no = ?,
                 certificate_no_masked = ?,
                 club_name = ?,
                 expiry_date = ?,
                 source_title = ?,
                 source_url = ?,
                 source_excerpt = ?,
                 raw_hash = ?,
                 checked_at = NOW(),
                 error_message = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE check_id = ?`,
            [first.certificateNo, first.certificateNoMasked, first.clubName, first.expiryDate, first.sourceTitle, first.sourceUrl, first.sourceExcerpt, first.rawHash, row.check_id]
          );
        } else {
          await conn.execute(
            `UPDATE sup_coach_certificate_checks
             SET query_status = ?,
                 source_title = COALESCE(?, source_title),
                 source_url = COALESCE(?, source_url),
                 source_excerpt = COALESCE(?, source_excerpt),
                 checked_at = NOW(),
                 error_message = ?,
                 next_check_after = CASE WHEN ? = 'blocked' THEN DATE_ADD(NOW(), INTERVAL 1 DAY) ELSE next_check_after END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE check_id = ?`,
            [result.status, first?.sourceTitle || SOURCE_TITLE, first?.sourceUrl || WJX_QUERY_URL, sourceExcerpt, result.errorMessage || null, result.status, row.check_id]
          );
        }
        summary.updated += 1;
      }
      console.log(`${index + 1}/${rows.length} ${row.query_name}: ${result.status}${first?.certificateNoMasked ? ` ${first.certificateNoMasked}` : ''}`);
    }
  } finally {
    await conn.end();
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
