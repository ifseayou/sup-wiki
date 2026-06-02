const HIDDEN_NAME_LABEL = '隐藏';

function isLikelyChineseName(text: string) {
  return /^[\u3400-\u9fff·]{2,8}$/.test(text);
}

export function maskAthleteName(value: unknown, fallback = HIDDEN_NAME_LABEL) {
  const name = String(value || '').trim();
  if (!name || name === '已隐藏选手' || name === HIDDEN_NAME_LABEL) return fallback;
  if (!isLikelyChineseName(name)) return fallback;

  const chars = Array.from(name);
  if (chars.length <= 1) return fallback;
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}*${chars[chars.length - 1]}`;
}

export function hiddenAthleteName() {
  return HIDDEN_NAME_LABEL;
}
