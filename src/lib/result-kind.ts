/**
 * 成绩个人/团体的单一判定来源。
 * 落库后以 sup_event_results.entry_type 为权威；回填/导入用 legacy 关键词+队员数兜底推断。
 * 团体 = 团体/龙板/接力/家庭/混双/四桨/双人/多人，或一条成绩挂 ≥2 名队员。
 */
export type EntryType = 'individual' | 'team';

const TEAM_KEYWORD_RE = /(龙板|四桨|团体|团队|接力|家庭|混合双人|双人|四人|多人|dragon|relay)/i;

/** 仅凭一行的字段(不查队员表)推断是否团体——用于回填的关键词兜底。 */
export function looksLikeTeamByText(row: {
  discipline?: string | null;
  gender_group?: string | null;
  round_label?: string | null;
  team_name?: string | null;
  discipline_family?: string | null;
  normalized_discipline_key?: string | null;
}): boolean {
  if (row.discipline_family === 'team') return true;
  if (typeof row.normalized_discipline_key === 'string' && row.normalized_discipline_key.startsWith('team_')) return true;
  const text = [row.discipline, row.gender_group, row.round_label, row.team_name].map((v) => String(v || '')).join(' ');
  return TEAM_KEYWORD_RE.test(text);
}

/** 权威判定：优先用已落库的 entry_type；缺失时回退文本推断。 */
export function isTeamResult(row: { entry_type?: string | null } & Parameters<typeof looksLikeTeamByText>[0]): boolean {
  if (row.entry_type === 'team') return true;
  if (row.entry_type === 'individual') return false;
  return looksLikeTeamByText(row);
}

/** SQL：该行是团体成绩（落库后权威，按 entry_type）。 */
export function teamResultSql(alias = 'er'): string {
  return `${alias}.entry_type = 'team'`;
}

/** SQL：该行是个人成绩。 */
export function individualResultSql(alias = 'er'): string {
  return `${alias}.entry_type = 'individual'`;
}

/** 回填用 SQL：关键词或 ≥2 名队员则为团体（落库 entry_type 前的判定）。 */
export function legacyTeamDetectSql(alias = 'er'): string {
  const text = `CONCAT_WS(' ', COALESCE(${alias}.discipline,''), COALESCE(${alias}.gender_group,''), COALESCE(${alias}.round_label,''), COALESCE(${alias}.team_name,''))`;
  return `(
    ${alias}.discipline_family = 'team'
    OR ${alias}.normalized_discipline_key LIKE 'team\\_%'
    OR ${text} LIKE '%龙板%' OR LOWER(${text}) LIKE '%dragon%'
    OR ${text} LIKE '%团体%' OR ${text} LIKE '%团队%' OR ${text} LIKE '%接力%' OR LOWER(${text}) LIKE '%relay%'
    OR ${text} LIKE '%家庭%' OR ${text} LIKE '%混合双人%' OR ${text} LIKE '%双人%' OR ${text} LIKE '%四人%' OR ${text} LIKE '%多人%'
    OR EXISTS (SELECT 1 FROM sup_event_result_members erm_t WHERE erm_t.result_id = ${alias}.result_id LIMIT 1 OFFSET 1)
  )`;
}
