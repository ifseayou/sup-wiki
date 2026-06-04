export interface NationalityNormalization {
  original: string;
  normalized: string | null;
  changed: boolean;
  known: boolean;
}

const NATIONALITY_ALIAS_PAIRS: Array<[string, string]> = [
  ['中国', '中国'],
  ['中华人民共和国', '中国'],
  ['CHN', '中国'],
  ['CN', '中国'],
  ['CHINA', '中国'],
  ['PR CHINA', '中国'],
  ['PEOPLE S REPUBLIC OF CHINA', '中国'],
  ['HKG', '中国香港'],
  ['HK', '中国香港'],
  ['HONG KONG', '中国香港'],
  ['中国香港', '中国香港'],
  ['TPE', '中国台北'],
  ['TWN', '中国台北'],
  ['TAIWAN', '中国台北'],
  ['CHINESE TAIPEI', '中国台北'],
  ['中国台北', '中国台北'],
  ['USA', '美国'],
  ['US', '美国'],
  ['UNITED STATES', '美国'],
  ['UNITED STATES OF AMERICA', '美国'],
  ['AMERICA', '美国'],
  ['美国', '美国'],
  ['JPN', '日本'],
  ['JP', '日本'],
  ['JAPAN', '日本'],
  ['日本', '日本'],
  ['KOR', '韩国'],
  ['KR', '韩国'],
  ['KOREA', '韩国'],
  ['SOUTH KOREA', '韩国'],
  ['REPUBLIC OF KOREA', '韩国'],
  ['韩国', '韩国'],
  ['ESP', '西班牙'],
  ['ES', '西班牙'],
  ['SPAIN', '西班牙'],
  ['西班牙', '西班牙'],
  ['GRE', '希腊'],
  ['GR', '希腊'],
  ['GREECE', '希腊'],
  ['希腊', '希腊'],
  ['CAN', '加拿大'],
  ['CA', '加拿大'],
  ['CANADA', '加拿大'],
  ['加拿大', '加拿大'],
  ['FRA', '法国'],
  ['FR', '法国'],
  ['FRANCE', '法国'],
  ['法国', '法国'],
  ['GER', '德国'],
  ['DEU', '德国'],
  ['DE', '德国'],
  ['GERMANY', '德国'],
  ['德国', '德国'],
  ['ITA', '意大利'],
  ['IT', '意大利'],
  ['ITALY', '意大利'],
  ['意大利', '意大利'],
  ['GBR', '英国'],
  ['UK', '英国'],
  ['UNITED KINGDOM', '英国'],
  ['GREAT BRITAIN', '英国'],
  ['BRITAIN', '英国'],
  ['英国', '英国'],
  ['AUS', '澳大利亚'],
  ['AU', '澳大利亚'],
  ['AUSTRALIA', '澳大利亚'],
  ['澳大利亚', '澳大利亚'],
  ['NZL', '新西兰'],
  ['NZ', '新西兰'],
  ['NEW ZEALAND', '新西兰'],
  ['新西兰', '新西兰'],
  ['BRA', '巴西'],
  ['BR', '巴西'],
  ['BRAZIL', '巴西'],
  ['巴西', '巴西'],
  ['ARG', '阿根廷'],
  ['AR', '阿根廷'],
  ['ARGENTINA', '阿根廷'],
  ['阿根廷', '阿根廷'],
  ['MEX', '墨西哥'],
  ['MX', '墨西哥'],
  ['MEXICO', '墨西哥'],
  ['墨西哥', '墨西哥'],
  ['COL', '哥伦比亚'],
  ['CO', '哥伦比亚'],
  ['COLOMBIA', '哥伦比亚'],
  ['哥伦比亚', '哥伦比亚'],
  ['PER', '秘鲁'],
  ['PE', '秘鲁'],
  ['PERU', '秘鲁'],
  ['秘鲁', '秘鲁'],
  ['POL', '波兰'],
  ['PL', '波兰'],
  ['POLAND', '波兰'],
  ['波兰', '波兰'],
  ['CZE', '捷克'],
  ['CZ', '捷克'],
  ['CZECH REPUBLIC', '捷克'],
  ['CZECHIA', '捷克'],
  ['捷克', '捷克'],
  ['HUN', '匈牙利'],
  ['HU', '匈牙利'],
  ['HUNGARY', '匈牙利'],
  ['匈牙利', '匈牙利'],
  ['DEN', '丹麦'],
  ['DNK', '丹麦'],
  ['DK', '丹麦'],
  ['DENMARK', '丹麦'],
  ['丹麦', '丹麦'],
  ['SWE', '瑞典'],
  ['SE', '瑞典'],
  ['SWEDEN', '瑞典'],
  ['瑞典', '瑞典'],
  ['NOR', '挪威'],
  ['NO', '挪威'],
  ['NORWAY', '挪威'],
  ['挪威', '挪威'],
  ['FIN', '芬兰'],
  ['FI', '芬兰'],
  ['FINLAND', '芬兰'],
  ['芬兰', '芬兰'],
  ['NED', '荷兰'],
  ['NLD', '荷兰'],
  ['NL', '荷兰'],
  ['NETHERLANDS', '荷兰'],
  ['荷兰', '荷兰'],
  ['BEL', '比利时'],
  ['BE', '比利时'],
  ['BELGIUM', '比利时'],
  ['比利时', '比利时'],
  ['SUI', '瑞士'],
  ['CHE', '瑞士'],
  ['CH', '瑞士'],
  ['SWITZERLAND', '瑞士'],
  ['瑞士', '瑞士'],
  ['AUT', '奥地利'],
  ['AT', '奥地利'],
  ['AUSTRIA', '奥地利'],
  ['奥地利', '奥地利'],
  ['POR', '葡萄牙'],
  ['PRT', '葡萄牙'],
  ['PT', '葡萄牙'],
  ['PORTUGAL', '葡萄牙'],
  ['葡萄牙', '葡萄牙'],
  ['THA', '泰国'],
  ['TH', '泰国'],
  ['THAILAND', '泰国'],
  ['泰国', '泰国'],
  ['PHI', '菲律宾'],
  ['PHL', '菲律宾'],
  ['PH', '菲律宾'],
  ['PHILIPPINES', '菲律宾'],
  ['菲律宾', '菲律宾'],
  ['MAS', '马来西亚'],
  ['MYS', '马来西亚'],
  ['MY', '马来西亚'],
  ['MALAYSIA', '马来西亚'],
  ['马来西亚', '马来西亚'],
  ['SGP', '新加坡'],
  ['SG', '新加坡'],
  ['SINGAPORE', '新加坡'],
  ['新加坡', '新加坡'],
  ['INA', '印度尼西亚'],
  ['IDN', '印度尼西亚'],
  ['ID', '印度尼西亚'],
  ['INDONESIA', '印度尼西亚'],
  ['印度尼西亚', '印度尼西亚'],
  ['IND', '印度'],
  ['IN', '印度'],
  ['INDIA', '印度'],
  ['印度', '印度'],
  ['IRI', '伊朗'],
  ['IRN', '伊朗'],
  ['IR', '伊朗'],
  ['IRAN', '伊朗'],
  ['伊朗', '伊朗'],
  ['ISR', '以色列'],
  ['IL', '以色列'],
  ['ISRAEL', '以色列'],
  ['以色列', '以色列'],
  ['TUR', '土耳其'],
  ['TR', '土耳其'],
  ['TURKEY', '土耳其'],
  ['TURKIYE', '土耳其'],
  ['土耳其', '土耳其'],
  ['RSA', '南非'],
  ['ZAF', '南非'],
  ['ZA', '南非'],
  ['SOUTH AFRICA', '南非'],
  ['南非', '南非'],
  ['AIN', '中立个人运动员'],
  ['中立个人运动员', '中立个人运动员'],
  ['ICF', 'ICF代表队'],
  ['ICF代表队', 'ICF代表队'],
  ['ROU', '罗马尼亚'],
  ['ROMANIA', '罗马尼亚'],
  ['罗马尼亚', '罗马尼亚'],
  ['CHI', '智利'],
  ['CHL', '智利'],
  ['CHILE', '智利'],
  ['智利', '智利'],
  ['PUR', '波多黎各'],
  ['PUERTO RICO', '波多黎各'],
  ['波多黎各', '波多黎各'],
  ['BAN', '孟加拉国'],
  ['BGD', '孟加拉国'],
  ['BANGLADESH', '孟加拉国'],
  ['孟加拉国', '孟加拉国'],
  ['UAE', '阿联酋'],
  ['ARE', '阿联酋'],
  ['UNITED ARAB EMIRATES', '阿联酋'],
  ['阿联酋', '阿联酋'],
  ['LTU', '立陶宛'],
  ['LITHUANIA', '立陶宛'],
  ['立陶宛', '立陶宛'],
  ['SLO', '斯洛文尼亚'],
  ['SVN', '斯洛文尼亚'],
  ['SLOVENIA', '斯洛文尼亚'],
  ['斯洛文尼亚', '斯洛文尼亚'],
  ['CYP', '塞浦路斯'],
  ['CYPRUS', '塞浦路斯'],
  ['塞浦路斯', '塞浦路斯'],
  ['KSA', '沙特阿拉伯'],
  ['SAU', '沙特阿拉伯'],
  ['SAUDI ARABIA', '沙特阿拉伯'],
  ['沙特阿拉伯', '沙特阿拉伯'],
  ['IRL', '爱尔兰'],
  ['IRELAND', '爱尔兰'],
  ['爱尔兰', '爱尔兰'],
  ['CRC', '哥斯达黎加'],
  ['COSTA RICA', '哥斯达黎加'],
  ['哥斯达黎加', '哥斯达黎加'],
  ['EGY', '埃及'],
  ['EGYPT', '埃及'],
  ['埃及', '埃及'],
  ['GUA', '危地马拉'],
  ['GTM', '危地马拉'],
  ['GUATEMALA', '危地马拉'],
  ['危地马拉', '危地马拉'],
  ['UKR', '乌克兰'],
  ['UKRAINE', '乌克兰'],
  ['乌克兰', '乌克兰'],
  ['BUL', '保加利亚'],
  ['BGR', '保加利亚'],
  ['BULGARIA', '保加利亚'],
  ['保加利亚', '保加利亚'],
  ['KAZ', '哈萨克斯坦'],
  ['KAZAKHSTAN', '哈萨克斯坦'],
  ['哈萨克斯坦', '哈萨克斯坦'],
  ['PAN', '巴拿马'],
  ['PANAMA', '巴拿马'],
  ['巴拿马', '巴拿马'],
  ['SRB', '塞尔维亚'],
  ['SERBIA', '塞尔维亚'],
  ['塞尔维亚', '塞尔维亚'],
  ['SVK', '斯洛伐克'],
  ['SLOVAKIA', '斯洛伐克'],
  ['斯洛伐克', '斯洛伐克'],
  ['ALG', '阿尔及利亚'],
  ['DZA', '阿尔及利亚'],
  ['ALGERIA', '阿尔及利亚'],
  ['阿尔及利亚', '阿尔及利亚'],
  ['MAR', '摩洛哥'],
  ['MOROCCO', '摩洛哥'],
  ['摩洛哥', '摩洛哥'],
  ['PAK', '巴基斯坦'],
  ['PAKISTAN', '巴基斯坦'],
  ['巴基斯坦', '巴基斯坦'],
  ['UZB', '乌兹别克斯坦'],
  ['UZBEKISTAN', '乌兹别克斯坦'],
  ['乌兹别克斯坦', '乌兹别克斯坦'],
  ['RUS', '俄罗斯'],
  ['RUSSIA', '俄罗斯'],
  ['俄罗斯', '俄罗斯'],
  ['CHNN', '中国'],
  ['法国（新喀里多尼亚）', '法国（新喀里多尼亚）'],
  ['美国（夏威夷）', '美国（夏威夷）'],
];

