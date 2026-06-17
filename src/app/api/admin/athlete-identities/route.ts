import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface SourceResult {
  result_id: number;
  event_name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  bib_number: string | null;
  gender_group: string | null;
  discipline: string | null;
  board_class: string | null;
  round_label: string | null;
  rank_position: number | null;
  finish_time: string | null;
  result_status_code: string | null;
  team_name: string | null;
  nationality_snapshot: string | null;
}

interface RecentResult {
  event_name: string;
  start_date: string | null;
  discipline: string | null;
  gender_group: string | null;
  rank_position: number | null;
  finish_time: string | null;
  result_status_code: string | null;
}

interface Candidate {
  athlete_id: number;
  name: string;
  status: string;
  is_claimed: boolean;
  result_count: number;
  gender: string | null;
  nationality: string | null;
  province: string | null;
  city: string | null;
  bio: string | null;
  photo: string | null;
  created_at: string | null;
  recent_results: RecentResult[];
}

const MAX_SOURCE_PER_NAME = 3;
const MAX_RECENT_PER_ATHLETE = 5;

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const search = searchParams.get('search');
    const conditions = ['l.status = ?'];
    const params: (string | number)[] = [status];
    if (search) {
      conditions.push('(l.display_name LIKE ? OR l.team_hint LIKE ? OR a.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT
         l.*,
         a.name AS athlete_name,
         COALESCE(name_disambig.same_name_count, 1) AS same_name_count,
         COALESCE(name_disambig.same_name_index, 1) AS same_name_index,
         CASE
           WHEN COALESCE(name_disambig.same_name_count, 1) > 1
             THEN CONCAT(a.name, '-', name_disambig.same_name_index)
           ELSE a.name
         END AS athlete_admin_display_name
       FROM sup_athlete_identity_links l
       LEFT JOIN sup_athletes a ON a.athlete_id = l.athlete_id
       LEFT JOIN (
         SELECT
           athlete_id,
           COUNT(*) OVER (PARTITION BY LOWER(REPLACE(TRIM(name), ' ', ''))) AS same_name_count,
           ROW_NUMBER() OVER (
             PARTITION BY LOWER(REPLACE(TRIM(name), ' ', ''))
             ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, athlete_id ASC
           ) AS same_name_index
         FROM sup_athletes
         WHERE name IS NOT NULL AND TRIM(name) <> ''
       ) name_disambig ON name_disambig.athlete_id = a.athlete_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.updated_at DESC
       LIMIT 100`,
      params
    );

    const norms = Array.from(new Set((items as RowDataPacket[]).map((r) => String(r.normalized_name || '')).filter(Boolean)));

    // 1) 本次导入「来源成绩」：未关联 athlete_id 的同名快照成绩（带上赛事信息，供管理员对比身份）
    const sourceByNorm = new Map<string, SourceResult[]>();
    if (norms.length) {
      const placeholders = norms.map(() => '?').join(',');
      const [srcRows] = await pool.execute<RowDataPacket[]>(
        `SELECT er.result_id,
                LOWER(REPLACE(TRIM(er.athlete_name_snapshot), ' ', '')) AS norm,
                er.bib_number, er.gender_group, er.discipline, er.board_class, er.round_label,
                er.rank_position, er.finish_time, er.result_status_code, er.team_name, er.nationality_snapshot,
                e.name AS event_name, e.start_date, e.city, e.province
           FROM sup_event_results er
           INNER JOIN sup_events e ON e.event_id = er.event_id
          WHERE er.athlete_id IS NULL
            AND LOWER(REPLACE(TRIM(er.athlete_name_snapshot), ' ', '')) IN (${placeholders})
          ORDER BY e.start_date DESC, er.created_at DESC`,
        norms
      );
      for (const r of srcRows as RowDataPacket[]) {
        const k = String(r.norm || '');
        if (!sourceByNorm.has(k)) sourceByNorm.set(k, []);
        const list = sourceByNorm.get(k)!;
        if (list.length >= MAX_SOURCE_PER_NAME) continue;
        list.push({
          result_id: Number(r.result_id),
          event_name: r.event_name || '',
          start_date: r.start_date ? String(r.start_date) : null,
          city: r.city || null,
          province: r.province || null,
          bib_number: r.bib_number || null,
          gender_group: r.gender_group || null,
          discipline: r.discipline || null,
          board_class: r.board_class || null,
          round_label: r.round_label || null,
          rank_position: r.rank_position != null ? Number(r.rank_position) : null,
          finish_time: r.finish_time || null,
          result_status_code: r.result_status_code || null,
          team_name: r.team_name || null,
          nationality_snapshot: r.nationality_snapshot || null,
        });
      }
    }

    // 2) 同名候选档案（含基础资料，供与来源成绩比对）
    const candidatesByNorm = new Map<string, Candidate[]>();
    const candidateIds: number[] = [];
    if (norms.length) {
      const placeholders = norms.map(() => '?').join(',');
      const [candRows] = await pool.execute<RowDataPacket[]>(
        `SELECT a.athlete_id, a.name, a.status,
                a.gender, a.nationality, a.province, a.city, a.bio, a.photo, a.created_at,
                LOWER(REPLACE(TRIM(a.name), ' ', '')) AS norm,
                EXISTS(SELECT 1 FROM sup_athlete_profile_owners o
                       WHERE o.athlete_id = a.athlete_id AND o.status = 'active' AND o.role = 'owner') AS is_claimed,
                (SELECT COUNT(*) FROM sup_event_results er WHERE er.athlete_id = a.athlete_id) AS result_count
           FROM sup_athletes a
          WHERE LOWER(REPLACE(TRIM(a.name), ' ', '')) IN (${placeholders})
          ORDER BY CASE a.status WHEN 'published' THEN 0 ELSE 1 END, a.athlete_id ASC`,
        norms
      );
      for (const c of candRows as RowDataPacket[]) {
        const k = String(c.norm || '');
        if (!candidatesByNorm.has(k)) candidatesByNorm.set(k, []);
        const aid = Number(c.athlete_id);
        candidateIds.push(aid);
        candidatesByNorm.get(k)!.push({
          athlete_id: aid,
          name: c.name || '',
          status: c.status || '',
          is_claimed: Number(c.is_claimed) === 1,
          result_count: Number(c.result_count || 0),
          gender: c.gender || null,
          nationality: c.nationality || null,
          province: c.province || null,
          city: c.city || null,
          bio: c.bio ? String(c.bio).slice(0, 120) : null,
          photo: c.photo || null,
          created_at: c.created_at ? String(c.created_at) : null,
          recent_results: [],
        });
      }
    }

    // 3) 候选档案各自的近期历史成绩（一次 IN 查询，避免 N+1）
    if (candidateIds.length) {
      const placeholders = candidateIds.map(() => '?').join(',');
      const [resultRows] = await pool.execute<RowDataPacket[]>(
        `SELECT er.athlete_id, er.discipline, er.gender_group, er.rank_position,
                er.finish_time, er.result_status_code,
                e.name AS event_name, e.start_date
           FROM sup_event_results er
           INNER JOIN sup_events e ON e.event_id = er.event_id
          WHERE er.athlete_id IN (${placeholders})
          ORDER BY e.start_date DESC, er.result_id DESC`,
        candidateIds
      );
      const recentByAthlete = new Map<number, RecentResult[]>();
      for (const r of resultRows as RowDataPacket[]) {
        const aid = Number(r.athlete_id);
        if (!recentByAthlete.has(aid)) recentByAthlete.set(aid, []);
        const list = recentByAthlete.get(aid)!;
        if (list.length >= MAX_RECENT_PER_ATHLETE) continue;
        list.push({
          event_name: r.event_name || '',
          start_date: r.start_date ? String(r.start_date) : null,
          discipline: r.discipline || null,
          gender_group: r.gender_group || null,
          rank_position: r.rank_position != null ? Number(r.rank_position) : null,
          finish_time: r.finish_time || null,
          result_status_code: r.result_status_code || null,
        });
      }
      for (const list of candidatesByNorm.values()) {
        for (const cand of list) {
          cand.recent_results = recentByAthlete.get(cand.athlete_id) || [];
        }
      }
    }

    const withCandidates = (items as RowDataPacket[]).map((r) => ({
      ...r,
      candidates: candidatesByNorm.get(String(r.normalized_name || '')) || [],
      source_results: sourceByNorm.get(String(r.normalized_name || '')) || [],
    }));
    return NextResponse.json({ items: withCandidates });
  } catch (error) {
    console.error('获取运动员身份候选失败:', error);
    return NextResponse.json({ error: '获取运动员身份候选失败' }, { status: 500 });
  }
});
