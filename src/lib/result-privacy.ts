import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { getUserFromRequest } from '@/lib/user-auth';
import { hiddenAthleteName, maskAthleteName } from '@/lib/name-mask';
import { normalizeNationality } from '@/lib/nationality';
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
         AND ${privacyStatusCondition('pr')}
       ORDER BY pr.created_at ASC, pr.request_id ASC`,
      [targetType, ...cleanIds]
    );
    for (const row of rows) {
      const id = Number(row.target_id || (targetType === 'athlete' ? row.athlete_id : row.result_id));
      if (!id) continue;
      const current = map.get(id) || { hidden: false, anonymized: false, deleted: false };
      const type = String(row.request_type || '');
      if (type === 'restore_frontend') {
        map.set(id, { hidden: false, anonymized: false, deleted: false });
        continue;
      }
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

export function isForeignAthleteIdentity(row: Record<string, unknown>) {
  const nationality = [
    row.athlete_nationality,
    row.nationality,
    row.nationality_snapshot,
    row.display_nationality,
  ].map(normalizeNationality).find(Boolean);
  if (nationality && nationality !== '中国') return true;

  const pointScope = String(row.point_scope || row.source_scope || row.event_source_scope || '').trim().toLowerCase();
  return pointScope === 'international' || pointScope === 'global' || pointScope === 'world';
}

function hideResultName<T extends Record<string, unknown>>(row: T, label: string): T {
  const members = Array.isArray(row.team_members)
    ? row.team_members.map((member) => {
        const item = member as Record<string, unknown>;
        const name = label === hiddenAthleteName()
          ? label
          : maskAthleteName(item.name || item.member_name || row.athlete_name || row.athlete_name_snapshot);
        return { ...item, name, member_name: name };
      })
    : row.team_members;
  return {
    ...row,
    athlete_name: label,
    athlete_name_snapshot: label,
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
      return !(resultState?.deleted || athleteState?.deleted);
    })
    .map((row) => {
      const athleteId = Number(row.athlete_id);
      const owners = ownerMap.get(athleteId) || [];
      const isInternational = isInternationalResult(row);
      const isForeignAthlete = isForeignAthleteIdentity(row);
      const isPublicForeignResult = isInternational || isForeignAthlete;
      const isMyAthlete = ownedAthleteIds.has(athleteId);
      const athleteIsClaimed = isPublicForeignResult || owners.length > 0;
      const viewerHasOwnedAthlete = ownedAthleteIds.size > 0;
      const resultState = resultPrivacy.get(Number(row.result_id || row.id));
      const athleteState = athletePrivacy.get(athleteId);
      const privacy = resultState?.anonymized ? resultState : athleteState;
      const shouldHideByPrivacy = !isPublicForeignResult && !isMyAthlete && Boolean(privacy?.hidden || privacy?.anonymized);
      const shouldMaskUnclaimed = !isPublicForeignResult && !athleteIsClaimed;
      const displayLabel = shouldHideByPrivacy
        ? hiddenAthleteName()
        : shouldMaskUnclaimed
          ? maskAthleteName(row.athlete_name || row.athlete_name_snapshot)
          : '';
      const masked = displayLabel ? hideResultName(row, displayLabel) : row;
      const privacyActions = isPublicForeignResult
        ? []
        : isMyAthlete
          ? ['anonymize_name']
          : !shouldHideByPrivacy && !viewerHasOwnedAthlete && !athleteIsClaimed
            ? ['claim']
            : [];
      return {
        ...masked,
        athlete_is_claimed: athleteIsClaimed,
        is_international_result: isInternational,
        is_foreign_athlete: isForeignAthlete,
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

export async function maskAthleteIdentityRows<T extends Record<string, unknown>>(rows: T[]) {
  const athletePrivacy = await buildPrivacyMap('athlete', rows.map((row) => Number(row.athlete_id)));
  const ownerMap = await buildAthleteOwnerMap(rows.map((row) => Number(row.athlete_id)));

  return rows
    .filter((row) => !athletePrivacy.get(Number(row.athlete_id))?.deleted)
    .map((row) => {
      const athleteId = Number(row.athlete_id);
      const privacy = athletePrivacy.get(athleteId);
      const hasOwner = (ownerMap.get(athleteId) || []).length > 0;
      const isForeignAthlete = isForeignAthleteIdentity(row);
      const hiddenByPrivacy = !isForeignAthlete && Boolean(privacy?.hidden || privacy?.anonymized);
      if (!hiddenByPrivacy && hasOwner) {
        return {
          ...row,
          athlete_is_claimed: true,
          is_foreign_athlete: isForeignAthlete,
        };
      }
      if (isForeignAthlete) {
        return {
          ...row,
          athlete_is_claimed: true,
          is_foreign_athlete: true,
        };
      }
      const label = hiddenByPrivacy
        ? hiddenAthleteName()
        : maskAthleteName(row.athlete_name || row.athlete_name_snapshot);
      return {
        ...row,
        athlete_name: label,
        athlete_name_snapshot: label,
        athlete_photo: '',
        athlete_is_claimed: false,
      };
    });
}