const ALIAS_TO_CHINESE = new Map(
  NATIONALITY_ALIAS_PAIRS.map(([alias, chinese]) => [normalizeAliasKey(alias), chinese]),
);

const PRIORITY_NATIONALITIES = ['中国', '中国香港', '中国台北', '美国', '日本', '韩国'];

function normalizeAliasKey(value: string) {
  return value
    .trim()
    .replace(/[·・]/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/[()（）]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function normalizeNationality(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text || text === '-' || text.toLowerCase() === 'null') return null;
  return ALIAS_TO_CHINESE.get(normalizeAliasKey(text)) || text;
}

export function explainNationalityNormalization(value: unknown): NationalityNormalization {
  const original = String(value ?? '').trim();
  const normalized = normalizeNationality(original);
  return {
    original,
    normalized,
    changed: Boolean(original && normalized && original !== normalized),
    known: !original || !normalized ? false : ALIAS_TO_CHINESE.has(normalizeAliasKey(original)),
  };
}

export function getNationalityAliases(value: unknown): string[] {
  const normalized = normalizeNationality(value);
  if (!normalized) return [];
  const aliases = new Set<string>([normalized]);
  for (const [alias, chinese] of NATIONALITY_ALIAS_PAIRS) {
    if (chinese === normalized) aliases.add(alias);
  }
  return [...aliases];
}

export function getNationalityOptions() {
  const options = Array.from(new Set(NATIONALITY_ALIAS_PAIRS.map(([, chinese]) => chinese).filter(Boolean)));
  return options.sort((a, b) => {
    const priorityA = PRIORITY_NATIONALITIES.indexOf(a);
    const priorityB = PRIORITY_NATIONALITIES.indexOf(b);
    if (priorityA !== -1 || priorityB !== -1) {
      return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
    }
    return a.localeCompare(b, 'zh-Hans-CN');
  });
}

export function nationalityMatchesSearch(value: unknown, search: unknown) {
  const normalized = normalizeNationality(value);
  const keyword = String(search ?? '').trim();
  if (!keyword) return true;
  if (!normalized) return false;
  const normalizedKeyword = normalizeNationality(keyword) || keyword;
  const haystack = [normalized, ...getNationalityAliases(normalized)]
    .map((item) => normalizeAliasKey(item));
  const needle = normalizeAliasKey(normalizedKeyword);
  const rawNeedle = normalizeAliasKey(keyword);
  return haystack.some((item) => item.includes(needle) || item.includes(rawNeedle));
}
