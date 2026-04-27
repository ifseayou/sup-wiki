export interface TrainingLapDraft {
  lap_no: number;
  time_seconds: number | null;
  distance_km: number | null;
  avg_pace_sec_per_km: number | null;
}

export interface TrainingSessionDraft {
  title: string;
  activity_type: 'sup';
  started_at: string | null;
  duration_seconds: number | null;
  moving_time_seconds: number | null;
  elapsed_time_seconds: number | null;
  distance_km: number | null;
  avg_pace_sec_per_km: number | null;
  avg_moving_pace_sec_per_km: number | null;
  best_pace_sec_per_km: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  stroke_count: number | null;
  avg_stroke_rate: number | null;
  max_stroke_rate: number | null;
  avg_stroke_distance_m: number | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  training_load: number | null;
  intensity_minutes_moderate: number | null;
  intensity_minutes_vigorous: number | null;
  body_battery_impact: number | null;
  laps: TrainingLapDraft[];
}

export const EMPTY_TRAINING_DRAFT: TrainingSessionDraft = {
  title: '桨板训练',
  activity_type: 'sup',
  started_at: null,
  duration_seconds: null,
  moving_time_seconds: null,
  elapsed_time_seconds: null,
  distance_km: null,
  avg_pace_sec_per_km: null,
  avg_moving_pace_sec_per_km: null,
  best_pace_sec_per_km: null,
  avg_speed_kmh: null,
  max_speed_kmh: null,
  avg_heart_rate: null,
  max_heart_rate: null,
  stroke_count: null,
  avg_stroke_rate: null,
  max_stroke_rate: null,
  avg_stroke_distance_m: null,
  training_effect_aerobic: null,
  training_effect_anaerobic: null,
  training_load: null,
  intensity_minutes_moderate: null,
  intensity_minutes_vigorous: null,
  body_battery_impact: null,
  laps: [],
};

function normalizeText(text: string): string {
  return text
    .replace(/[：]/g, ':')
    .replace(/[，]/g, ',')
    .replace(/[／]/g, '/')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function parseDurationToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const clean = value.trim();
  const parts = clean.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  return null;
}

function parseDecimal(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pickSeconds(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*\\n?\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)`));
    const seconds = parseDurationToSeconds(match?.[1]);
    if (seconds !== null) return seconds;
  }
  return null;
}

function pickNumber(text: string, labels: string[], suffix = ''): number | null {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*\\n?\\s*([+-]?\\d[\\d,]*(?:\\.\\d+)?)\\s*${suffix}`));
    const n = parseDecimal(match?.[1]);
    if (n !== null) return n;
  }
  return null;
}

function pickPace(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*\\n?\\s*(\\d{1,2}:\\d{2})\\s*(?:/\\s*公里|分钟/千米|/公里)?`));
    const seconds = parseDurationToSeconds(match?.[1]);
    if (seconds !== null) return seconds;
  }
  return null;
}

function parseLaps(text: string): TrainingLapDraft[] {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const laps: TrainingLapDraft[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lapNo = Number(lines[i]);
    if (!Number.isInteger(lapNo) || lapNo < 1 || lapNo > 200) continue;
    const time = lines[i + 1];
    const distance = lines[i + 2];
    const pace = lines[i + 3];
    if (!time || !distance || !pace) continue;

    const timeSeconds = parseDurationToSeconds(time);
    const distanceKm = parseDecimal(distance);
    const paceSeconds = parseDurationToSeconds(pace);
    if (timeSeconds === null || distanceKm === null || paceSeconds === null) continue;

    laps.push({
      lap_no: lapNo,
      time_seconds: timeSeconds,
      distance_km: distanceKm,
      avg_pace_sec_per_km: paceSeconds,
    });
  }

  return laps;
}

function parseGarminTotalRow(text: string): Pick<TrainingSessionDraft, 'duration_seconds' | 'distance_km' | 'avg_pace_sec_per_km'> {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const totalIndex = lines.findIndex(line => line === '总计');
  if (totalIndex < 0) return { duration_seconds: null, distance_km: null, avg_pace_sec_per_km: null };

  return {
    duration_seconds: parseDurationToSeconds(lines[totalIndex + 1]),
    distance_km: parseDecimal(lines[totalIndex + 2]),
    avg_pace_sec_per_km: parseDurationToSeconds(lines[totalIndex + 3]),
  };
}

export function mergeTrainingDrafts(base: TrainingSessionDraft, next: Partial<TrainingSessionDraft>): TrainingSessionDraft {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== null && value !== undefined && value !== '')
    ),
    laps: next.laps && next.laps.length > 0 ? next.laps : base.laps,
  };
}

export function parseGarminTrainingText(rawText: string): TrainingSessionDraft {
  const text = normalizeText(rawText);
  const laps = parseLaps(text);
  const totalRow = parseGarminTotalRow(text);

  return {
    ...EMPTY_TRAINING_DRAFT,
    title: /桨板冲浪/.test(text) ? '桨板冲浪' : '桨板训练',
    duration_seconds: pickSeconds(text, ['总时长', '时间']) ?? totalRow.duration_seconds,
    moving_time_seconds: pickSeconds(text, ['移动时间']),
    elapsed_time_seconds: pickSeconds(text, ['全程用时']),
    distance_km: pickNumber(text, ['距离'], '(?:公里|km)?') ?? totalRow.distance_km,
    avg_pace_sec_per_km: pickPace(text, ['平均配速']) ?? totalRow.avg_pace_sec_per_km,
    avg_moving_pace_sec_per_km: pickPace(text, ['平均移动配速']),
    best_pace_sec_per_km: pickPace(text, ['最佳配速']),
    avg_speed_kmh: pickNumber(text, ['平均速度'], '(?:km/h|公里/小时)?'),
    max_speed_kmh: pickNumber(text, ['最大速度'], '(?:km/h|公里/小时)?'),
    avg_heart_rate: pickNumber(text, ['平均心率'], '(?:bpm)?'),
    max_heart_rate: pickNumber(text, ['最大心率'], '(?:bpm)?'),
    stroke_count: pickNumber(text, ['总划水次数']),
    avg_stroke_rate: pickNumber(text, ['平均划水速率'], '(?:步/分)?'),
    max_stroke_rate: pickNumber(text, ['最高划水率'], '(?:步/分)?'),
    avg_stroke_distance_m: pickNumber(text, ['平均单次划水距离'], '(?:米)?'),
    training_effect_aerobic: pickNumber(text, ['有氧效果']),
    training_effect_anaerobic: pickNumber(text, ['无氧']),
    training_load: pickNumber(text, ['运动负荷']),
    intensity_minutes_moderate: pickNumber(text, ['适中'], '(?:分钟)?'),
    intensity_minutes_vigorous: pickNumber(text, ['高强度'], '(?:分钟)?'),
    body_battery_impact: pickNumber(text, ['净影响']),
    laps,
  };
}

export function secondsToDisplay(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
