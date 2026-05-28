import type { RowDataPacket } from 'mysql2';

export const coachCheckStatusLabels: Record<string, string> = {
  queued: '待查询',
  hit: '命中',
  not_found: '未命中',
  ambiguous: '重名待确认',
  blocked: '被限制',
  error: '失败',
};

export const coachMatchStatusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已驳回',
  linked_elsewhere: '已改挂',
};

export function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function dateOrNull(value: unknown) {
  const text = textOrNull(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})/);
  if (!match) return text;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

export function maskCertificateNo(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length <= 8) return text;
  return `${text.slice(0, 6)}****${text.slice(-4)}`;
}

export function parseCandidateAthleteIds(value: unknown) {
  if (!value) return [];
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0) : [];
  } catch {
    return [];
  }
}

export function normalizeCoachCheckRow(row: RowDataPacket) {
  return {
    ...row,
    candidate_athlete_ids: parseCandidateAthleteIds(row.candidate_athlete_ids),
  };
}

export function parseDelimitedCertificateRows(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length === 0) return [];
  const headers = rows[0].split(/,|\t/).map((item) => item.trim());
  const hasHeader = headers.some((item) => /name|姓名|certificate|证书|club|俱乐部|expiry|有效期/i.test(item));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  return dataRows.map((line) => {
    const cells = line.split(/,|\t/).map((item) => item.trim());
    if (hasHeader) {
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    }
    return {
      name: cells[0] || '',
      certificate_no: cells[1] || '',
      club_name: cells[2] || '',
      expiry_date: cells[3] || '',
      source_url: cells[4] || '',
    };
  });
}
