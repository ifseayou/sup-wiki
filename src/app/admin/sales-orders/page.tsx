'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../layout';
import AdminFilterSelect from '@/components/admin/AdminFilterSelect';
import { readAdminResponse } from '@/lib/admin-api-client';
import {
  ORDER_TYPE_OPTIONS,
  COURSE_PRESETS,
  computeProfit,
  marginOf,
  formatYuan,
  orderTypeLabel,
  type SalesOrderType,
} from '@/lib/sales-orders';

// ---- Types ----
interface Order {
  order_id: number;
  order_type: SalesOrderType;
  customer_name: string;
  order_date: string;
  shop_item_id: number | null;
  item_name: string;
  selling_price: number;
  cost_price: number;
  profit: number;
  margin: number | null;
  notes: string | null;
}

interface Stats {
  total_orders: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  equipment_profit: number;
  course_profit: number;
  equipment_count: number;
  course_count: number;
  avg_margin: number | null;
  monthly: { ym: string; revenue: number; profit: number }[];
}

interface ShopItem { shop_item_id: number; name: string; cost_price: number | null; }

interface OrderForm {
  order_id?: number;
  order_type: SalesOrderType;
  customer_name: string;
  order_date: string;
  shop_item_id: string;
  item_name: string;
  selling_price: string;
  cost_price: string;
  profit: string;
  notes: string;
}

const PAGE_SIZE = 20;

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD（本地时区）
}

function emptyForm(): OrderForm {
  return {
    order_type: 'equipment',
    customer_name: '',
    order_date: todayStr(),
    shop_item_id: '',
    item_name: '',
    selling_price: '',
    cost_price: '',
    profit: '',
    notes: '',
  };
}

const inp =
  'w-full h-10 px-3 rounded-lg border border-[#D8CCBA] bg-white text-sm text-[#3A2F24] outline-none transition placeholder:text-[#B1A69A] focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10';

// ---- Stat Card ----
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] px-4 py-3.5 shadow-[0_8px_22px_rgba(74,58,38,0.04)]">
      <div className="text-xs font-medium text-[#8B8175]">{label}</div>
      <div className="mt-1.5 text-xl font-bold tracking-tight" style={{ color: accent || '#263D36' }}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[#A99C8C]">{sub}</div>}
    </div>
  );
}

