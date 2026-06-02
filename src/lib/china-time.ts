const CHINA_TIME_ZONE = 'Asia/Shanghai';

function normalizeDateInput(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return new Date(`${text.replace(' ', 'T')}Z`);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatChinaDateTime(value: string | Date | null | undefined) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return '';
  if (typeof normalized === 'string') return normalized;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: CHINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(normalized).replace(/\//g, '-');
}

export function formatChinaDate(value: string | Date | null | undefined) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return '';
  if (typeof normalized === 'string') return normalized;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: CHINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(normalized).replace(/\//g, '-');
}

export function normalizeDateOnly(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return formatChinaDate(value);
  const text = String(value).trim();
  if (!text) return null;
  const matched = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return matched || formatChinaDate(text) || text;
}
