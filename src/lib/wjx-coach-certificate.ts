import crypto from 'crypto';
import { dateOrNull, maskCertificateNo, textOrNull } from '@/lib/coach-certificate-checks';

const WJX_QUERY_URL = 'https://www.wjx.cn/resultquery.aspx?activity=251493134';
const WJX_NAME_FIELD = '20000';
const SOURCE_TITLE = '全国桨板教练员信息公示';
const REQUEST_TIMEOUT_MS = 12000;

export type WjxCoachCertificateRecord = {
  publicIndex: string | null;
  name: string | null;
  certificateNo: string | null;
  certificateNoMasked: string | null;
  clubName: string | null;
  expiryDate: string | null;
  sourceTitle: string;
  sourceUrl: string;
  sourceExcerpt: string;
  rawHash: string;
};

export type WjxCoachCertificateResult = {
  status: 'hit' | 'not_found' | 'ambiguous' | 'blocked' | 'error';
  records: WjxCoachCertificateRecord[];
  errorMessage: string | null;
};

type WjxTokens = {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' '));
}

function readInputValue(html: string, name: string) {
  const pattern = new RegExp(`<input[^>]*name=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(pattern)?.[0] || '';
  const value = tag.match(/\svalue=["']([^"']*)["']/i)?.[1];
  return value ? decodeHtml(value) : '';
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseTokens(html: string): WjxTokens {
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

function parseDataItems(blockHtml: string) {
  const values: Record<string, string> = {};
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

function buildRecord(values: Record<string, string>): WjxCoachCertificateRecord | null {
  const name = textOrNull(values['姓名']);
  const certificateNo = textOrNull(values['证书编号']);
  const clubName = textOrNull(values['所属俱乐部']);
  const expiryDate = dateOrNull(values['证书有效期截止']);
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

function parseResultHtml(html: string): WjxCoachCertificateResult {
  if (/验证码|访问过于频繁|操作频繁|安全验证|captcha/i.test(html)) {
    return { status: 'blocked', records: [], errorMessage: '问卷星返回安全验证或访问频率限制' };
  }

  const blocks = html.split(/<div[^>]*class=["'][^"']*query__data-result[^"']*["'][^>]*>/i).slice(1);
  const records = blocks
    .map((block) => buildRecord(parseDataItems(block)))
    .filter((record): record is WjxCoachCertificateRecord => Boolean(record));

  if (records.length === 0) {
    return { status: 'not_found', records: [], errorMessage: null };
  }
  if (records.length === 1) {
    return { status: 'hit', records, errorMessage: null };
  }
  return { status: 'ambiguous', records, errorMessage: `查询到 ${records.length} 条同名证书记录` };
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
  return parseTokens(await response.text());
}

export async function queryWjxCoachCertificateByName(name: string): Promise<WjxCoachCertificateResult> {
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
    if (!response.ok) {
      return { status: 'error', records: [], errorMessage: `问卷星查询失败：HTTP ${response.status}` };
    }
    return parseResultHtml(await response.text());
  } catch (error) {
    return {
      status: 'error',
      records: [],
      errorMessage: error instanceof Error ? error.message : '问卷星查询失败',
    };
  }
}

export function summarizeWjxRecords(records: WjxCoachCertificateRecord[]) {
  return records.map((record, index) => `${index + 1}. ${record.sourceExcerpt}`).join('\n').slice(0, 5000);
}
