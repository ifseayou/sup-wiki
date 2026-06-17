/**
 * 成绩质量仪表盘（Phase 4）
 * GET /api/admin/quality                 全局指标 + 按赛事问题清单（分页，按问题数降序）
 * GET /api/admin/quality?event_id=123     单赛事模块级下钻
 *
 * 复用现有审计脚本(check-race-results-summary/audit-*)的核查口径，产品化为接口聚合：
 * 未匹配运动员、模块多第一/缺第一、号码牌重复、标准化覆盖率、低置信成绩。
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, isAdmin, verifyToken } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

function ensureAdmin(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  return isAdmin(payload);
}

// 完赛第一名判定：rank=1 且非 DNS/DNF/DQ 等
const FIRST_PLACE_EXPR = "SUM(CASE WHEN rank_position = 1 AND (result_status_code IS NULL OR result_status_code = '') THEN 1 ELSE 0 END)";

// 预赛/复赛/初赛/半决赛/排位/heat/semifinal/quarter/prelim = 分组 heats，各组各有一名第一、名次为跨组总位次，不做「一组一第一/名次连续」校验。
const HEAT_REGEX = "'(预赛|复赛|初赛|半决赛|资格|排位|[Hh]eat|[Ss]emi|[Qq]uarter|[Pp]relim)'";
const FINAL_LIKE = `(round_label IS NULL OR round_label = '' OR round_label NOT REGEXP ${HEAT_REGEX})`;
// 哨兵名次：9000+ 为 DNS/DNF 占位（部分缺状态码），不计入完赛名次连续性
const COMPLETER = `((result_status_code IS NULL OR result_status_code = '') AND rank_position < 9000)`;

// 标准竞赛名次(1224)校验：排序后第 i 名(0-based) 的 rank 必须 = 比它名次小的人数 + 1；允许并列(同名次)后跳号。
// 返回违规(断号/非法重号)，并列合法。
function rankSequenceBad(ranks: number[]): boolean {
  if (ranks.length === 0) return false;
  const sorted = [...ranks].sort((a, b) => a - b);
  if (sorted[0] !== 1) return true;
  let smaller = 0;
  let prev: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== prev) smaller = i;
    if (sorted[i] !== smaller + 1) return true;
    prev = sorted[i];
  }
  return false;
}

const HEAT_JS = /(预赛|复赛|初赛|半决赛|资格|排位|heat|semi|quarter|prelim)/i;
const isFinalLikeJs = (rl: unknown) => rl == null || String(rl).trim() === '' || !HEAT_JS.test(String(rl));

const unitKey = (r: RowDataPacket) =>
  `${r.discipline}||${r.gender_group}||${r.board_class || ''}||${r.round_label || ''}`;

// 性别错组：组名含「女」却匹配到 male 运动员，或组名含「男」(不含女)却 female。注意 athlete.gender 多为成绩反推，命中多为同名身份合并，需人工核对。
const GENDER_MISMATCH_EXPR =
  "((er.gender_group LIKE '%女%' AND a.gender = 'male') OR (er.gender_group LIKE '%男%' AND er.gender_group NOT LIKE '%女%' AND a.gender = 'female'))";

async function eventDrillDown(eventId: number) {
  // 单场比赛单元 = 项目+组别+板型+轮次（同模块多轮次各有一名第一，不算多第一）
  const [modules] = await pool.execute<RowDataPacket[]>(
    `SELECT discipline, gender_group, board_class, round_label,
            COUNT(*) AS cnt,
            ${FIRST_PLACE_EXPR} AS firsts,
            SUM(athlete_id IS NULL) AS unmatched,
            SUM(norm_confidence < 0.6) AS low_conf,
            SUM(normalized_discipline_key IS NULL OR normalized_discipline_key = 'unknown') AS norm_unknown
     FROM sup_event_results
     WHERE event_id = ?
     GROUP BY discipline, gender_group, board_class, round_label
     ORDER BY discipline, gender_group, board_class, round_label`,
    [eventId]
  );
  // 重复号码牌：仅同一单场比赛单元内同号出现多次才异常（跨项目同号属正常）
  const [dupBib] = await pool.execute<RowDataPacket[]>(
    `SELECT bib_number, discipline, gender_group, round_label, COUNT(*) AS c
     FROM sup_event_results
     WHERE event_id = ? AND bib_number IS NOT NULL AND bib_number <> ''
     GROUP BY bib_number, discipline, gender_group, board_class, round_label HAVING c > 1
     ORDER BY c DESC`,
    [eventId]
  );
  // 问题成绩行明细（带 result_id，便于直达编辑）：未匹配/低置信/多第一(仅决赛)/重号/性别错组
  const [problemRows] = await pool.execute<RowDataPacket[]>(
    `SELECT result_id, athlete_name_snapshot, discipline, gender_group, board_class, round_label, rank_position, finish_time, result_status_code, issue_type FROM (
       SELECT result_id, athlete_name_snapshot, discipline, gender_group, board_class, round_label, rank_position, finish_time, result_status_code, 'unmatched' AS issue_type
       FROM sup_event_results WHERE event_id = ? AND athlete_id IS NULL
       UNION ALL
       SELECT result_id, athlete_name_snapshot, discipline, gender_group, board_class, round_label, rank_position, finish_time, result_status_code, 'low_conf'
       FROM sup_event_results WHERE event_id = ? AND norm_confidence < 0.6
       UNION ALL
       SELECT er.result_id, er.athlete_name_snapshot, er.discipline, er.gender_group, er.board_class, er.round_label, er.rank_position, er.finish_time, er.result_status_code, 'multi_first'
       FROM sup_event_results er
       INNER JOIN (
         SELECT discipline, gender_group, COALESCE(board_class,'') bc, COALESCE(round_label,'') rl
         FROM sup_event_results
         WHERE event_id = ? AND rank_position = 1 AND (result_status_code IS NULL OR result_status_code = '') AND ${FINAL_LIKE}
         GROUP BY discipline, gender_group, bc, rl HAVING COUNT(*) > 1
       ) bad ON er.discipline = bad.discipline AND er.gender_group = bad.gender_group
              AND COALESCE(er.board_class,'') = bad.bc AND COALESCE(er.round_label,'') = bad.rl
       WHERE er.event_id = ? AND er.rank_position = 1 AND (er.result_status_code IS NULL OR er.result_status_code = '')
       UNION ALL
       SELECT er.result_id, er.athlete_name_snapshot, er.discipline, er.gender_group, er.board_class, er.round_label, er.rank_position, er.finish_time, er.result_status_code, 'dup_bib'
       FROM sup_event_results er
       INNER JOIN (
         SELECT bib_number, discipline, gender_group, COALESCE(board_class,'') bc, COALESCE(round_label,'') rl
         FROM sup_event_results
         WHERE event_id = ? AND bib_number IS NOT NULL AND bib_number <> ''
         GROUP BY bib_number, discipline, gender_group, bc, rl HAVING COUNT(*) > 1
       ) dups ON er.bib_number = dups.bib_number AND er.discipline = dups.discipline AND er.gender_group = dups.gender_group
               AND COALESCE(er.board_class,'') = dups.bc AND COALESCE(er.round_label,'') = dups.rl
       WHERE er.event_id = ? AND er.bib_number IS NOT NULL AND er.bib_number <> ''
       UNION ALL
       SELECT er.result_id, er.athlete_name_snapshot, er.discipline, er.gender_group, er.board_class, er.round_label, er.rank_position, er.finish_time, er.result_status_code, 'gender_mismatch'
       FROM sup_event_results er INNER JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       WHERE er.event_id = ? AND ${GENDER_MISMATCH_EXPR}
     ) p
     ORDER BY FIELD(issue_type,'multi_first','gender_mismatch','dup_bib','unmatched','low_conf'), discipline, gender_group, round_label, rank_position
     LIMIT 500`,
    [eventId, eventId, eventId, eventId, eventId, eventId, eventId]
  );

  // rank_gap（仅决赛/无轮次、完赛者按 1224 校验）：在 JS 中分单元判定，命中单元的完赛行作为问题行返回
  const [finalRows] = await pool.execute<RowDataPacket[]>(
    `SELECT result_id, athlete_name_snapshot, discipline, gender_group, board_class, round_label, rank_position, finish_time, result_status_code
     FROM sup_event_results WHERE event_id = ? AND ${COMPLETER} AND ${FINAL_LIKE}`,
    [eventId]
  );
  const byUnit = new Map<string, RowDataPacket[]>();
  for (const r of finalRows) {
    const k = unitKey(r);
    if (!byUnit.has(k)) byUnit.set(k, []);
    byUnit.get(k)!.push(r);
  }
  const rankGapRows: RowDataPacket[] = [];
  for (const rows of byUnit.values()) {
    if (rankSequenceBad(rows.map((r) => Number(r.rank_position)))) rankGapRows.push(...rows);
  }
  const toOut = (r: RowDataPacket, issueType: string) => ({
    result_id: Number(r.result_id),
    athlete_name: r.athlete_name_snapshot,
    discipline: r.discipline,
    gender_group: r.gender_group,
    board_class: r.board_class,
    round_label: r.round_label,
    rank_position: r.rank_position,
    finish_time: r.finish_time,
    result_status_code: r.result_status_code,
    issue_type: issueType,
  });
  const problemAll = [
    ...problemRows.map((r) => toOut(r, String(r.issue_type))),
    ...rankGapRows.map((r) => toOut(r, 'rank_gap')),
  ];
  return NextResponse.json({
    event_id: eventId,
    problem_results: problemAll,
    modules: modules.map((m) => {
      const finalLike = isFinalLikeJs(m.round_label);
      return {
        discipline: m.discipline,
        gender_group: m.gender_group,
        board_class: m.board_class,
        round_label: m.round_label,
        count: Number(m.cnt),
        firsts: Number(m.firsts),
        unmatched: Number(m.unmatched),
        low_conf: Number(m.low_conf),
        norm_unknown: Number(m.norm_unknown),
        // 多第一/缺第一 仅对决赛/无轮次单元判定；预赛/复赛 heats 各组各有一名第一属正常
        multi_first: finalLike && Number(m.firsts) > 1,
        no_first: finalLike && Number(m.firsts) === 0 && Number(m.cnt) > 0,
      };
    }),
    duplicate_bibs: dupBib.map((d) => ({ bib_number: d.bib_number, count: Number(d.c) })),
  });
}

export async function GET(request: NextRequest) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const eventId = Number(request.nextUrl.searchParams.get('event_id'));
  if (Number.isInteger(eventId) && eventId > 0) return eventDrillDown(eventId);

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(10, Number(request.nextUrl.searchParams.get('pageSize') || 20)));

  // 全局指标
  const [globalRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            SUM(athlete_id IS NULL) AS unmatched,
            SUM(norm_confidence < 0.6) AS low_conf,
            SUM(normalized_discipline_key IS NOT NULL AND normalized_discipline_key <> 'unknown') AS norm_known,
            COUNT(DISTINCT event_id) AS events
     FROM sup_event_results`
  );
  const g = globalRows[0] || {};

  // 按赛事基础聚合
  const [base] = await pool.execute<RowDataPacket[]>(
    `SELECT er.event_id, e.name AS event_name, DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date, e.result_status,
            COUNT(*) AS result_count,
            SUM(er.athlete_id IS NULL) AS unmatched_count,
            SUM(er.norm_confidence < 0.6) AS low_conf_count,
            SUM(er.normalized_discipline_key IS NULL OR er.normalized_discipline_key = 'unknown') AS norm_unknown_count
     FROM sup_event_results er
     INNER JOIN sup_events e ON e.event_id = er.event_id
     GROUP BY er.event_id, e.name, e.start_date, e.result_status`
  );

  // 单场比赛单元级：多第一 / 缺第一（仅决赛/无轮次；预赛/复赛 heats 不计）
  const [mods] = await pool.execute<RowDataPacket[]>(
    `SELECT event_id,
            COUNT(*) AS modules,
            SUM(firsts > 1) AS multi_first,
            SUM(firsts = 0 AND cnt > 0) AS no_first
     FROM (
       SELECT event_id, discipline, gender_group, COALESCE(board_class, '') AS bc, COALESCE(round_label, '') AS rl,
              COUNT(*) AS cnt, ${FIRST_PLACE_EXPR} AS firsts
       FROM sup_event_results
       WHERE ${FINAL_LIKE}
       GROUP BY event_id, discipline, gender_group, bc, rl
     ) m
     GROUP BY event_id`
  );

  // 性别错组（同名身份合并嫌疑）：按赛事计数
  const [gmRows] = await pool.execute<RowDataPacket[]>(
    `SELECT er.event_id, COUNT(*) AS gm
     FROM sup_event_results er INNER JOIN sup_athletes a ON a.athlete_id = er.athlete_id
     WHERE ${GENDER_MISMATCH_EXPR}
     GROUP BY er.event_id`
  );

  // rank_gap：决赛/无轮次完赛者按 1224 校验，JS 分单元统计每赛事违规单元数
  const [finalAll] = await pool.execute<RowDataPacket[]>(
    `SELECT event_id, discipline, gender_group, board_class, round_label, rank_position
     FROM sup_event_results WHERE ${COMPLETER} AND ${FINAL_LIKE}`
  );
  const unitRanks = new Map<string, number[]>();
  for (const r of finalAll) {
    const k = `${r.event_id}||${unitKey(r)}`;
    if (!unitRanks.has(k)) unitRanks.set(k, []);
    unitRanks.get(k)!.push(Number(r.rank_position));
  }
  const rankGapByEvent = new Map<number, number>();
  for (const [k, ranks] of unitRanks) {
    if (rankSequenceBad(ranks)) {
      const eid = Number(k.split('||')[0]);
      rankGapByEvent.set(eid, (rankGapByEvent.get(eid) || 0) + 1);
    }
  }
  const gmMap = new Map<number, number>(gmRows.map((r) => [Number(r.event_id), Number(r.gm)]));

  // 号码牌重复：仅同一单场比赛单元(含轮次)内同号多次才异常（跨项目同号正常）
  const [bibs] = await pool.execute<RowDataPacket[]>(
    `SELECT event_id, SUM(c - 1) AS dup_bib
     FROM (
       SELECT event_id, bib_number, COUNT(*) AS c
       FROM sup_event_results
       WHERE bib_number IS NOT NULL AND bib_number <> ''
       GROUP BY event_id, discipline, gender_group, board_class, round_label, bib_number HAVING c > 1
     ) t
     GROUP BY event_id`
  );

  const modMap = new Map<number, RowDataPacket>(mods.map((m) => [Number(m.event_id), m]));
  const bibMap = new Map<number, number>(bibs.map((b) => [Number(b.event_id), Number(b.dup_bib)]));

  const events = base.map((r) => {
    const eid = Number(r.event_id);
    const m = modMap.get(eid);
    const multiFirst = m ? Number(m.multi_first) : 0;
    const noFirst = m ? Number(m.no_first) : 0;
    const dupBib = bibMap.get(eid) || 0;
    const genderMismatch = gmMap.get(eid) || 0;
    const rankGap = rankGapByEvent.get(eid) || 0;
    const unmatched = Number(r.unmatched_count);
    const lowConf = Number(r.low_conf_count);
    const normUnknown = Number(r.norm_unknown_count);
    const resultCount = Number(r.result_count);
    // 问题分：影响数据可信度的项加权求和，用于排序
    const issueScore = unmatched + multiFirst * 5 + noFirst * 2 + dupBib * 3 + genderMismatch * 4 + rankGap * 2;
    return {
      event_id: eid,
      event_name: r.event_name,
      start_date: r.start_date || null,
      result_status: r.result_status,
      result_count: resultCount,
      unmatched_count: unmatched,
      low_conf_count: lowConf,
      norm_coverage: resultCount ? Number((((resultCount - normUnknown) / resultCount) * 100).toFixed(1)) : 0,
      modules: m ? Number(m.modules) : 0,
      multi_first: multiFirst,
      no_first: noFirst,
      duplicate_bib: dupBib,
      gender_mismatch: genderMismatch,
      rank_gap: rankGap,
      issue_score: issueScore,
    };
  });

  events.sort((a, b) => b.issue_score - a.issue_score || b.unmatched_count - a.unmatched_count);
  const total = events.length;
  const offset = (page - 1) * pageSize;
  const items = events.slice(offset, offset + pageSize);

  return NextResponse.json({
    global: {
      total_results: Number(g.total || 0),
      unmatched_athletes: Number(g.unmatched || 0),
      low_confidence: Number(g.low_conf || 0),
      events_with_results: Number(g.events || 0),
      normalization_coverage: Number(g.total) ? Number(((Number(g.norm_known) / Number(g.total)) * 100).toFixed(1)) : 0,
      events_with_issues: events.filter((e) => e.issue_score > 0).length,
      gender_mismatch: events.reduce((s, e) => s + e.gender_mismatch, 0),
      rank_gap_units: events.reduce((s, e) => s + e.rank_gap, 0),
    },
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}
