/**
 * 个人主页成绩分模块的共用映射（Web 与小程序两端一致，避免漂移）。
 * 个人成绩三模块：长距离 / 竞速 / 技术；团体成绩单独分区；其余归「其他」。
 */
export type ResultModuleKey = 'distance' | 'sprint' | 'technical' | 'team' | 'other';

export const RESULT_MODULE_ORDER: ResultModuleKey[] = ['distance', 'sprint', 'technical', 'other', 'team'];

export const RESULT_MODULE_LABEL: Record<ResultModuleKey, string> = {
  distance: '长距离',
  sprint: '竞速',
  technical: '技术',
  team: '团体',
  other: '其他',
};

export const RESULT_MODULE_ICON: Record<ResultModuleKey, string> = {
  distance: '🏊',
  sprint: '⚡',
  technical: '🎯',
  team: '👥',
  other: '⏱',
};

/**
 * 由一条成绩的 entry_type + discipline_family 归入模块。
 * 团体优先（entry_type='team' 或 family='team'）→ team；否则按个人项目族归三模块。
 */
export function resultModuleKey(input: { entry_type?: string | null; family?: string | null; is_team?: boolean | null }): ResultModuleKey {
  if (input.is_team || input.entry_type === 'team' || input.family === 'team') return 'team';
  switch (input.family) {
    case 'distance':
    case 'marathon':
      return 'distance';
    case 'sprint':
      return 'sprint';
    case 'technical':
      return 'technical';
    default:
      return 'other';
  }
}
