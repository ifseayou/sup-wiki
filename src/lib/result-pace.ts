export interface ResultPaceInput {
  discipline: string | null;
  gender_group: string | null;
  time_seconds: number | string | null;
  finish_time: string | null;
  result_status_code: string | null;
}

export function toResultNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isNormalResultFinish(row: Pick<ResultPaceInput, 'result_status_code' | 'finish_time'>) {
  const code = String(row.result_status_code || '').trim().toUpperCase();
  if (code) return false;
  const finish = String(row.finish_time || '').trim().toUpperCase();
  return !['DNS', 'DNF', 'DSQ', 'DNQ', 'DQ'].includes(finish);
}

export function parseResultDistanceKm(discipline: string | null) {
  const text = String(discipline || '').toLowerCase().replace(/\s+/g, '');
  const kmMatch = text.match(/(\d+(?:\.\d+)?)(?:公里|千米|km|k)/i);
  if (kmMatch) return Number(kmMatch[1]);
  const meterMatch = text.match(/(\d+(?:\.\d+)?)(?:米|m)/i);
  if (meterMatch) return Number(meterMatch[1]) / 1000;
  return null;
}

export function isYouthResultGroup(genderGroup: string | null) {
  const text = String(genderGroup || '').toUpperCase();
  if (/(U\s*)?(18|15|12|10|9|8)\b/.test(text)) return true;
  return /青少年|少年|儿童|少儿|小学|中学/.test(text);
}

export function isLongDistanceResult(row: Pick<ResultPaceInput, 'discipline' | 'gender_group'>, distanceKm: number | null) {
  if (!distanceKm) return false;
  if (isYouthResultGroup(row.gender_group)) return distanceKm >= 3;
  return distanceKm >= 6;
}

export function formatResultPace(secondsPerKm: number) {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '-';
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

export function getResultPaceDisplay(row: ResultPaceInput) {
  const timeSeconds = toResultNumber(row.time_seconds);
  const distanceKm = parseResultDistanceKm(row.discipline);
  if (!isLongDistanceResult(row, distanceKm) || !isNormalResultFinish(row) || timeSeconds === null || !distanceKm) {
    return {
      distance_km: distanceKm,
      is_long_distance: Boolean(distanceKm && isLongDistanceResult(row, distanceKm)),
      pace_seconds_per_km: null,
      pace_display: '-',
    };
  }
  const paceSeconds = timeSeconds / distanceKm;
  return {
    distance_km: distanceKm,
    is_long_distance: true,
    pace_seconds_per_km: paceSeconds,
    pace_display: formatResultPace(paceSeconds),
  };
}
