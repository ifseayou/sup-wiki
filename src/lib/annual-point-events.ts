import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from './db';

export type AnnualPointEventStatus = 'unmatched' | 'candidate' | 'confirmed' | 'ignored';

interface PointEventAggregate extends RowDataPacket {
  source_id: number;
  year: number;
  point_event_name: string;
  star_level: number | null;
  point_rows_count: number;
  athlete_count: number;
  total_point_sum: string | number | null;
}

interface LocalEvent extends RowDataPacket {
  event_id: number;
  name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  result_status: string | null;
  results_count: number;
}

interface CandidateEvent {
  event_id: number;
  name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  result_status: string | null;
  results_count: number;
  confidence: number;
  reason: string;
}

const NOISE_PHRASES = [
  '暨全国桨板u系列赛',
  '暨全国桨板U系列赛',
  '暨国际桨板公开赛',
  '暨中国桨板嘉年华',
  '暨全国桨板冠军赛',
  '全国桨板u系列赛',
  '全国桨板U系列赛',
  '中国桨板公开赛',
  '桨板公开赛',
  '桨板竞速',
  '桨板赛',
  '赛事',
];

function normalizeLoose(value: string) {
  let text = String(value || '').trim().toLowerCase();
  text = text.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 65248));
  text = text.replace(/[（）]/g, (char) => (char === '（' ? '(' : ')'));
  text = text.replace(/20\d{2}年?/g, '');
  for (const phrase of NOISE_PHRASES) text = text.replaceAll(phrase.toLowerCase(), '');
  return text.replace(/[\s\t\r\n()（）·・,，。:：;；\-—–_【】[\]「」“”"《》杯]/g, '');
}

export function normalizeAnnualPointEventName(value: string) {
  return normalizeLoose(value);
}

function tokenSet(value: string) {
  const tokens = new Set<string>();
  const normalized = normalizeLoose(value);
  for (const match of normalized.matchAll(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{2,}/g)) {
    const word = match[0];
    if (word.length >= 2) tokens.add(word);
  }
  for (const city of ['常熟', '开州', '三门峡', '苏州', '邵阳', '云和', '深汕', '丽水', '珠海', '铜仁', '宁波', '乐山', '巴州', '海口', '南宁', '常州', '无锡', '海南', '东方', '青田']) {
    if (value.includes(city)) tokens.add(city);
  }
  for (const keyword of ['亚洲杯', '冠军赛', '锦标赛', '超级联赛', '俱乐部联赛', '百城', '总决赛']) {
    if (value.includes(keyword)) tokens.add(keyword);
  }
  return tokens;
}

function overlapScore(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}

function scoreCandidate(pointName: string, event: LocalEvent) {
  const pointKey = normalizeLoose(pointName);
  const eventKey = normalizeLoose(event.name);
  if (!pointKey || !eventKey) return { confidence: 0, reason: '名称为空' };
  if (pointKey === eventKey) return { confidence: 0.98, reason: '强归一化名称完全一致' };
  if (pointKey.includes(eventKey) || eventKey.includes(pointKey)) {
    const confidence = Math.min(0.92, 0.76 + Math.min(pointKey.length, eventKey.length) / Math.max(pointKey.length, eventKey.length) * 0.16);
    return { confidence, reason: '强归一化名称互相包含' };
  }
  const pointTokens = tokenSet(pointName);
  const eventTokens = tokenSet(event.name);
  const overlap = overlapScore(pointTokens, eventTokens);
  if (overlap <= 0) return { confidence: 0, reason: '关键词无交集' };
  const stationBonus = Array.from(pointTokens).some((token) => eventTokens.has(token) && /站|常熟|开州|三门峡|苏州|邵阳|云和|深汕|丽水|珠海|铜仁|宁波|乐山|巴州|海口|南宁|常州|无锡|青田/.test(token)) ? 0.12 : 0;
  const confidence = Math.min(0.88, 0.45 + overlap * 0.35 + stationBonus);
  return { confidence, reason: `关键词重合 ${(overlap * 100).toFixed(0)}%` };
}

function parseJsonArray(value: unknown): CandidateEvent[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as CandidateEvent[];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function analyzeAnnualPointEvents(connection: PoolConnection = pool as unknown as PoolConnection) {
  const [sourceRows] = await connection.execute<RowDataPacket[]>(
    `SELECT source_id, year
     FROM sup_annual_point_sources
     WHERE source_key = 'jinshuju-2025-sup-race-points'
     LIMIT 1`
  );
  const source = sourceRows[0];
  if (!source) throw new Error('请先同步 2025 年度积分数据');

  const [pointEvents] = await connection.execute<PointEventAggregate[]>(
    `SELECT
       s.source_id,
       s.year,
       b.event_name AS point_event_name,
       MAX(b.star_level) AS star_level,
       COUNT(*) AS point_rows_count,
       COUNT(DISTINCT s.athlete_name_snapshot) AS athlete_count,
       SUM(COALESCE(b.endurance_points, 0) + COALESCE(b.sprint_points, 0) + COALESCE(b.technical_points, 0)) AS total_point_sum
     FROM sup_annual_point_breakdowns b
     INNER JOIN sup_annual_point_standings s ON s.standing_id = b.standing_id
     WHERE s.source_id = ? AND b.detail_type = 'base' AND b.event_name IS NOT NULL AND b.event_name <> ''
     GROUP BY s.source_id, s.year, b.event_name`,
    [source.source_id]
  );

  const [events] = await connection.execute<LocalEvent[]>(
    `SELECT e.event_id, e.name, e.start_date, e.city, e.province, e.result_status, COALESCE(r.results_count, 0) AS results_count
     FROM sup_events e
     LEFT JOIN (
       SELECT event_id, COUNT(*) AS results_count
       FROM sup_event_results
       GROUP BY event_id
     ) r ON r.event_id = e.event_id
     WHERE e.event_type = 'race' AND (YEAR(e.start_date) = 2025 OR e.start_date IS NULL)
     ORDER BY e.start_date DESC, e.event_id DESC`
  );

  let analyzed = 0;
  for (const item of pointEvents) {
    const candidates = events
      .map((event) => {
        const scored = scoreCandidate(item.point_event_name, event);
        return {
          event_id: Number(event.event_id),
          name: event.name,
          start_date: event.start_date,
          city: event.city,
          province: event.province,
          result_status: event.result_status,
          results_count: Number(event.results_count || 0),
          confidence: Number(scored.confidence.toFixed(3)),
          reason: scored.reason,
        };
      })
      .filter((event) => event.confidence >= 0.58)
      .sort((a, b) => b.confidence - a.confidence || b.results_count - a.results_count)
      .slice(0, 5);
    const best = candidates[0] || null;
    const nextStatus: AnnualPointEventStatus = best ? 'candidate' : 'unmatched';
    const normalized = normalizeAnnualPointEventName(item.point_event_name);

    await connection.execute(
      `INSERT INTO sup_annual_point_event_mappings
        (source_id, year, point_event_name, normalized_name, star_level, point_rows_count, athlete_count,
         total_point_sum, matched_event_id, candidate_events, match_status, match_confidence, match_reason, last_analyzed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         year = VALUES(year),
         normalized_name = VALUES(normalized_name),
         star_level = VALUES(star_level),
         point_rows_count = VALUES(point_rows_count),
         athlete_count = VALUES(athlete_count),
         total_point_sum = VALUES(total_point_sum),
         candidate_events = VALUES(candidate_events),
         matched_event_id = CASE
           WHEN match_status IN ('confirmed', 'ignored') THEN matched_event_id
           ELSE VALUES(matched_event_id)
         END,
         match_status = CASE
           WHEN match_status IN ('confirmed', 'ignored') THEN match_status
           ELSE VALUES(match_status)
         END,
         match_confidence = CASE
           WHEN match_status IN ('confirmed', 'ignored') THEN match_confidence
           ELSE VALUES(match_confidence)
         END,
         match_reason = CASE
           WHEN match_status IN ('confirmed', 'ignored') THEN match_reason
           ELSE VALUES(match_reason)
         END,
         last_analyzed_at = CURRENT_TIMESTAMP`,
      [
        item.source_id,
        item.year,
        item.point_event_name,
        normalized,
        item.star_level,
        item.point_rows_count,
        item.athlete_count,
        item.total_point_sum || 0,
        best?.event_id || null,
        JSON.stringify(candidates),
        nextStatus,
        best?.confidence || 0,
        best?.reason || null,
      ]
    );
    analyzed += 1;
  }

  return { analyzed };
}

export function normalizeCandidateEvents(value: unknown) {
  return parseJsonArray(value);
}
