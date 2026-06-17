/**
 * 标准化项目族 / 性别段的中文 label（后台分析展示用）。
 * 标准化组别(normalized_group_key)因 age_band(adult_a)/team_type(dragon_board) 含下划线、
 * 回拆不可靠，故组别可读名在接口侧用「该 key 下最高频原始 gender_group 文本」，不在此处拼接。
 */
export const DISCIPLINE_FAMILY_LABEL: Record<string, string> = {
  sprint: '冲刺竞速',
  technical: '技术绕标',
  distance: '长距离',
  marathon: '马拉松',
  team: '团体项目',
  special: '特别项目',
  unknown: '未识别',
};

export const GENDER_SEG_LABEL: Record<string, string> = {
  male: '男子',
  female: '女子',
  mixed: '混合',
  open: '公开/未分',
  unknown: '未知',
};

export function disciplineFamilyLabel(key: string | null | undefined): string {
  const k = String(key || '');
  return DISCIPLINE_FAMILY_LABEL[k] || k || '未识别';
}

export function genderSegLabel(seg: string | null | undefined): string {
  const k = String(seg || '');
  return GENDER_SEG_LABEL[k] || k || '未知';
}
