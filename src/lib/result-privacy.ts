import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { getUserFromRequest } from '@/lib/user-auth';
import type { RowDataPacket } from 'mysql2';

const PRIVACY_HIDE_TYPES = new Set(['hide_athlete', 'delete_frontend']);
const PRIVACY_ANON_TYPES = new Set(['anonymize_name']);

export type PrivacyState = {
  hidden: boolean;
  anonymized: boolean;
  deleted: boolean;
};

export function privacyStatusCondition(alias = 'pr') {
  return `(${alias}.status IN ('approved', 'completed') OR (${alias}.request_type = 'hide_athlete' AND ${alias}.status = 'pending'))`;
}

export function athleteOwnerCondition(alias = 'o') {
  return `${alias}.status = 'active' AND ${alias}.role = 'owner'`;
}

export async function buildPrivacyMap(targetType: 'athlete' | 'result', ids: Array<number | null | undefined>) {
  const cleanIds = Array.from(new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  const map = new Map<number, PrivacyState>();
  if (!cleanIds.length) return map;
  const placeholders = cleanIds.map(() => '?').join(',');
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT request_type, target_id, athlete_id, result_id
       FROM sup_privacy_requests pr
       WHERE pr.target_type = ?
         AND pr.target_id IN (${placeholders})
         AND ${privacyStatusCondition('pr')}`,
      [targetType, ...cleanIds]
    );
    for (const row of rows) {
      const id = Number(row.target_id || (targetType === 'athlete' ? row.athlete_id : row.result_id));
      if (!id) continue;
      const current = map.get(id) || { hidden: false, anonymized: false, deleted: false };
      const type = String(row.request_type || '');
      current.hidden = current.hidden || PRIVACY_HIDE_TYPES.has(type);
      current.deleted = current.deleted || type === 'delete_frontend';
      current.anonymized = current.anonymized || PRIVACY_ANON_TYPES.has(type);
      map.set(id, current);
    }
  } catch {
    return map;
  }
  return map;
}

export async function buildAthleteOwnerMap(athleteIds: Array<number | null | undefined>) {
  const cleanIds = Array.from(new Set(athleteIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  const map = new Map<number, number[]>();
  if (!cleanIds.length) return map;
  const placeholders = cleanIds.map(() => '?').join(',');
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT athlete_id, user_id
       FROM sup_athlete_profile_owners o
       WHERE o.athlete_id IN (${placeholders}) AND ${athleteOwnerCondition('o')}`,
      cleanIds
    );
    for (const row of rows) {
      const athleteId = Number(row.athlete_id);
      if (!athleteId) continue;
      const owners = map.get(athleteId) || [];
      owners.push(Number(row.user_id));
      map.set(athleteId, owners);
    }
  } catch {
    return map;
  }
  return map;
}

export async function getViewerOwnedAthleteIds(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return { userId: null, ownedAthleteIds: new Set<number>() };
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT athlete_id
       FROM sup_athlete_profile_owners o
       WHERE o.user_id = ? AND ${athleteOwnerCondition('o')}`,
      [user.user_id]
    );
    return {
      userId: user.user_id,
      ownedAthleteIds: new Set(rows.map((row) => Number(row.athlete_id)).filter(Boolean)),
    };
  } catch {
    return { userId: user.user_id, ownedAthleteIds: new Set<number>() };
  }
}

export function isInternationalResult(row: Record<string, unknown>) {
  const scope = String(row.source_scope || row.event_source_scope || '').trim().toLowerCase();
  if (scope === 'international' || scope === 'global' || scope === 'world') return true;
  const text = [
    row.event_name,
    row.event_name_en,
    row.source_title,
    row.source_file_name,
    row.source_file_url,
    row.source_url,
    row.province,
    row.city,
  ].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
  return /(ICF|ISA|APP|World|EuroTour|世界|国际|亚洲杯|亚锦赛|海外|国外)/i.test(text);
}

function hideResultName<T extends Record<string, unknown>>(row: T): T {
  const members = Array.isArray(row.team_members)
    ? row.team_members.map((member) => ({ ...(member as Record<string, unknown>), name: '已隐藏选手', member_name: '已隐藏选手' }))
    : row.team_members;
  return {
    ...row,
    athlete_name: '已隐藏选手',
    athlete_name_snapshot: '已隐藏选手',
    athlete_photo: '',
    team_members: members,
  };
}

export async function filterAndMaskRaceResults<T extends Record<string, unknown>>(
  rows: T[],
  viewer: { ownedAthleteIds?: Set<number> } = {}
) {
  const resultPrivacy = await buildPrivacyMap('result', rows.map((row) => Number(row.result_id || row.id)));
  const athletePrivacy = await buildPrivacyMap('athlete', rows.map((row) => Number(row.athlete_id)));
  const ownerMap = await buildAthleteOwnerMap(rows.map((row) => Number(row.athlete_id)));
  const ownedAthleteIds = viewer.ownedAthleteIds || new Set<number>();

  return rows
    .filter((row) => {
      const resultState = resultPrivacy.get(Number(row.result_id || row.id));
      const athleteState = athletePrivacy.get(Number(row.athlete_id));
      return !(resultState && (resultState.hidden || resultState.deleted)) && !(athleteState && (athleteState.hidden || athleteState.deleted));
    })
    .map((row) => {
      const athleteId = Number(row.athlete_id);
      const owners = ownerMap.get(athleteId) || [];
      const isInternational = isInternationalResult(row);
      const isMyAthlete = ownedAthleteIds.has(athleteId);
      const athleteIsClaimed = isInternational || owners.length > 0;
      const viewerHasOwnedAthlete = ownedAthleteIds.size > 0;
      const resultState = resultPrivacy.get(Number(row.result_id || row.id));
      const athleteState = athletePrivacy.get(athleteId);
      const privacy = resultState?.anonymized ? resultState : athleteState;
      const shouldAnonymize = !isInternational && Boolean(privacy?.anonymized || !athleteIsClaimed);
      const masked = shouldAnonymize ? hideResultName(row) : row;
      const privacyActions = isInternational
        ? []
        : isMyAthlete
          ? ['anonymize_name']
          : !viewerHasOwnedAthlete && !athleteIsClaimed
            ? ['claim', 'correction', 'anonymize_name']
            : [];
      return {
        ...masked,
        athlete_is_claimed: athleteIsClaimed,
        is_international_result: isInternational,
        is_my_athlete: isMyAthlete,
        viewer_has_owned_athlete: viewerHasOwnedAthlete,
        privacy_actions: privacyActions,
      };
    });
}

export async function getAthletePrivacyState(athleteId: number) {
  const privacyMap = await buildPrivacyMap('athlete', [athleteId]);
  const ownerMap = await buildAthleteOwnerMap([athleteId]);
  return {
    privacy: privacyMap.get(athleteId) || { hidden: false, anonymized: false, deleted: false },
    hasOwner: (ownerMap.get(athleteId) || []).length > 0,
  };
}
