function resultSortText(alias = 'er') {
  return `CONCAT_WS(' ', COALESCE(${alias}.discipline, ''), COALESCE(${alias}.gender_group, ''), COALESCE(${alias}.board_class, ''), COALESCE(${alias}.round_label, ''), COALESCE(${alias}.team_name, ''))`;
}

export function resultCategorySortExpression(alias = 'er') {
  const text = resultSortText(alias);
  const lowerText = `LOWER(${text})`;
  const isFemale = `(${text} LIKE '%女%')`;
  const isMale = `(${text} LIKE '%男%' AND ${text} NOT LIKE '%女%')`;
  const isMaster = `(${text} LIKE '%大师%' OR ${lowerText} LIKE '%master%')`;
  const isDragon = `(${text} LIKE '%龙板%' OR ${lowerText} LIKE '%dragon%')`;
  const isTeam = `(${text} LIKE '%团体%' OR ${text} LIKE '%团队%' OR ${text} LIKE '%接力%' OR EXISTS (SELECT 1 FROM sup_event_result_members erm_sort WHERE erm_sort.result_id = ${alias}.result_id LIMIT 1 OFFSET 1))`;
  const isShort200 = `(${alias}.discipline LIKE '%200米%' OR LOWER(${alias}.discipline) LIKE '%200m%')`;
  const isLongDistance = `(
    ${text} LIKE '%长距离%'
    OR ${alias}.discipline LIKE '%公里%'
    OR LOWER(${alias}.discipline) LIKE '%km%'
    OR ${alias}.discipline REGEXP '(^|[^0-9])(3000|5000|6000|8000|10000|12000|15000)[[:space:]]*(米|m|M)?'
  )`;

  return `CASE
    WHEN ${isDragon} THEN 90
    WHEN ${isTeam} THEN 80
    WHEN ${isLongDistance} AND ${isMale} AND NOT ${isMaster} THEN 10
    WHEN ${isLongDistance} AND ${isFemale} AND NOT ${isMaster} THEN 20
    WHEN ${isLongDistance} AND ${isMale} AND ${isMaster} THEN 30
    WHEN ${isLongDistance} AND ${isFemale} AND ${isMaster} THEN 40
    WHEN ${isLongDistance} THEN 49
    WHEN ${isShort200} AND ${isMale} THEN 50
    WHEN ${isShort200} AND ${isFemale} THEN 60
    WHEN ${isShort200} THEN 69
    ELSE 70
  END`;
}

export function resultDefaultOrderBy(options: { includeEventDate?: boolean; eventAlias?: string; resultAlias?: string } = {}) {
  const eventAlias = options.eventAlias || 'e';
  const resultAlias = options.resultAlias || 'er';
  const eventOrder = options.includeEventDate
    ? `${eventAlias}.start_date DESC, ${eventAlias}.event_id DESC,`
    : '';

  return `${eventOrder}
    ${resultCategorySortExpression(resultAlias)} ASC,
    ${resultAlias}.discipline ASC,
    ${resultAlias}.gender_group ASC,
    ${resultAlias}.round_label ASC,
    CASE
      WHEN UPPER(COALESCE(${resultAlias}.result_status_code, '')) IN ('DNS', 'DNF', 'DQ', 'DSQ', 'DNQ', 'OTL') THEN 1
      WHEN UPPER(COALESCE(${resultAlias}.finish_time, '')) IN ('DNS', 'DNF', 'DQ', 'DSQ', 'DNQ', 'OTL') THEN 1
      ELSE 0
    END ASC,
    ${resultAlias}.rank_position ASC,
    ${resultAlias}.result_id ASC`;
}
