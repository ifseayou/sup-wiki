import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { getUserFromRequest } from '@/lib/user-auth';
import { isIAddUUser, normalizeUserLevel } from '@/lib/user-levels';
import { hiddenAthleteName, maskAthleteName } from '@/lib/name-mask';
import { normalizeNationality } from '@/lib/nationality';
import type { RowDataPacket } from 'mysql2';

const PRIVACY_HIDE_TYPES = new Set(['hide_athlete', 'delete_frontend', 'admin_blacklist']);
const PRIVACY_ANON_TYPES = new Set(['anonymize_name']);
const PRIVACY_RESULTS_HIDE_TYPES = new Set(['hide_results_points']);
const HIDDEN_RESULT_NOTICE = '该运动员已选择隐藏成绩&积分';

export type PrivacyState = {
  hidden: boolean;
  anonymized: boolean;
  deleted: boolean;
  resultsHidden: boolean;
  blacklisted?: boolean;
};

export function privacyStatusCondition(alias = 'pr') {
  return `${alias}.status IN ('approved', 'completed')`;
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
      const current = map.get(id) || { hidden: false, anonymized: false, deleted: false, resultsHidden: false, blacklisted: false };
      const type = String(row.request_type || '');
      if (type === 'admin_blacklist') {
        // 管理员黑名单：sticky 隐藏，restore 不可解除（应本人删除要求）
        map.set(id, { ...current, blacklisted: true, hidden: true });
        continue;
      }
      if (type === 'restore_frontend') {
        map.set(id, { ...current, hidden: Boolean(current.blacklisted), anonymized: false, deleted: false });
        continue;
      }
      if (type === 'restore_results_points') {
        map.set(id, { ...current, resultsHidden: false });
        continue;
      }
      current.hidden = current.hidden || PRIVACY_HIDE_TYPES.has(type);
      current.deleted = current.deleted || type === 'delete_frontend';
      current.anonymized = current.anonymized || PRIVACY_ANON_TYPES.has(type);
      current.resultsHidden = current.resultsHidden || PRIVACY_RESULTS_HIDE_TYPES.has(type);
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
  if (!user) return { userId: null, ownedAthleteIds: new Set<number>(), canViewAll: false };
  // 是否被授予「查询全部成绩」权限（admin / i_add_u / can_view_all_results）——决定是否对未认领国内选手解除脱敏。
  let canViewAll = false;
  try {
    const [userRows] = await pool.execute<RowDataPacket[]>(
      `SELECT nickname, email, openid, user_level, can_view_all_results
       FROM sup_users WHERE user_id = ? LIMIT 1`,
      [user.user_id]
    );
    const u = userRows[0];
    canViewAll = Boolean(u) && (
      normalizeUserLevel(u.user_level) === 'admin'
      || Number(u.can_view_all_results) === 1
      || isIAddUUser({ nickname: u.nickname, email: u.email, openid: u.openid })
    );
  } catch {
    canViewAll = false;
  }
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
      canViewAll,
    };
  } catch {
    return { userId: user.user_id, ownedAthleteIds: new Set<number>(), canViewAll };
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

const TEAM_DISCIPLINE_REGEX = /龙板|dragon|团体|团队|接力|双人|四人|多人|relay/i;

// 团体/多人成绩判定（龙板、双人、四人、接力、团体等）——无法被认领，不脱敏、不可进详情。
// 与 BFF server/lib/sup-result-utils.js isTeamResultItem 同口径。
export function isTeamResult(row: Record<string, unknown>) {
  if (row.entry_type === 'team' || row.is_team === true) return true;
  if (row.entry_type === 'individual') return false;
  const members = Array.isArray(row.team_members) ? row.team_members : [];
  if (members.length >= 2) return true;
  const text = [row.discipline, row.gender_group, row.round_label, row.team_name]
    .map((v) => String(v || '').trim()).filter(Boolean).join(' ');
  return TEAM_DISCIPLINE_REGEX.test(text);
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

function hiddenCell() {
  return '隐藏';
}

function hideRaceResultDetails<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    bib_number: hiddenCell(),
    rank_position: null,
    result_label: hiddenCell(),
    finish_time: hiddenCell(),
    result_status_code: null,
    result_status_note: null,
    time_seconds: null,
    points: null,
    gap_display: hiddenCell(),
    pace_display: hiddenCell(),
    source_title: hiddenCell(),
    source_url: '',
    source_locator: null,
    source_note: null,
    results_points_hidden: true,
    privacy_notice: HIDDEN_RESULT_NOTICE,
  };
}

function hidePointStandingDetails<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    bib_number: hiddenCell(),
    year: hiddenCell(),
    rank_position: null,
    status_rank: hiddenCell(),
    total_points: hiddenCell(),
    endurance_rank: hiddenCell(),
    endurance_points: hiddenCell(),
    sprint_rank: hiddenCell(),
    sprint_points: hiddenCell(),
    technical_rank: hiddenCell(),
    technical_points: hiddenCell(),
    results_points_hidden: true,
    privacy_notice: HIDDEN_RESULT_NOTICE,
  };
}

