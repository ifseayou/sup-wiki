'use client';

import { useState, useEffect, useCallback } from 'react';

// ---- Types ----
interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface EntityManagerProps {
  entityName: string;
  apiPath: string;
  columns: Column[];
  FormComponent: React.ComponentType<{ data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }>;
  defaultFormData: Record<string, unknown>;
  token: string;
  searchPlaceholder?: string;
}

// ---- Status Badge ----
export function StatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">已发布</span>;
  }
  return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">草稿</span>;
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
}: {
  title: string;
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  onSave: (status: 'draft' | 'published') => void;
  onCancel: () => void;
  FormComponent: React.ComponentType<{ data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }>;
  saving: boolean;
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
      <div className="bg-cream-50 border border-cream-200 rounded-t-2xl md:rounded-2xl w-full max-w-2xl mx-0 md:mx-4 shadow-xl flex flex-col max-h-[90vh]">
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
            <FormComponent data={data} onChange={handleFormChange} />
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
}: EntityManagerProps) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [msg, setMsg] = useState('');

  const idKey = Object.keys(defaultFormData).find(k => k.endsWith('_id')) || 'id';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${apiPath}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath, token, page, pageSize, search, statusFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openNew() {
    setFormData({ ...defaultFormData });
    setEditItem(null);
    setIsNew(true);
  }

  function openEdit(item: Record<string, unknown>) {
    setFormData({ ...item });
    setEditItem(item);
    setIsNew(false);
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
        fetchItems();
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
      fetchItems();
    } catch {
      setMsg('删除失败');
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
      fetchItems();
    } catch {
      setMsg('操作失败');
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-brown-800">{entityName}管理</h1>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-brown-500 text-white rounded-lg text-sm hover:bg-brown-600 transition-all"
        >
          + 新建{entityName}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800 w-56"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 bg-cream-50 text-warm-gray-600"
        >
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </select>
        <span className="text-sm text-warm-gray-400 self-center">共 {total} 条</span>
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${msg.startsWith('失败') || msg.startsWith('网络') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {/* Table */}
      <div className="bg-cream-50 border border-cream-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-warm-gray-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-warm-gray-400">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-100">
                  {columns.map(col => (
                    <th key={col.key} className="px-4 py-3 text-left text-xs text-warm-gray-400 font-medium uppercase tracking-wide">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs text-warm-gray-400 font-medium uppercase tracking-wide">状态</th>
                  <th className="px-4 py-3 text-right text-xs text-warm-gray-400 font-medium uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {items.map(item => (
                  <tr key={String(item[idKey])} className="hover:bg-cream-100 transition-colors">
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-warm-gray-700">
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
                          className="text-xs text-warm-gray-400 hover:text-brown-600 transition-colors"
                          title={item.status === 'published' ? '收回为草稿' : '发布'}
                        >
                          {item.status === 'published' ? '收回' : '发布'}
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="text-xs text-brown-500 hover:text-brown-700 transition-colors"
                        >
                          编辑
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
        <div className="flex items-center justify-center gap-2 mt-5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-cream-300 rounded text-sm text-warm-gray-600 disabled:opacity-40 hover:border-brown-500 transition-all">
            上一页
          </button>
          <span className="text-sm text-warm-gray-400">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-cream-300 rounded text-sm text-warm-gray-600 disabled:opacity-40 hover:border-brown-500 transition-all">
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
