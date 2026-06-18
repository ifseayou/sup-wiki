import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { getUserFromRequest, getActingUserId, isInternalGatewayRequest } from '@/lib/user-auth';
import { resolveResultQueryLimit, type UserLevel } from '@/lib/user-levels';
import type { RowDataPacket } from 'mysql2';

export const PUBLIC_RESULT_PREVIEW_LIMIT = 3;

type UserAccessRow = RowDataPacket & {
  user_id: number;
  user_level: string | null;
  status: string | null;
  daily_result_query_limit: number | null;
  can_view_all_results: number | null;
  nickname: string | null;
  email: string | null;
  openid: string | null;
};

export interface ResultAccess {
  authenticated: boolean;
  userId: number | null;
  level: UserLevel | 'guest';
  limit: number | null;
  used: number | null;
  remaining: number | null;
  previewLimit: number | null;
  /** 是否已绑定（认领）运动员资料——用于配额文案区分（已绑定可获更多次数）。 */
  bound: boolean;
}

/**
 * 配额用尽时的提示文案，与 BFF（sport_hacker shared.js searchQuotaMessage）口径一致：
 * 未绑定运动员的用户引导其绑定以获得更多次数，已绑定用户给通用文案。
 */
export function quotaExceededMessage(access: ResultAccess): string {
  if (access && access.bound === false && access.authenticated) {
    return '今日搜索次数已用完，绑定你的运动员资料可获得更多查询次数';
  }
  return '今日查询次数已用完，请明天再试';
}

export async function resolveResultAccess(request: NextRequest, options: { consume?: boolean } = {}): Promise<ResultAccess> {
  const consume = options.consume !== false;

  // 可信网关：小程序 BFF 已在网关侧管理配额，内部 API 视为已认证、无预览限制、不消耗配额。
  if (isInternalGatewayRequest(request)) {
    return {
      authenticated: true,
      userId: getActingUserId(request),
      level: 'admin',
      limit: null,
      used: null,
      remaining: null,
      previewLimit: null,
      bound: false,
    };
  }

  const user = getUserFromRequest(request);
  if (!user) {
    return {
      authenticated: false,
      userId: null,
      level: 'guest',
      limit: null,
      used: null,
      remaining: null,
      previewLimit: PUBLIC_RESULT_PREVIEW_LIMIT,
      bound: false,
    };
  }

  // 是否已绑定（认领）运动员资料——决定配额文案口径。
  const [ownerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM sup_athlete_profile_owners
     WHERE user_id = ? AND status = 'active' AND role = 'owner'
     LIMIT 1`,
    [user.user_id]
  );
  const bound = ownerRows.length > 0;

  const [rows] = await pool.execute<UserAccessRow[]>(
    `SELECT user_id, nickname, email, openid, user_level, status, daily_result_query_limit, can_view_all_results
     FROM sup_users
     WHERE user_id = ?
     LIMIT 1`,
    [user.user_id]
  );

  const row = rows[0];
  const { level, limit } = resolveResultQueryLimit({
    level: row?.user_level,
    status: row?.status,
    dailyLimit: row?.daily_result_query_limit,
    canViewAll: Number(row?.can_view_all_results) === 1,
    nickname: row?.nickname,
    email: row?.email,
    openid: row?.openid,
  });

  if (limit === null) {
    return {
      authenticated: true,
      userId: user.user_id,
      level,
      limit: null,
      used: null,
      remaining: null,
      previewLimit: null,
      bound,
    };
  }

  const [usageRows] = await pool.execute<RowDataPacket[]>(
    `SELECT query_count
     FROM sup_user_result_query_usage
     WHERE user_id = ? AND usage_date = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'))
     LIMIT 1`,
    [user.user_id]
  );
  const usedBefore = Number(usageRows[0]?.query_count || 0);

  if (usedBefore >= limit) {
    return {
      authenticated: true,
      userId: user.user_id,
      level,
      limit,
      used: usedBefore,
      remaining: 0,
      previewLimit: 0,
      bound,
    };
  }

  if (!consume) {
    return {
      authenticated: true,
      userId: user.user_id,
      level,
      limit,
      used: usedBefore,
      remaining: Math.max(0, limit - usedBefore),
      previewLimit: null,
      bound,
    };
  }

  await pool.execute(
    `INSERT INTO sup_user_result_query_usage (user_id, usage_date, query_count)
     VALUES (?, DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')), 1)
     ON DUPLICATE KEY UPDATE query_count = query_count + 1, updated_at = CURRENT_TIMESTAMP`,
    [user.user_id]
  );

  return {
    authenticated: true,
    userId: user.user_id,
    level,
    limit,
    used: usedBefore + 1,
    remaining: Math.max(0, limit - usedBefore - 1),
    previewLimit: null,
    bound,
  };
}

export function applyPublicPreview<T>(items: T[], access: ResultAccess) {
  if (access.authenticated) return { items, previewLocked: false };
  return {
    items: items.slice(0, PUBLIC_RESULT_PREVIEW_LIMIT),
    previewLocked: true,
  };
}
