export const localResultSourceCondition = `
  (
    src.parser_name IN ('parse-race-results.py', 'local-race-results-import')
    OR src.original_path LIKE '%/桨板赛事/%'
    OR src.original_path LIKE '%/桨板比赛成绩/%'
  )
`;
