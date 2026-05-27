import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import { slugifyClubName } from '@/lib/club-team-normalization';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function getId(request: NextRequest) {
  return Number(new URL(request.url).pathname.split('/').at(-1));
}

async function uniqueSlug(conn: Awaited<ReturnType<typeof pool.getConnection>>, name: string, id: number) {
  const base = slugifyClubName(name, `team-${id}`);
  for (let index = 0; index < 20; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const [rows] = await conn.execute<RowDataPacket[]>('SELECT club_id FROM sup_clubs WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) return slug;
  }
  return `${base}-${Date.now()}`;
}

export const PATCH = withAdmin(async (request: NextRequest) => {
  const aliasId = getId(request);
  if (!Number.isInteger(aliasId) || aliasId <= 0) {
    return NextResponse.json({ error: '无效队伍别名 ID' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const adminNote = String(body.admin_note || '').trim().slice(0, 500) || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>('SELECT * FROM sup_club_team_aliases WHERE alias_id = ? FOR UPDATE', [aliasId]);
    const alias = rows[0];
    if (!alias) {
      await conn.rollback();
      return NextResponse.json({ error: '队伍别名不存在' }, { status: 404 });
    }

    let clubId = body.club_id ? Number(body.club_id) : null;
    if (action === 'create_club') {
      const name = String(body.club_name || alias.team_name_raw || '').trim();
      if (!name) {
        await conn.rollback();
        return NextResponse.json({ error: '请填写俱乐部名称' }, { status: 400 });
      }
      const slug = await uniqueSlug(conn, name, aliasId);
      const [insert] = await conn.execute<ResultSetHeader>(
        `INSERT INTO sup_clubs (slug, name, intro, claim_status, verification_status, source_type, source_note, status)
         VALUES (?, ?, '由赛事成绩队伍名生成的待认领俱乐部，资料待完善。', 'unclaimed', 'unverified', 'event_result_team', ?, 'published')`,
        [slug, name, `club_team_alias:${aliasId}`]
      );
      clubId = insert.insertId;
    }

    if (action === 'bind' || action === 'create_club') {
      if (!clubId || !Number.isInteger(clubId)) {
        await conn.rollback();
        return NextResponse.json({ error: '请选择要绑定的俱乐部' }, { status: 400 });
      }
      await conn.execute(
        `UPDATE sup_club_team_aliases
         SET club_id = ?, match_status = 'confirmed', confidence = 1.000, admin_note = ?, reviewed_at = NOW()
         WHERE alias_id = ?`,
        [clubId, adminNote, aliasId]
      );
    } else if (action === 'ignore' || action === 'reject') {
      await conn.execute(
        `UPDATE sup_club_team_aliases
         SET club_id = NULL, match_status = ?, admin_note = ?, reviewed_at = NOW()
         WHERE alias_id = ?`,
        [action === 'ignore' ? 'ignored' : 'rejected', adminNote, aliasId]
      );
    } else {
      await conn.rollback();
      return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    await conn.commit();
    return NextResponse.json({ success: true, club_id: clubId || null });
  } catch (error) {
    await conn.rollback();
    console.error('处理队伍别名失败:', error);
    return NextResponse.json({ error: '处理队伍别名失败' }, { status: 500 });
  } finally {
    conn.release();
  }
});