export async function filterAndMaskRaceResults<T extends Record<string, unknown>>(
  rows: T[],
  viewer: { ownedAthleteIds?: Set<number>; canViewAll?: boolean } = {}
) {
  const resultPrivacy = await buildPrivacyMap('result', rows.map((row) => Number(row.result_id || row.id)));
  const athletePrivacy = await buildPrivacyMap('athlete', rows.map((row) => Number(row.athlete_id)));
  const ownerMap = await buildAthleteOwnerMap(rows.map((row) => Number(row.athlete_id)));
  const ownedAthleteIds = viewer.ownedAthleteIds || new Set<number>();
  const canViewAll = Boolean(viewer.canViewAll);

  return rows
    .filter((row) => {
      const resultState = resultPrivacy.get(Number(row.result_id || row.id));
      const athleteState = athletePrivacy.get(Number(row.athlete_id));
      return !(resultState?.deleted || athleteState?.deleted);
    })
    .map((row) => {
      const athleteId = Number(row.athlete_id);
      const owners = ownerMap.get(athleteId) || [];
      const isTeam = isTeamResult(row);
      const isInternational = isInternationalResult(row);
      const isForeignAthlete = isForeignAthleteIdentity(row);
      // 隐私/脱敏只按「选手是否外籍」判定，不再因赛事名含「国际/亚洲杯/世界」就整场公开。
      // 国内(中国)未认领选手即使在国际命名赛事(亚洲杯/世锦赛/亚锦赛)也脱敏，仅外籍/已认领/本人显示全名。
      const isPublicForeignResult = isForeignAthlete;
      const isMyAthlete = ownedAthleteIds.has(athleteId);
      const athleteIsClaimed = isPublicForeignResult || owners.length > 0;
      const viewerHasOwnedAthlete = ownedAthleteIds.size > 0;
      const resultState = resultPrivacy.get(Number(row.result_id || row.id));
      const athleteState = athletePrivacy.get(athleteId);
      const shouldHideByPrivacy = !isPublicForeignResult && !isMyAthlete && Boolean(
        resultState?.hidden || resultState?.anonymized || athleteState?.hidden || athleteState?.anonymized
      );
      const shouldHideResults = !isPublicForeignResult && !isMyAthlete && Boolean(resultState?.resultsHidden || athleteState?.resultsHidden);
      // 团体（非单人）成绩无法被认领：不脱敏、全名直出。授权用户（admin / can_view_all_results）同样不打码。
      const shouldMaskUnclaimed = !isTeam && !canViewAll && !isPublicForeignResult && !athleteIsClaimed;
      const displayLabel = shouldHideByPrivacy
        ? hiddenAthleteName()
        : shouldMaskUnclaimed
          ? maskAthleteName(row.athlete_name || row.athlete_name_snapshot)
          : '';
      const identityMasked = displayLabel ? hideResultName(row, displayLabel) : row;
      const masked = shouldHideResults ? hideRaceResultDetails(identityMasked) : identityMasked;
      // 团体成绩：无认领入口
      const privacyActions = isTeam
        ? []
        : isPublicForeignResult
        ? []
        : isMyAthlete
          ? [athleteState?.resultsHidden ? 'restore_results_points' : 'hide_results_points']
          : !shouldHideByPrivacy && !viewerHasOwnedAthlete && !athleteIsClaimed
            ? ['claim']
            : [];
      return {
        ...masked,
        // 团体成绩不可进入运动员详情
        no_detail: isTeam ? true : (masked as Record<string, unknown>).no_detail,
        is_team: isTeam,
        athlete_is_claimed: isTeam ? true : athleteIsClaimed,
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
    privacy: privacyMap.get(athleteId) || { hidden: false, anonymized: false, deleted: false, resultsHidden: false },
    hasOwner: (ownerMap.get(athleteId) || []).length > 0,
  };
}

export async function maskAthleteIdentityRows<T extends Record<string, unknown>>(
  rows: T[],
  viewer: { ownedAthleteIds?: Set<number>; canViewAll?: boolean } = {}
) {
  const athletePrivacy = await buildPrivacyMap('athlete', rows.map((row) => Number(row.athlete_id)));
  const ownerMap = await buildAthleteOwnerMap(rows.map((row) => Number(row.athlete_id)));
  const ownedAthleteIds = viewer.ownedAthleteIds || new Set<number>();
  const canViewAll = Boolean(viewer.canViewAll);

  return rows
    .filter((row) => !athletePrivacy.get(Number(row.athlete_id))?.deleted)
    .map((row) => {
      const athleteId = Number(row.athlete_id);
      const privacy = athletePrivacy.get(athleteId);
      const hasOwner = (ownerMap.get(athleteId) || []).length > 0;
      const isForeignAthlete = isForeignAthleteIdentity(row);
      const isMyAthlete = ownedAthleteIds.has(athleteId);
      const hiddenByPrivacy = !isForeignAthlete && !isMyAthlete && Boolean(privacy?.hidden || privacy?.anonymized);
      const hiddenResults = !isForeignAthlete && !isMyAthlete && Boolean(privacy?.resultsHidden);
      const identityRow = hiddenByPrivacy
        ? {
            ...row,
            athlete_name: hiddenAthleteName(),
            athlete_name_snapshot: hiddenAthleteName(),
            athlete_photo: '',
            athlete_is_claimed: false,
          }
        : row;
      if (hiddenResults) return hidePointStandingDetails(identityRow);
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
      // 授权用户（admin / can_view_all_results）：未认领国内选手也显示全名（隐私隐藏已在上方处理）
      if (canViewAll) {
        return {
          ...row,
          athlete_is_claimed: false,
          is_foreign_athlete: isForeignAthlete,
        };
      }
      const label = maskAthleteName(row.athlete_name || row.athlete_name_snapshot);
      return {
        ...row,
        athlete_name: label,
        athlete_name_snapshot: label,
        athlete_photo: '',
        athlete_is_claimed: false,
      };
    });
}
