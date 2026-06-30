// 销售订单（器材销售 / 课程培训）共享纯函数与常量。
// 利润口径：单笔成交，利润 = 销售价 - 成本价（课程成本恒为 0，销售价即利润）。

export type SalesOrderType = 'equipment' | 'course';

export const ORDER_TYPE_OPTIONS: { value: SalesOrderType; label: string }[] = [
  { value: 'equipment', label: '器材销售' },
  { value: 'course', label: '课程培训' },
];

/** 课程培训项目常用预设，下拉可选；选「自定义」时允许手填其它项目名。 */
export const COURSE_PRESETS = ['桨板培训', '游泳培训'] as const;

export function orderTypeLabel(type?: string | null): string {
  return ORDER_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? String(type ?? '');
}

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/** 利润 = 销售价 - 成本价。 */
export function computeProfit(selling: unknown, cost: unknown): number {
  return Math.round((toNumber(selling) - toNumber(cost)) * 100) / 100;
}

/** 毛利率（百分比，保留 1 位）。销售价为 0 时返回 null（无法计算）。 */
export function computeMargin(selling: unknown, cost: unknown): number | null {
  const sell = toNumber(selling);
  if (sell <= 0) return null;
  return Math.round(((sell - toNumber(cost)) / sell) * 1000) / 10;
}

/** 金额格式化为「¥1,234」（保留必要的两位小数）。 */
export function formatYuan(value: unknown): string {
  const n = toNumber(value);
  const fixed = Number.isInteger(n) ? n.toLocaleString('zh-CN') : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `¥${fixed}`;
}

/** 规整为 YYYY-MM-DD，否则返回 null。 */
export function sqlDateOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** 列表筛选 WHERE（list 与 stats 共用，确保统计与明细口径一致）。 */
export function buildSalesWhere(searchParams: URLSearchParams): { where: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  const orderType = searchParams.get('order_type');
  const dateStart = sqlDateOrNull(searchParams.get('date_start'));
  const dateEnd = sqlDateOrNull(searchParams.get('date_end'));
  const search = (searchParams.get('search') || '').trim();

  if (orderType === 'equipment' || orderType === 'course') {
    conditions.push('order_type = ?');
    params.push(orderType);
  }
  if (dateStart) { conditions.push('order_date >= ?'); params.push(dateStart); }
  if (dateEnd) { conditions.push('order_date <= ?'); params.push(dateEnd); }
  if (search) {
    conditions.push('(customer_name LIKE ? OR item_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}
