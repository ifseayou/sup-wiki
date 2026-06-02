import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserFromRequest } from '@/lib/user-auth';
import { buildPrivacyMap } from '@/lib/result-privacy';
import type { RowDataPacket } from 'mysql2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const athleteId = Number(id);
    if (!Number.isInteger(athleteId) || athleteId <= 0) {
      return NextResponse.json({ error: '无效运动员 ID' }, { status: 400 });
    }

    const user = getUserFromRequest(request);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id
       FROM sup_athlete_profile_owners
       WHERE athlete_id = ? AND status = 'active' AND role = 'owner'
       LIMIT 20`,
      [athleteId]
    );
    const ownerIds = rows.map((row) => Number(row.user_id));
    const privacy = (await buildPrivacyMap('athlete', [athleteId])).get(athleteId);
    const privacyMode = privacy?.deleted ? 'deleted' : privacy?.hidden ? 'hidden' : privacy?.anonymized ? 'anonymous' : ownerIds.length > 0 ? 'claimed' : 'minimal';
    const isOwner = !!user && ownerIds.includes(user.user_id);

    return NextResponse.json({
      has_owner: ownerIds.length > 0,
      is_owner: isOwner,
      can_manage_privacy: isOwner,
      privacy_mode: privacyMode,
      privacy_actions: isOwner
        ? ['correction', 'hide_athlete', 'anonymize_name', 'delete_frontend']
        : ownerIds.length > 0
          ? []
          : ['claim', 'correction', 'anonymize_name'],
    });
  } catch (error) {
    console.error('获取运动员认领状态失败:', error);
    return NextResponse.json({ error: '获取运动员认领状态失败' }, { status: 500 });
  }
}
