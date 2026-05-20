export const RESULT_STATUS_LABELS: Record<string, string> = {
  DNS: '未出发',
  DNF: '未完赛',
  DQ: '取消成绩',
  DSQ: '取消成绩',
  DNQ: '未晋级',
  OTL: '超过关门时间',
};

export function normalizeResultStatusCode(value: unknown) {
  const code = String(value || '').trim().toUpperCase();
  return RESULT_STATUS_LABELS[code] ? code : null;
}

export function getResultStatusLabel(code: unknown, note?: unknown) {
  const normalized = normalizeResultStatusCode(code);
  if (!normalized) return String(note || '').trim() || '';
  return String(note || '').trim() || RESULT_STATUS_LABELS[normalized] || normalized;
}
