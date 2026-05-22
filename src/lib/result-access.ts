import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { getUserFromRequest } from '@/lib/user-auth';
import type { RowDataPacket } from 'mysql2';

export const PUBLIC_RESULT_PREVIEW_LIMIT = 3;

type UserLevel = 'free' | 'verified_athlete' | 'trusted' | 'blocked';

type UserAccessRow = RowDataPacket & {
  user_id: number;
  user_level: UserLevel | null;
  status: string | null;
  daily_result_query_limit: number | null;
};

export interface ResultAccess {
  authenticated: boolean;
  userId: number | null;
  level: UserLevel | 'guest';
  limit: number | null;
  used: number | null;
  remaining: number | null;
  previewLimit: number | null;
}

const DEFAULT_LIMITS: Record<UserLevel, number> = {
  free: 30,
  verified_athlete: 100,
  trusted: 500,
  blocked: 0,
};

export async function resolveResultAccess(request: NextRequest): Promise<ResultAccess> {
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
    };
  }

  const [rows] = await pool.execute<UserAccessRow[]>(
    `SELECT user_id, user_level, status, daily_result_query_limit
     FROM sup_users
     WHERE user_id = ?
     LIMIT 1`,
    [user.user_id]
  );

  const row = rows[0];
  const level = row?.user_level || 'free';
  const explicitLimit = row?.daily_result_query_limit;
  const limit = row?.status === 'blocked' || level === 'blocked'
    ? 0
    : (explicitLimit ?? DEFAULT_LIMITS[level]);

  const [usageRows] = await pool.execute<RowDataPacket[]>(
    `SELECT query_count
     FROM sup_user_result_query_usage
     WHERE user_id = ? AND usage_date = CURDATE()
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
    };
  }

  await pool.execute(
    `INSERT INTO sup_user_result_query_usage (user_id, usage_date, query_count)
     VALUES (?, CURDATE(), 1)
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
  };
}

export function applyPublicPreview<T>(items: T[], access: ResultAccess) {
  if (access.authenticated) return { items, previewLocked: false };
  return {
    items: items.slice(0, PUBLIC_RESULT_PREVIEW_LIMIT),
    previewLocked: true,
  };
}
