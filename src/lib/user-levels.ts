export type UserLevel = 'free' | 'vip' | 'svip' | 'admin' | 'blocked';
export type LegacyUserLevel = UserLevel | 'verified_athlete' | 'trusted';

export const USER_LEVEL_LABELS: Record<UserLevel, string> = {
  free: '普通用户',
  vip: 'VIP 用户',
  svip: 'SVIP 用户',
  admin: '管理员',
  blocked: '已限制',
};

export const DEFAULT_RESULT_QUERY_LIMITS: Record<UserLevel, number | null> = {
  free: 2,
  vip: 20,
  svip: 200,
  admin: null,
  blocked: 0,
};

export function normalizeUserLevel(value: string | null | undefined): UserLevel {
  if (value === 'verified_athlete') return 'vip';
  if (value === 'trusted') return 'svip';
  if (value === 'vip' || value === 'svip' || value === 'admin' || value === 'blocked') return value;
  return 'free';
}

export function isIAddUUser(identity: {
  nickname?: string | null;
  email?: string | null;
  openid?: string | null;
}) {
  return identity.nickname === 'i_add_u'
    || identity.email === 'xiehl9527@gmail.com'
    || identity.openid === 'sh_1';
}

export function resolveResultQueryLimit(input: {
  level?: string | null;
  status?: string | null;
  dailyLimit?: number | null;
  nickname?: string | null;
  email?: string | null;
  openid?: string | null;
  canViewAll?: boolean | null;
}) {
  const level = normalizeUserLevel(input.level);
  if (input.status === 'blocked' || level === 'blocked') return { level, limit: 0 };
  if (level === 'admin' || isIAddUUser(input)) return { level: 'admin' as const, limit: null };
  // 被授予「查询全部成绩」权限：不限次（保持其原本 level，不提权为 admin）
  if (input.canViewAll) return { level, limit: null };
  if (input.dailyLimit !== null && input.dailyLimit !== undefined) {
    return { level, limit: Math.max(0, Math.min(10000, Number(input.dailyLimit) || 0)) };
  }
  return { level, limit: DEFAULT_RESULT_QUERY_LIMITS[level] };
}
