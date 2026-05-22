'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

interface SubmissionRow {
  submission_id: number;
  user_id: number;
  nickname: string;
  email: string;
  event_name: string;
  event_date: string | null;
  location: string | null;
  file_url: string;
  original_filename: string;
  size_bytes: number;
  user_note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  reviewing: '处理中',
  imported: '已入库',
  rejected: '已驳回',
};

function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

export default function EventResultSubmissionsAdminPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '50' });
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [status, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/event-result-submissions?${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setItems(data.items || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, token]);

  async function updateSubmission(item: SubmissionRow, nextStatus: string, adminNote = item.admin_note || '') {
    setMessage('');
    const res = await fetch(`/api/admin/event-result-submissions/${item.submission_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus, admin_note: adminNote }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || '更新失败');
      return;
    }
    setItems((prev) => prev.map((row) => (
      row.submission_id === item.submission_id ? { ...row, status: nextStatus, admin_note: adminNote } : row
    )));
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brown-800">成绩册提交</h1>
          <p className="mt-1 text-sm text-warm-gray-500">处理用户上传的 PDF 成绩册，复核后再进入成绩导入流程。</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索赛事 / 文件 / 用户" className="h-10 rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm">
            <option value="">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {message && <div className="mb-4 rounded-lg border border-cream-200 bg-white px-4 py-3 text-sm text-brown-700">{message}</div>}

      <div className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
            <tr>
              <th className="px-4 py-3">成绩册</th>
              <th className="px-4 py-3">提交用户</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">备注</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.submission_id} className="border-t border-cream-200 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-brown-800">{item.event_name}</div>
                  <div className="mt-1 text-xs text-warm-gray-500">
                    {[item.event_date, item.location].filter(Boolean).join(' · ') || '未填写日期/地点'}
                  </div>
                  <div className="mt-1 text-xs text-warm-gray-400">{item.original_filename} · {formatSize(item.size_bytes)}</div>
                  <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex text-xs text-brown-500">打开 PDF</a>
                </td>
                <td className="px-4 py-3 text-warm-gray-600">
                  <div>{item.nickname}</div>
                  <div className="text-xs text-warm-gray-400">{item.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-cream-100 px-2 py-1 text-xs text-brown-700">{statusLabels[item.status] || item.status}</span>
                  <div className="mt-2 text-xs text-warm-gray-400">{new Date(item.created_at).toLocaleString('zh-CN')}</div>
                </td>
                <td className="max-w-sm px-4 py-3 text-warm-gray-500">
                  {item.user_note && <div className="mb-2">用户：{item.user_note}</div>}
                  <textarea
                    defaultValue={item.admin_note || ''}
                    rows={3}
                    onBlur={(event) => {
                      if (event.currentTarget.value !== (item.admin_note || '')) {
                        updateSubmission(item, item.status, event.currentTarget.value);
                      }
                    }}
                    className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs text-brown-800"
                    placeholder="管理员备注"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => updateSubmission(item, 'reviewing')} className="mr-2 text-xs text-brown-500">处理中</button>
                  <button onClick={() => updateSubmission(item, 'imported')} className="mr-2 text-xs text-green-700">已入库</button>
                  <button onClick={() => updateSubmission(item, 'rejected')} className="text-xs text-red-500">驳回</button>
                </td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-warm-gray-400">暂无成绩册提交</td></tr>}
          </tbody>
        </table>
        {loading && <div className="border-t border-cream-200 py-4 text-center text-sm text-warm-gray-400">加载中...</div>}
      </div>
    </div>
  );
}
