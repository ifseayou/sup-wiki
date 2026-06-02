import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { parseFinishTimeToSeconds, parseTeamMembersInput, syncAthleteRaceTimes } from '@/lib/event-results';
import { normalizeClubTeamName, syncClubTeamAliasesForEvent } from '@/lib/club-team-normalization';
import { getResultStatusLabel, normalizeResultStatusCode } from '@/lib/result-status';
import { normalizeNationality } from '@/lib/nationality';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function idFromRequest(request: NextRequest) {
  return Number(new URL(request.url).pathname.split('/').at(-1));
}

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
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT athlete_id FROM sup_athletes WHERE name = ? ORDER BY CASE status WHEN "published" THEN 0 ELSE 1 END, athlete_id ASC LIMIT 1',
    [name]
  );
  if (rows.length) return Number(rows[0].athlete_id);
  const [inserted] = await connection.execute<ResultSetHeader>(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, '中国', 'race', '由后台成绩明细手动创建的运动员草稿档案。', 'draft')`,
    [name]
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

export const PUT = withAdmin(async (request: NextRequest) => {
  const connection = await pool.getConnection();
  try {
    const id = idFromRequest(request);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '无效成绩 ID' }, { status: 400 });
    const body = await request.json();
    const athleteName = textOrNull(body.athlete_name_snapshot || body.athlete_name);
    const discipline = textOrNull(body.discipline);
    const finishTime = textOrNull(body.finish_time);
    const rankPosition = Number(body.rank_position);
    if (!athleteName || !discipline || !finishTime || !Number.isFinite(rankPosition)) {
      return NextResponse.json({ error: '缺少运动员、项目、名次或成绩' }, { status: 400 });
    }

    await connection.beginTransaction();
    const [beforeRows] = await connection.execute<RowDataPacket[]>(
      `SELECT athlete_id, event_id FROM sup_event_results WHERE result_id = ?
       UNION SELECT athlete_id, NULL AS event_id FROM sup_event_result_members WHERE result_id = ? AND athlete_id IS NOT NULL`,
      [id, id]
    );
    const touched = new Set<number>(beforeRows.map((row) => Number(row.athlete_id)).filter(Number.isFinite));
    const athleteId = await resolveAthleteId(connection, athleteName, numberOrNull(body.athlete_id));
    if (athleteId) touched.add(athleteId);
    const statusCode = normalizeResultStatusCode(body.result_status_code || finishTime);
    const normalizedNationality = normalizeNationality(body.nationality_snapshot);
    const [updated] = await connection.execute<ResultSetHeader>(
      `UPDATE sup_event_results SET
        event_id = COALESCE(?, event_id),
        athlete_id = ?,
        athlete_name_snapshot = ?,
        bib_number = ?,
        gender_group = ?,
        discipline = ?,
        board_class = ?,
        round_label = ?,
        rank_position = ?,
        result_label = ?,
        finish_time = ?,
        result_status_code = ?,
        result_status_note = ?,
        time_seconds = ?,
        points = ?,
        team_name = ?,
        team_name_normalized = ?,
        nationality_snapshot = ?,
        source_type = ?,
        source_id = ?,
        source_title = ?,
        source_locator = ?,
        source_url = ?,
        source_note = ?,
        parse_confidence = ?,
        review_status = ?,
        is_verified = ?
       WHERE result_id = ?`,
      [
        numberOrNull(body.event_id), athleteId, athleteName, textOrNull(body.bib_number), textOrNull(body.gender_group) || '公开组',
        discipline, textOrNull(body.board_class), textOrNull(body.round_label), rankPosition, textOrNull(body.result_label),
        finishTime, statusCode, textOrNull(body.result_status_note) || (statusCode ? getResultStatusLabel(statusCode) : null),
        parseFinishTimeToSeconds(finishTime), body.points === '' || body.points == null ? null : Number(body.points),
        textOrNull(body.team_name) || '个人', normalizeClubTeamName(textOrNull(body.team_name) || '个人') || null, normalizedNationality, textOrNull(body.source_type) || 'official',
        numberOrNull(body.source_id), textOrNull(body.source_title), textOrNull(body.source_locator), textOrNull(body.source_url),
        textOrNull(body.source_note), body.parse_confidence == null ? 1 : Number(body.parse_confidence),
        textOrNull(body.review_status) || 'confirmed', body.is_verified === false ? 0 : 1, id,
      ]
    );
    if (updated.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json({ error: '成绩不存在' }, { status: 404 });
    }
    for (const memberId of await replaceMembers(connection, id, { ...body, athlete_name_snapshot: athleteName }, athleteId)) touched.add(memberId);
    const targetEventId = numberOrNull(body.event_id) || Number(beforeRows[0]?.event_id || 0);
    if (targetEventId) await syncClubTeamAliasesForEvent(connection, targetEventId);
    for (const athleteIdItem of touched) await syncAthleteRaceTimes(connection, athleteIdItem);
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('更新成绩明细失败:', error);
    return NextResponse.json({ error: '更新成绩明细失败' }, { status: 500 });
  } finally {
    connection.release();
  }
});

export const DELETE = withAdmin(async (request: NextRequest) => {
  const connection = await pool.getConnection();
  try {
    const id = idFromRequest(request);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '无效成绩 ID' }, { status: 400 });
    await connection.beginTransaction();
    const [athleteRows] = await connection.execute<RowDataPacket[]>(
      `SELECT athlete_id FROM sup_event_results WHERE result_id = ? AND athlete_id IS NOT NULL
       UNION SELECT athlete_id FROM sup_event_result_members WHERE result_id = ? AND athlete_id IS NOT NULL`,
      [id, id]
    );
    const [deleted] = await connection.execute<ResultSetHeader>('DELETE FROM sup_event_results WHERE result_id = ?', [id]);
    if (deleted.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json({ error: '成绩不存在' }, { status: 404 });
    }
    for (const row of athleteRows) await syncAthleteRaceTimes(connection, Number(row.athlete_id));
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('删除成绩明细失败:', error);
    return NextResponse.json({ error: '删除成绩明细失败' }, { status: 500 });
  } finally {
    connection.release();
  }
});