// ---- Monthly Trend (CSS bars) ----
function MonthlyTrend({ monthly }: { monthly: Stats['monthly'] }) {
  const max = Math.max(1, ...monthly.map((m) => m.revenue));
  if (monthly.length === 0) {
    return <div className="flex h-32 items-center justify-center text-sm text-[#A99C8C]">暂无数据</div>;
  }
  return (
    <div className="flex h-40 items-end gap-2 overflow-x-auto pb-1">
      {monthly.map((m) => {
        const revH = Math.round((m.revenue / max) * 100);
        const profH = m.revenue > 0 ? Math.round((m.profit / max) * 100) : 0;
        return (
          <div key={m.ym} className="flex min-w-[42px] flex-1 flex-col items-center gap-1">
            <div className="flex h-28 w-full items-end justify-center gap-1">
              <div className="w-3 rounded-t bg-[#CDE3DA]" style={{ height: `${Math.max(2, revH)}%` }} title={`营收 ${formatYuan(m.revenue)}`} />
              <div className="w-3 rounded-t bg-[#0F5C52]" style={{ height: `${Math.max(2, profH)}%` }} title={`利润 ${formatYuan(m.profit)}`} />
            </div>
            <div className="text-[10px] text-[#8B8175]">{m.ym.slice(2)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Order Modal ----
function OrderModal({
  initial,
  shopItems,
  saving,
  onSave,
  onClose,
}: {
  initial: OrderForm;
  shopItems: ShopItem[];
  saving: boolean;
  onSave: (form: OrderForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<OrderForm>(initial);
  const [customCourse, setCustomCourse] = useState<boolean>(
    initial.order_type === 'course' && !!initial.item_name && !COURSE_PRESETS.includes(initial.item_name as typeof COURSE_PRESETS[number])
  );
  // 利润是否被手动改写：编辑已有订单时，若存储利润≠销售价-成本价则视为已手改，保留不自动联动。
  const [profitTouched, setProfitTouched] = useState<boolean>(() => {
    if (!initial.profit) return false;
    const auto = computeProfit(initial.selling_price, initial.order_type === 'course' ? 0 : initial.cost_price);
    return Number(initial.profit) !== auto;
  });
  const set = (k: keyof OrderForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function pickProduct(idStr: string) {
    const item = shopItems.find((s) => String(s.shop_item_id) === idStr);
    setForm((f) => ({
      ...f,
      shop_item_id: idStr,
      item_name: item ? item.name : f.item_name,
      cost_price: item && item.cost_price != null ? String(item.cost_price) : f.cost_price,
    }));
  }

  // 未手改时，利润自动 = 销售价 - 成本价（课程成本按 0），随销售价/成本价联动。
  useEffect(() => {
    if (profitTouched) return;
    const autoStr = form.selling_price === ''
      ? ''
      : String(computeProfit(form.selling_price, form.order_type === 'course' ? 0 : form.cost_price));
    setForm((f) => (f.profit === autoStr ? f : { ...f, profit: autoStr }));
  }, [form.selling_price, form.cost_price, form.order_type, profitTouched]);

  const profitNum = Number(form.profit) || 0;
  const margin = marginOf(form.selling_price, profitNum);

  function submit() {
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl border border-[#E4D8C8] bg-[#FFFDF9] shadow-xl md:mx-4 md:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#EFE4D5] px-6 py-4">
          <h2 className="font-semibold text-[#263D36]">{form.order_id ? '编辑订单' : '新建订单'}</h2>
          <button onClick={onClose} className="text-xl leading-none text-[#B1A69A] hover:text-[#6B5E50]">×</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* 订单类型 */}
          <div>
            <label className="mb-1.5 block text-xs text-[#8B8175]">订单类型 *</label>
            <div className="flex gap-2">
              {ORDER_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { set('order_type', opt.value); setProfitTouched(false); if (opt.value === 'course') { set('shop_item_id', ''); set('cost_price', ''); } }}
                  className={`h-10 flex-1 rounded-lg border text-sm transition ${form.order_type === opt.value ? 'border-[#0F5C52] bg-[#0F5C52] text-white' : 'border-[#D8CCBA] bg-white text-[#5E5144] hover:border-[#B99A70]'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-[#8B8175]">客户姓名 *</label>
              <input className={inp} value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="如：张三" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#8B8175]">成交日期 *</label>
              <input type="date" className={inp} value={form.order_date} onChange={(e) => set('order_date', e.target.value)} />
            </div>
          </div>

          {form.order_type === 'equipment' ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs text-[#8B8175]">商城产品 *</label>
                <select className={inp} value={form.shop_item_id} onChange={(e) => pickProduct(e.target.value)}>
                  <option value="">— 请选择产品 —</option>
                  {shopItems.map((s) => (
                    <option key={s.shop_item_id} value={s.shop_item_id}>
                      {s.name}{s.cost_price != null ? `（成本 ¥${s.cost_price}）` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs text-[#8B8175]">成本价（¥）</label>
                  <input type="number" className={inp} value={form.cost_price} onChange={(e) => set('cost_price', e.target.value)} placeholder="自动带出，可改" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#8B8175]">销售价（¥）*</label>
                  <input type="number" className={inp} value={form.selling_price} onChange={(e) => set('selling_price', e.target.value)} placeholder="实际成交价" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#8B8175]">利润（¥，可改）</label>
                  <input
                    type="number"
                    className={inp}
                    value={form.profit}
                    onChange={(e) => { setProfitTouched(true); set('profit', e.target.value); }}
                    placeholder="默认=售价-成本"
                  />
                  <div className="mt-1 text-[11px] text-[#A99C8C]">
                    {form.profit !== '' ? <>毛利率 {margin != null ? `${margin}%` : '—'}{!profitTouched ? ' · 自动' : ' · 已手改'}</> : '默认=销售价-成本价，可改'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs text-[#8B8175]">培训项目 *</label>
                  <select
                    className={inp}
                    value={customCourse ? '__custom__' : form.item_name}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') { setCustomCourse(true); set('item_name', ''); }
                      else { setCustomCourse(false); set('item_name', e.target.value); }
                    }}
                  >
                    <option value="">— 请选择 —</option>
                    {COURSE_PRESETS.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">自定义…</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#8B8175]">销售价（¥）*</label>
                  <input type="number" className={inp} value={form.selling_price} onChange={(e) => set('selling_price', e.target.value)} placeholder="销售价即利润" />
                </div>
              </div>
              {customCourse && (
                <div>
                  <label className="mb-1.5 block text-xs text-[#8B8175]">自定义项目名 *</label>
                  <input className={inp} value={form.item_name} onChange={(e) => set('item_name', e.target.value)} placeholder="如：冲浪培训" />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs text-[#8B8175]">利润（¥，可改）</label>
                <input
                  type="number"
                  className={inp}
                  value={form.profit}
                  onChange={(e) => { setProfitTouched(true); set('profit', e.target.value); }}
                  placeholder="默认=销售价"
                />
                <div className="mt-1 text-[11px] text-[#A99C8C]">课程无成本，默认利润=销售价，可改{!profitTouched && form.profit !== '' ? ' · 自动' : profitTouched ? ' · 已手改' : ''}</div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-xs text-[#8B8175]">备注（选填）</label>
            <input className={inp} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="可填渠道、联系方式等" />
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#EFE4D5] px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-[#D8CCBA] px-4 py-2 text-sm text-[#6B5E50] transition hover:border-[#0F5C52]">取消</button>
          <div className="flex-1" />
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[#0F5C52] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#0B4A43] disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Page ----
export default function SalesOrdersPage() {
  const { token } = useAdminAuth();

  // 共享筛选 state（stats 与明细同源）
  const [orderType, setOrderType] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [jumpInput, setJumpInput] = useState('');

  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [editing, setEditing] = useState<OrderForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 防抖搜索
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // 商城产品（下拉用，取已发布）
  useEffect(() => {
    fetch('/api/admin/shop-items?pageSize=200&status=published', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setShopItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
  }, [token]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (orderType) p.set('order_type', orderType);
    if (dateStart) p.set('date_start', dateStart);
    if (dateEnd) p.set('date_end', dateEnd);
    if (debouncedSearch) p.set('search', debouncedSearch);
    return p.toString();
  }, [orderType, dateStart, dateEnd, debouncedSearch]);

  // 切换筛选回到第 1 页
  useEffect(() => { setPage(1); }, [queryString]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const listParams = new URLSearchParams(queryString);
      listParams.set('page', String(page));
      listParams.set('pageSize', String(PAGE_SIZE));
      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/admin/sales-orders?${listParams}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/sales-orders/stats?${queryString}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const listData = await readAdminResponse(listRes);
      const statsData = await readAdminResponse(statsRes);
      setItems(Array.isArray(listData.items) ? listData.items : []);
      setTotal(Number(listData.total || 0));
      setStats(statsData as unknown as Stats);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
      setItems([]); setTotal(0); setStats(null);
    } finally {
      setLoading(false);
    }
  }, [queryString, page, token]);

  useEffect(() => { void load(); }, [load, refreshTick]);

  function flash(text: string) { setMsg(text); window.setTimeout(() => setMsg(''), 2500); }

  async function handleSave(form: OrderForm) {
    setSaving(true);
    try {
      const payload = {
        order_type: form.order_type,
        customer_name: form.customer_name,
        order_date: form.order_date,
        shop_item_id: form.order_type === 'equipment' ? (form.shop_item_id ? Number(form.shop_item_id) : null) : null,
        item_name: form.item_name,
        selling_price: form.selling_price,
        cost_price: form.order_type === 'course' ? 0 : form.cost_price,
        profit: form.profit,
        notes: form.notes,
      };
      const res = form.order_id
        ? await fetch(`/api/admin/sales-orders/${form.order_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/sales-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
      await readAdminResponse(res);
      setEditing(null);
      setRefreshTick((t) => t + 1);
      flash(form.order_id ? '已更新' : '已新增');
    } catch (e) {
      flash(e instanceof Error ? `失败：${e.message}` : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/admin/sales-orders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await readAdminResponse(res);
      setDeleteId(null);
      setRefreshTick((t) => t + 1);
      flash('已删除');
    } catch (e) {
      flash(e instanceof Error ? `失败：${e.message}` : '删除失败');
    }
  }

  function openEdit(o: Order) {
    setEditing({
      order_id: o.order_id,
      order_type: o.order_type,
      customer_name: o.customer_name,
      order_date: o.order_date,
      shop_item_id: o.shop_item_id ? String(o.shop_item_id) : '',
      item_name: o.item_name,
      selling_price: String(o.selling_price),
      cost_price: String(o.cost_price),
      profit: o.profit != null ? String(o.profit) : '',
      notes: o.notes || '',
    });
  }

  function resetFilters() {
    setOrderType(''); setDateStart(''); setDateEnd(''); setSearch('');
  }

  function jumpToPage() {
    const n = parseInt(jumpInput);
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) { setPage(n); setJumpInput(''); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] px-5 py-5 shadow-[0_12px_32px_rgba(74,58,38,0.05)] md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#A98B63]">BUSINESS</div>
          <h1 className="mt-1 text-2xl font-bold text-[#263D36]">销售订单</h1>
          <p className="mt-1 text-sm text-[#8B8175]">录入器材销售与课程培训订单，自动核算利润与经营统计。</p>
        </div>
        <button
          onClick={() => setEditing(emptyForm())}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0F5C52] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#0B4A43]"
        >
          + 新建订单
        </button>
      </div>

      {/* ===== 上半：统计 ===== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="总营收" value={stats ? formatYuan(stats.total_revenue) : '—'} sub={stats ? `${stats.total_orders} 笔订单` : ''} />
        <StatCard label="总利润" value={stats ? formatYuan(stats.total_profit) : '—'} accent="#0F5C52" sub={stats?.avg_margin != null ? `平均毛利率 ${stats.avg_margin}%` : ''} />
        <StatCard label="器材利润" value={stats ? formatYuan(stats.equipment_profit) : '—'} sub={stats ? `${stats.equipment_count} 笔` : ''} />
        <StatCard label="课程利润" value={stats ? formatYuan(stats.course_profit) : '—'} sub={stats ? `${stats.course_count} 笔` : ''} />
        <StatCard label="总成本" value={stats ? formatYuan(stats.total_cost) : '—'} />
        <StatCard label="订单数" value={stats ? String(stats.total_orders) : '—'} />
        <StatCard label="平均毛利率" value={stats?.avg_margin != null ? `${stats.avg_margin}%` : '—'} />
        <StatCard label="器材/课程" value={stats ? `${stats.equipment_count} / ${stats.course_count}` : '—'} sub="笔数对比" />
      </div>

      <div className="rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] p-5 shadow-[0_8px_22px_rgba(74,58,38,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#263D36]">按月趋势</h3>
          <div className="flex items-center gap-4 text-xs text-[#8B8175]">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#CDE3DA]" />营收</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0F5C52]" />利润</span>
          </div>
        </div>
        <MonthlyTrend monthly={stats?.monthly || []} />
      </div>

      {/* ===== 下半：明细 ===== */}
      {/* 筛选行 */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] p-4 shadow-[0_8px_22px_rgba(74,58,38,0.04)]">
        <input
          type="text"
          placeholder="搜索客户姓名或项目..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-[#D8CCBA] bg-white px-3 text-sm text-[#3A2F24] outline-none transition placeholder:text-[#B1A69A] focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10 sm:w-64"
        />
        <AdminFilterSelect
          value={orderType}
          placeholder="全部类型"
          onChange={setOrderType}
          options={[{ label: '全部类型', value: '' }, ...ORDER_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))]}
        />
        <div className="flex items-center gap-2">
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="h-10 rounded-lg border border-[#D8CCBA] bg-white px-3 text-sm text-[#3A2F24] outline-none focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10" />
          <span className="text-sm text-[#8B8175]">至</span>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="h-10 rounded-lg border border-[#D8CCBA] bg-white px-3 text-sm text-[#3A2F24] outline-none focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10" />
        </div>
        {(orderType || dateStart || dateEnd || search) && (
          <button onClick={resetFilters} className="h-10 rounded-lg border border-[#D8CCBA] bg-white px-3 text-sm text-[#6B5E50] transition hover:border-[#0F5C52]">重置</button>
        )}
        <div className="ml-auto rounded-lg border border-[#E8DDCF] bg-[#F8F3EC] px-3 py-2 text-sm text-[#8B8175]">
          共 <span className="font-semibold text-[#263D36]">{total}</span> 条
        </div>
      </div>

      {msg && <div className={`rounded-xl px-4 py-2.5 text-sm ${msg.startsWith('失败') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{msg}</div>}
      {err && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{err}</div>}

      {/* 明细表 */}
      <div className="overflow-hidden rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] shadow-[0_16px_38px_rgba(74,58,38,0.06)]">
        {loading ? (
          <div className="p-12 text-center text-[#8B8175]">加载中...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-[#8B8175]">暂无订单</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-[#E7DCCA] bg-[#F2E9DC]">
                  {['类型', '客户', '项目/产品', '日期', '销售价', '成本', '利润', '操作'].map((h, i) => (
                    <th key={h} className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#7D6B58] ${i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE4D5]">
                {items.map((o) => (
                  <tr key={o.order_id} className="transition-colors hover:bg-[#F8F4ED]">
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${o.order_type === 'equipment' ? 'bg-[#E5EEF5] text-[#3A5974]' : 'bg-[#E6F1EA] text-[#3F6B4E]'}`}>
                        {orderTypeLabel(o.order_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[#5E554D]">{o.customer_name}</td>
                    <td className="px-4 py-3.5 text-[#5E554D]">{o.item_name}</td>
                    <td className="px-4 py-3.5 text-[#5E554D]">{o.order_date}</td>
                    <td className="px-4 py-3.5 text-[#5E554D]">{formatYuan(o.selling_price)}</td>
                    <td className="px-4 py-3.5 text-[#A99C8C]">{o.cost_price ? formatYuan(o.cost_price) : '—'}</td>
                    <td className="px-4 py-3.5 font-semibold" style={{ color: o.profit >= 0 ? '#0F5C52' : '#9B2C2C' }}>
                      {formatYuan(o.profit)}{o.margin != null ? <span className="ml-1 text-xs font-normal text-[#A99C8C]">{o.margin}%</span> : null}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(o)} className="text-xs font-medium text-[#0F5C52] transition hover:text-[#083D36]">编辑</button>
                        <button onClick={() => setDeleteId(o.order_id)} className="text-xs text-red-400 transition hover:text-red-600">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页（含第 X 页跳转） */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-[#D8CCBA] bg-white px-3 py-1.5 text-sm text-[#6B5E50] transition hover:border-[#0F5C52] disabled:opacity-40">上一页</button>
          <span className="rounded-lg bg-[#F2E9DC] px-3 py-1.5 text-sm text-[#6B5E50]">第 {page} / {totalPages} 页 · 共 {total} 条</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-[#D8CCBA] bg-white px-3 py-1.5 text-sm text-[#6B5E50] transition hover:border-[#0F5C52] disabled:opacity-40">下一页</button>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[#8B8175]">跳转</span>
            <input
              type="number"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') jumpToPage(); }}
              className="h-9 w-16 rounded-lg border border-[#D8CCBA] bg-white px-2 text-center text-sm text-[#3A2F24] outline-none focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10"
              placeholder="页"
            />
            <button onClick={jumpToPage} className="rounded-lg border border-[#D8CCBA] bg-white px-3 py-1.5 text-sm text-[#6B5E50] transition hover:border-[#0F5C52]">确定</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {editing && (
        <OrderModal
          initial={editing}
          shopItems={shopItems}
          saving={saving}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {/* 删除确认 */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-[#E4D8C8] bg-[#FFFDF9] p-6 shadow-lg">
            <h3 className="mb-2 font-semibold text-[#263D36]">确认删除</h3>
            <p className="mb-6 text-sm text-[#8B8175]">删除后无法恢复，确定删除这条订单吗？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-[#D8CCBA] px-4 py-2 text-sm text-[#6B5E50] transition hover:border-[#0F5C52]">取消</button>
              <button onClick={() => handleDelete(deleteId)} className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition hover:bg-red-600">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
