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
  return NextResponse.json({
    event_id: eventId,
    modules: modules.map((m) => ({
      discipline: m.discipline,
      gender_group: m.gender_group,
      board_class: m.board_class,
      count: Number(m.cnt),
      firsts: Number(m.firsts),
      unmatched: Number(m.unmatched),
      low_conf: Number(m.low_conf),
      norm_unknown: Number(m.norm_unknown),
      multi_first: Number(m.firsts) > 1,
      no_first: Number(m.firsts) === 0 && Number(m.cnt) > 0,
    })),
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

  // 单场比赛单元(含轮次)级：多第一 / 缺第一
  const [mods] = await pool.execute<RowDataPacket[]>(
    `SELECT event_id,
            COUNT(*) AS modules,
            SUM(firsts > 1) AS multi_first,
            SUM(firsts = 0 AND cnt > 0) AS no_first
     FROM (
       SELECT event_id, discipline, gender_group, COALESCE(board_class, '') AS bc, COALESCE(round_label, '') AS rl,
              COUNT(*) AS cnt, ${FIRST_PLACE_EXPR} AS firsts
       FROM sup_event_results
       GROUP BY event_id, discipline, gender_group, bc, rl
     ) m
     GROUP BY event_id`
  );

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
    const unmatched = Number(r.unmatched_count);
    const lowConf = Number(r.low_conf_count);
    const normUnknown = Number(r.norm_unknown_count);
    const resultCount = Number(r.result_count);
    // 问题分：影响数据可信度的项加权求和，用于排序
    const issueScore = unmatched + multiFirst * 5 + noFirst * 2 + dupBib * 3;
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
    },
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}
