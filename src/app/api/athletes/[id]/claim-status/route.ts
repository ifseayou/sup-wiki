import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserFromRequest } from '@/lib/user-auth';
import { buildPrivacyMap, athleteOwnerCondition } from '@/lib/result-privacy';
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
       WHERE athlete_id = ? AND ${athleteOwnerCondition('sup_athlete_profile_owners')}
       LIMIT 20`,
      [athleteId]
    );
    const ownerIds = rows.map((row) => Number(row.user_id));
    let ownedAthleteId: number | null = null;
    if (user) {
      const [ownedRows] = await pool.execute<RowDataPacket[]>(
        `SELECT athlete_id
         FROM sup_athlete_profile_owners
         WHERE user_id = ? AND ${athleteOwnerCondition('sup_athlete_profile_owners')}
         ORDER BY verified_at DESC, athlete_id DESC
         LIMIT 1`,
        [user.user_id]
      );
      ownedAthleteId = ownedRows[0] ? Number(ownedRows[0].athlete_id) : null;
    }
    const privacy = (await buildPrivacyMap('athlete', [athleteId])).get(athleteId);
    const privacyMode = privacy?.deleted ? 'deleted' : privacy?.hidden ? 'hidden' : privacy?.anonymized ? 'anonymous' : ownerIds.length > 0 ? 'claimed' : 'minimal';
    const isOwner = !!user && ownerIds.includes(user.user_id);
    const hasOwner = ownerIds.length > 0;
    const canClaim = Boolean(user && (!hasOwner || isOwner) && (!ownedAthleteId || ownedAthleteId === athleteId));
    const hiddenAndUnclaimed = !hasOwner && Boolean(privacy?.hidden || privacy?.anonymized);

    return NextResponse.json({
      has_owner: hasOwner,
      is_owner: isOwner,
      can_claim: canClaim,
      can_invite_claim: !hasOwner && !isOwner,
      can_manage_privacy: isOwner,
      owner_locked: hasOwner && !isOwner,
      viewer_has_owned_athlete: Boolean(ownedAthleteId),
      owned_athlete_id: ownedAthleteId ? String(ownedAthleteId) : '',
      privacy_mode: privacyMode,
      privacy_actions: isOwner
        ? ['hide_athlete', 'anonymize_name', 'delete_frontend']
        : hasOwner || hiddenAndUnclaimed
          ? []
          : [],
    });
  } catch (error) {
    console.error('获取运动员认领状态失败:', error);
    return NextResponse.json({ error: '获取运动员认领状态失败' }, { status: 500 });
  }
}
