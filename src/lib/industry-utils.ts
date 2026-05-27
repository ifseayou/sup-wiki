import type { RowDataPacket } from 'mysql2';

export const professionalRoleLabels: Record<string, string> = {
  coach: '教练员',
  referee: '裁判员',
  lecturer: '讲师',
  organizer: '赛事组织者',
  rescue: '安全救援',
  club_owner: '俱乐部负责人',
  athlete: '运动员',
};

export const clubRoleLabels: Record<string, string> = {
  owner: '负责人',
  coach: '教练员',
  referee: '裁判员',
  athlete: '运动员',
  member: '成员',
};

export const verificationLabels: Record<string, string> = {
  unverified: '待核验',
  pending: '核验中',
  verified: '已核验',
  expired: '已过期',
  incomplete: '资料不完整',
};

export const claimLabels: Record<string, string> = {
  unclaimed: '未认领',
  pending: '认领审核中',
  claimed: '已认领',
  rejected: '认领驳回',
};

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function jsonArrayValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return JSON.stringify([]);
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => String(item || '').trim()).filter(Boolean));
  try {
    const parsed = JSON.parse(String(value));
    return JSON.stringify(Array.isArray(parsed) ? parsed : []);
  } catch {
    return JSON.stringify(
      String(value)
        .split(/[,\n，、]/)
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
}

export function normalizeIndustryRow<T extends RowDataPacket>(
  row: T,
  jsonFields: string[],
): Record<string, unknown> {
  return {
    ...row,
    ...Object.fromEntries(jsonFields.map((field) => [field, parseJsonArray(row[field])])),
  };
}

export function roleLabel(role: unknown) {
  return professionalRoleLabels[String(role || '')] || String(role || '专业人员');
}

export function statusLabel(value: unknown, labels: Record<string, string>) {
  return labels[String(value || '')] || String(value || '待补充');
}
