function parseTimeToSeconds(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const quoteMatch = raw.match(/^(\d+)'(\d+(?:\.\d+)?)"?$/);
  if (quoteMatch) return Number(quoteMatch[1]) * 60 + Number(quoteMatch[2]);
  const minuteSecondCentisecond = raw.match(/^([1-9]\d{1,2}):(\d{2}):(\d{2})$/);
  if (minuteSecondCentisecond && Number(minuteSecondCentisecond[1]) > 2) {
    return Number(minuteSecondCentisecond[1]) * 60
      + Number(minuteSecondCentisecond[2])
      + Number(minuteSecondCentisecond[3]) / 100;
  }
  const dottedTime = raw.match(/^(\d+):(\d{2})\.(\d{2})\.(\d{1,3})$/);
  if (dottedTime) return Number(dottedTime[1]) * 3600 + Number(dottedTime[2]) * 60 + Number(`${dottedTime[3]}.${dottedTime[4]}`);
  const parts = raw.split(':').map((part) => part.trim());
  if (parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return null;
}

module.exports = { parseTimeToSeconds };
