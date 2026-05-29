'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import AdminFilterSelect from '@/components/admin/AdminFilterSelect';

// ---- Types ----
interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface EntityManagerProps {
  entityName: string;
  apiPath: string;
  columns: Column[];
  FormComponent: React.ComponentType<{ data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void; token: string }>;
  defaultFormData: Record<string, unknown>;
  token: string;
  searchPlaceholder?: string;
  getItemPath?: (id: string | number) => string;
  additionalFilters?: {
    key: string;
    placeholder: string;
    options: { label: string; value: string }[];
  }[];
  enableBulkActions?: boolean;
}

// ---- Status Badge ----
export function StatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100"><span className="size-1.5 rounded-full bg-emerald-500" />已发布</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100"><span className="size-1.5 rounded-full bg-amber-500" />草稿</span>;
}

function initialQueryValue(key: string) {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
}

// ---- Delete Confirm ----
function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-cream-50 border border-cream-200 rounded-xl p-6 w-full max-w-sm mx-4 shadow-lg">
        <h3 className="font-semibold text-brown-800 mb-2">确认删除</h3>
        <p className="text-warm-gray-500 text-sm mb-6">删除后无法恢复，确定要删除吗？</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border border-cream-300 rounded-lg text-sm text-warm-gray-600 hover:border-brown-500 transition-all">
            取消
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-all">
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Edit Modal ----
function EditModal({
  title,
  data,
  onChange,
  onSave,
  onCancel,
  FormComponent,
  saving,
  token,
}: {
  title: string;
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  onSave: (status: 'draft' | 'published') => void;
  onCancel: () => void;
  FormComponent: React.ComponentType<{ data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void; token: string }>;
  saving: boolean;
  token: string;
}) {
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState(JSON.stringify(data, null, 2));
  const [jsonError, setJsonError] = useState('');

  function handleJsonParse() {
    try {
      const parsed = JSON.parse(jsonText);
      onChange(parsed);
      setJsonError('');
      setActiveTab('form');
    } catch {
      setJsonError('JSON 格式有误，请检查');
    }
  }

  function handleFormChange(newData: Record<string, unknown>) {
    onChange(newData);
    setJsonText(JSON.stringify(newData, null, 2));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30">
      <div className="bg-cream-50 border border-cream-200 rounded-t-2xl md:rounded-2xl w-full max-w-4xl mx-0 md:mx-4 shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 shrink-0">
          <h2 className="font-semibold text-brown-800">{title}</h2>
          <button onClick={onCancel} className="text-warm-gray-400 hover:text-brown-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cream-200 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('form')}
            className={`py-3 text-sm mr-4 border-b-2 transition-colors ${activeTab === 'form' ? 'border-brown-500 text-brown-700' : 'border-transparent text-warm-gray-400 hover:text-brown-600'}`}
          >
            表单填写
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`py-3 text-sm border-b-2 transition-colors ${activeTab === 'json' ? 'border-brown-500 text-brown-700' : 'border-transparent text-warm-gray-400 hover:text-brown-600'}`}
          >
            JSON 模式
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'form' ? (
            <FormComponent data={data} onChange={handleFormChange} token={token} />
          ) : (
            <div>
              <p className="text-xs text-warm-gray-400 mb-3">粘贴 JSON 数据，点击解析后会自动填入表单字段</p>
              <textarea
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                rows={16}
                className="w-full font-mono text-xs px-3 py-2.5 border border-cream-300 rounded-lg focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-100 text-brown-800"
                spellCheck={false}
              />
              {jsonError && <p className="text-red-500 text-xs mt-1">{jsonError}</p>}
              <button
                onClick={handleJsonParse}
                className="mt-3 px-4 py-2 bg-brown-500 text-white rounded-lg text-sm hover:bg-brown-600 transition-all"
              >
                解析并填入表单
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-cream-200 shrink-0">
          <button onClick={onCancel} className="px-4 py-2 border border-cream-300 rounded-lg text-sm text-warm-gray-600 hover:border-brown-500 transition-all">
            取消
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onSave('draft')}
            disabled={saving}
            className="px-4 py-2 border border-cream-300 rounded-lg text-sm text-warm-gray-600 hover:border-brown-500 transition-all disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存为草稿'}
          </button>
          <button
            onClick={() => onSave('published')}
            disabled={saving}
            className="px-4 py-2 bg-brown-500 text-white rounded-lg text-sm hover:bg-brown-600 transition-all disabled:opacity-50"
          >
            {saving ? '发布中...' : '发布'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main EntityManager ----
export default function EntityManager({
  entityName,
  apiPath,
  columns,
  FormComponent,
  defaultFormData,
  token,
  searchPlaceholder = '搜索...',
  getItemPath,
  additionalFilters,
  enableBulkActions = false,
}: EntityManagerProps) {
  const filters = useMemo(() => additionalFilters ?? [], [additionalFilters]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState(() => initialQueryValue('search'));
  const [debouncedSearch, setDebouncedSearch] = useState(() => initialQueryValue('search'));
  const [statusFilter, setStatusFilter] = useState(() => initialQueryValue('status'));
  const [extraFilterValues, setExtraFilterValues] = useState<Record<string, string>>(
    () => Object.fromEntries(filters.map((filter) => [filter.key, initialQueryValue(filter.key)]))
  );
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const idKey = Object.keys(defaultFormData).find(k => k.endsWith('_id')) || 'id';
  const lastQueryKeyRef = useRef<string>('');

  useEffect(() => {
    if (initialQueryValue('action') === 'new') {
      setIsNew(true);
      setEditItem(null);
      setFormData(defaultFormData);
    }
  }, [defaultFormData]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const queryKey = useMemo(
    () =>
      JSON.stringify({
        apiPath,
        token,
        page,
        pageSize,
        debouncedSearch,
        statusFilter,
        extraFilterValues,
        sortBy,
        sortOrder,
        filters: filters.map((filter) => filter.key),
        refreshTick,
      }),
    [apiPath, token, page, pageSize, debouncedSearch, statusFilter, extraFilterValues, sortBy, sortOrder, filters, refreshTick]
  );

  useEffect(() => {
    if (lastQueryKeyRef.current === queryKey) return;
    lastQueryKeyRef.current = queryKey;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setLoadError('');
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (statusFilter) params.set('status', statusFilter);
        for (const filter of filters) {
          const value = extraFilterValues[filter.key];
          if (value) params.set(filter.key, value);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
          params.set('sortOrder', sortOrder);
        }
        const res = await fetch(`${apiPath}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('admin_token');
            setLoadError('登录状态已失效，请重新登录');
            window.location.reload();
            return;
          }
          throw new Error(data.error || `${entityName}列表加载失败`);
        }
        setItems(data.items || []);
        setTotal(data.total || 0);
        setSelectedIds(new Set());
      } catch (error) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setLoadError(error instanceof Error ? error.message : `${entityName}列表加载失败`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [queryKey, apiPath, token, page, pageSize, debouncedSearch, statusFilter, extraFilterValues, sortBy, sortOrder, filters, entityName]);

  function refreshItems() {
    setRefreshTick((tick) => tick + 1);
  }

  function openNew() {
    setFormData({ ...defaultFormData });
    setEditItem(null);
    setIsNew(true);
  }

  async function openEdit(item: Record<string, unknown>) {
    const id = item[idKey] as string | number;
    setEditItem(item);
    setFormData({ ...item });
    setIsNew(false);
    if (!getItemPath) return;
    try {
      const res = await fetch(getItemPath(id), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.item) {
        setEditItem(data.item);
        setFormData(data.item);
      }
    } catch {
      setMsg(`${entityName}详情加载失败，正在使用列表数据编辑`);
    }
  }

  function openDuplicate(item: Record<string, unknown>) {
    const copy = { ...item };
    // 清掉主键，作为新记录插入
    delete copy[idKey];
    // slug 加 -copy 后缀避免唯一约束冲突（如果有 slug 字段）
    if (typeof copy.slug === 'string' && copy.slug) {
      copy.slug = `${copy.slug}-copy`;
    }
    // 复制品默认为草稿
    copy.status = 'draft';
    setFormData(copy);
    setEditItem(null);
    setIsNew(true);
  }

  function closeModal() {
    setEditItem(null);
    setIsNew(false);
  }

  async function handleSave(status: 'draft' | 'published') {
    setSaving(true);
    setMsg('');
    try {
      const payload = { ...formData, status };
      let res: Response;
      if (isNew) {
        res = await fetch(apiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        const id = editItem?.[idKey];
        res = await fetch(`${apiPath}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) {
        closeModal();
        refreshItems();
        setMsg(status === 'published' ? '已发布' : '已保存为草稿');
        setTimeout(() => setMsg(''), 3000);
      } else {
        const err = await res.json();
        setMsg(`失败: ${err.error || '未知错误'}`);
      }
    } catch {
      setMsg('网络错误');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string | number) {
    try {
      await fetch(`${apiPath}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteId(null);
      refreshItems();
    } catch {
      setMsg('删除失败');
    }
  }

  function toggleSort(column: Column) {
    if (!column.sortable) return;
    setPage(1);
    if (sortBy === column.key) {
      setSortOrder((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortBy(column.key);
    setSortOrder('desc');
  }

  function toggleSelect(id: string | number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectPage() {
    const pageIds = items.map((item) => item[idKey] as string | number);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  async function handleBulkAction(action: 'publish' | 'draft' | 'delete') {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === 'delete' && !window.confirm(`确定删除选中的 ${ids.length} 条${entityName}吗？删除后无法恢复。`)) {
      return;
    }
    setBulkBusy(true);
    setMsg('');
    try {
      const res = await fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '批量操作失败');
      }
      setMsg(`已处理 ${data.affectedRows ?? ids.length} 条${entityName}`);
      setSelectedIds(new Set());
      refreshItems();
      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      setMsg(error instanceof Error ? `失败: ${error.message}` : '失败: 批量操作失败');
    } finally {
      setBulkBusy(false);
    }
  }

  async function toggleStatus(item: Record<string, unknown>) {
    const id = item[idKey];
    const newStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      await fetch(`${apiPath}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      refreshItems();
    } catch {
      setMsg('操作失败');
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-7 -mt-7 border-b border-[#E5D9C9] bg-[#F7F3EC]/94 px-7 pb-4 pt-7 backdrop-blur">
        {/* Page header */}
        <div className="flex flex-col gap-4 rounded-t-2xl border border-b-0 border-[#E4D8C8] bg-[#FFFDF9] px-5 py-5 shadow-[0_12px_32px_rgba(74,58,38,0.05)] md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#A98B63]">DATA OPERATIONS</div>
            <h1 className="mt-1 text-2xl font-bold text-[#263D36]">{entityName}管理</h1>
            <p className="mt-1 text-sm text-[#8B8175]">维护数据状态、内容资料和发布流转，支持搜索、筛选与批量操作。</p>
          </div>
          <button
            onClick={openNew}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0F5C52] px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0B4A43]"
          >
            + 新建{entityName}
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-b-2xl border border-[#E4D8C8] bg-[#FFFDF9] p-4 shadow-[0_10px_28px_rgba(74,58,38,0.04)]">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="h-10 w-full rounded-lg border border-[#D8CCBA] bg-white px-3 text-sm text-[#3A2F24] outline-none transition-all placeholder:text-[#B1A69A] focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10 sm:w-72"
            />
            <AdminFilterSelect
              value={statusFilter}
              placeholder="全部状态"
              onChange={(value) => { setStatusFilter(value); setPage(1); }}
              options={[
                { value: '', label: '全部状态' },
                { value: 'published', label: '已发布' },
                { value: 'draft', label: '草稿' },
              ]}
            />
            {filters.map((filter) => (
              <AdminFilterSelect
                key={filter.key}
                value={extraFilterValues[filter.key] || ''}
                placeholder={filter.placeholder}
                onChange={(value) => {
                  setExtraFilterValues((prev) => ({ ...prev, [filter.key]: value }));
                  setPage(1);
                }}
                options={[{ label: filter.placeholder, value: '' }, ...filter.options]}
              />
            ))}
            <div className="ml-auto rounded-lg border border-[#E8DDCF] bg-[#F8F3EC] px-3 py-2 text-sm text-[#8B8175]">
              共 <span className="font-semibold text-[#263D36]">{total}</span> 条
            </div>
          </div>
        </div>
      </div>

      {enableBulkActions && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#D9E9DE] bg-[#F4FBF7] px-4 py-3">
          <span className="text-sm font-medium text-[#31574C]">已选 {selectedIds.size} 条</span>
          <button
            onClick={() => handleBulkAction('publish')}
            disabled={selectedIds.size === 0 || bulkBusy}
            className="rounded-lg border border-[#BFD8CC] bg-white px-3 py-1.5 text-xs text-[#0F5C52] hover:border-[#0F5C52] disabled:opacity-40"
          >
            批量发布
          </button>
          <button
            onClick={() => handleBulkAction('draft')}
            disabled={selectedIds.size === 0 || bulkBusy}
            className="rounded-lg border border-[#BFD8CC] bg-white px-3 py-1.5 text-xs text-[#0F5C52] hover:border-[#0F5C52] disabled:opacity-40"
          >
            批量收回
          </button>
          <button
            onClick={() => handleBulkAction('delete')}
            disabled={selectedIds.size === 0 || bulkBusy}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-red-500 hover:border-red-400 disabled:opacity-40"
          >
            批量删除
          </button>
          {bulkBusy && <span className="text-xs text-warm-gray-400">处理中...</span>}
        </div>
      )}

      {/* Feedback */}
      {msg && (
        <div className={`rounded-xl px-4 py-2.5 text-sm ${msg.startsWith('失败') || msg.startsWith('网络') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
          {msg}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {loadError}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] shadow-[0_16px_38px_rgba(74,58,38,0.06)]">
        {loading ? (
          <div className="p-12 text-center text-[#8B8175]">加载中...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-[#8B8175]">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-[#E7DCCA] bg-[#F2E9DC]">
                  {enableBulkActions && (
                    <th className="w-10 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every((item) => selectedIds.has(item[idKey] as string | number))}
                        onChange={toggleSelectPage}
                        className="h-4 w-4 rounded border-[#D8CCBA] text-[#0F5C52] focus:ring-[#0F5C52]"
                        aria-label="选择当前页"
                      />
                    </th>
                  )}
                  {columns.map(col => (
                    <th key={col.key} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#7D6B58]">
                      {col.sortable ? (
                        <button
                          onClick={() => toggleSort(col)}
                          className="inline-flex items-center gap-1 hover:text-[#0F5C52]"
                          title={`按${col.label}排序`}
                        >
                          <span>{col.label}</span>
                          <span className="text-[10px]">{sortBy === col.key ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span>
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#7D6B58]">状态</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.12em] text-[#7D6B58]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE4D5]">
                {items.map(item => (
                  <tr key={String(item[idKey])} className="transition-colors hover:bg-[#F8F4ED]">
                    {enableBulkActions && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item[idKey] as string | number)}
                          onChange={() => toggleSelect(item[idKey] as string | number)}
                          className="h-4 w-4 rounded border-[#D8CCBA] text-[#0F5C52] focus:ring-[#0F5C52]"
                          aria-label={`选择${entityName}`}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3.5 text-[#5E554D]">
                        {col.render ? col.render(item[col.key], item) : String(item[col.key] ?? '')}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <StatusBadge status={String(item.status)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(item)}
                          className="text-xs text-[#8B8175] transition-colors hover:text-[#0F5C52]"
                          title={item.status === 'published' ? '收回为草稿' : '发布'}
                        >
                          {item.status === 'published' ? '收回' : '发布'}
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="text-xs font-medium text-[#0F5C52] transition-colors hover:text-[#083D36]"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => openDuplicate(item)}
                          className="text-xs text-[#8B8175] transition-colors hover:text-[#0F5C52]"
                          title="复制为新草稿"
                        >
                          复制
                        </button>
                        <button
                          onClick={() => setDeleteId(item[idKey] as string | number)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-[#D8CCBA] bg-white px-3 py-1.5 text-sm text-[#6B5E50] transition-all hover:border-[#0F5C52] disabled:opacity-40">
            上一页
          </button>
          <span className="rounded-lg bg-[#F2E9DC] px-3 py-1.5 text-sm text-[#6B5E50]">第 {page} / {totalPages} 页 · 共 {total} 条</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-[#D8CCBA] bg-white px-3 py-1.5 text-sm text-[#6B5E50] transition-all hover:border-[#0F5C52] disabled:opacity-40">
            下一页
          </button>
        </div>
      )}

      {/* Edit/Create Modal */}
      {(editItem !== null || isNew) && (
        <EditModal
          title={isNew ? `新建${entityName}` : `编辑${entityName}`}
          data={formData}
          onChange={setFormData}
          onSave={handleSave}
          onCancel={closeModal}
          FormComponent={FormComponent}
          saving={saving}
          token={token}
        />
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <DeleteConfirm
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
