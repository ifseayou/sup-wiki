import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { parseFinishTimeToSeconds, parseTeamMembersInput, syncAthleteRaceTimes } from '@/lib/event-results';
import { normalizeClubTeamName, syncClubTeamAliasesForEvent } from '@/lib/club-team-normalization';
import { getResultStatusLabel, normalizeResultStatusCode } from '@/lib/result-status';
import { resultDefaultOrderBy } from '@/lib/result-ordering';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

async function resolveAthleteId(connection: Awaited<ReturnType<typeof pool.getConnection>>, name: string, athleteId?: number | null) {
  if (athleteId) return athleteId;
  const cleanName = name.trim();
  if (!cleanName) return null;
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT athlete_id FROM sup_athletes WHERE name = ? ORDER BY CASE status WHEN "published" THEN 0 ELSE 1 END, athlete_id ASC LIMIT 1',
    [cleanName]
  );
  if (rows.length) return Number(rows[0].athlete_id);
  const [inserted] = await connection.execute<ResultSetHeader>(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由后台成绩明细手动创建的运动员草稿档案。', 'draft')`,
    [cleanName]
  );
  return inserted.insertId;
}

async function replaceMembers(connection: Awaited<ReturnType<typeof pool.getConnection>>, resultId: number, body: Record<string, unknown>, primaryAthleteId: number | null) {
  await connection.execute('DELETE FROM sup_event_result_members WHERE result_id = ?', [resultId]);
  const memberNames = parseTeamMembersInput(body.team_members);
  const touched = new Set<number>();
  for (let index = 0; index < memberNames.length; index += 1) {
    const memberName = memberNames[index];
    const athleteId = await resolveAthleteId(connection, memberName, memberName === body.athlete_name_snapshot ? primaryAthleteId : null);
    if (athleteId) touched.add(athleteId);
    await connection.execute(
      `INSERT INTO sup_event_result_members (result_id, athlete_id, member_name, member_order)
       VALUES (?, ?, ?, ?)`,
      [resultId, athleteId, memberName, index]
    );
  }
  return [...touched];
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const eventId = searchParams.get('event_id');
    const statusCode = searchParams.get('result_status_code')?.trim();
    const reviewStatus = searchParams.get('review_status')?.trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(er.athlete_name_snapshot LIKE ? OR e.name LIKE ? OR er.discipline LIKE ? OR er.team_name LIKE ?
        OR EXISTS (SELECT 1 FROM sup_event_result_members erm WHERE erm.result_id = er.result_id AND erm.member_name LIKE ?))`);
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (eventId) { conditions.push('er.event_id = ?'); params.push(Number(eventId)); }
    if (statusCode) { conditions.push('er.result_status_code = ?'); params.push(statusCode); }
    if (reviewStatus) { conditions.push('er.review_status = ?'); params.push(reviewStatus); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_event_results er INNER JOIN sup_events e ON e.event_id = er.event_id ${where}`,
      params
    );
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT er.*, e.name AS event_name, e.start_date, src.file_name AS source_file_name,
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('athlete_id', erm.athlete_id, 'name', erm.member_name, 'member_order', erm.member_order))
          FROM sup_event_result_members erm
          WHERE erm.result_id = er.result_id
        ) AS team_members
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       LEFT JOIN sup_event_result_sources src ON src.source_id = er.source_id
       ${where}
       ORDER BY ${resultDefaultOrderBy({ includeEventDate: true })}
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取成绩明细失败:', error);
    return NextResponse.json({ error: '获取成绩明细失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const eventId = numberOrNull(body.event_id);
    const athleteName = textOrNull(body.athlete_name_snapshot || body.athlete_name);
    const discipline = textOrNull(body.discipline);
    const finishTime = textOrNull(body.finish_time);
    const rankPosition = Number(body.rank_position);
    if (!eventId || !athleteName || !discipline || !finishTime || !Number.isFinite(rankPosition)) {
      return NextResponse.json({ error: '缺少赛事、运动员、项目、名次或成绩' }, { status: 400 });
    }
    await connection.beginTransaction();
    const athleteId = await resolveAthleteId(connection, athleteName, numberOrNull(body.athlete_id));
    const statusCode = normalizeResultStatusCode(body.result_status_code || finishTime);
    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO sup_event_results (
        event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
        rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name, team_name_normalized,
        nationality_snapshot, source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence,
        review_status, is_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId, athleteId, athleteName, textOrNull(body.bib_number), textOrNull(body.gender_group) || '公开组',
        discipline, textOrNull(body.board_class), textOrNull(body.round_label), rankPosition, textOrNull(body.result_label),
        finishTime, statusCode, textOrNull(body.result_status_note) || (statusCode ? getResultStatusLabel(statusCode) : null),
        parseFinishTimeToSeconds(finishTime), body.points === '' || body.points == null ? null : Number(body.points),
        textOrNull(body.team_name) || '个人', normalizeClubTeamName(textOrNull(body.team_name) || '个人') || null, textOrNull(body.nationality_snapshot), textOrNull(body.source_type) || 'official',
        numberOrNull(body.source_id), textOrNull(body.source_title), textOrNull(body.source_locator), textOrNull(body.source_url),
        textOrNull(body.source_note), body.parse_confidence == null ? 1 : Number(body.parse_confidence),
        textOrNull(body.review_status) || 'confirmed', body.is_verified === false ? 0 : 1,
      ]
    );
    const touched = new Set<number>(athleteId ? [athleteId] : []);
    for (const id of await replaceMembers(connection, inserted.insertId, { ...body, athlete_name_snapshot: athleteName }, athleteId)) touched.add(id);
    await syncClubTeamAliasesForEvent(connection, eventId);
    for (const id of touched) await syncAthleteRaceTimes(connection, id);
    await connection.commit();
    return NextResponse.json({ success: true, result_id: inserted.insertId }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error('创建成绩明细失败:', error);
    return NextResponse.json({ error: '创建成绩明细失败' }, { status: 500 });
  } finally {
    connection.release();
  }
});
