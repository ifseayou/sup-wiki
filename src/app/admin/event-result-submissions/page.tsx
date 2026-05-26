'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

interface SubmissionRow {
  submission_id: number;
  user_id: number;
  batch_id: string;
  batch_file_index: number;
  batch_total: number;
  batch_label: string | null;
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

function parseDownloadName(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return fallback;
    }
  }
  return disposition.match(/filename="([^"]+)"/i)?.[1] || fallback;
}

interface SubmissionBatch {
  batch_id: string;
  label: string;
  user: string;
  email: string;
  created_at: string;
  totalSize: number;
  items: SubmissionRow[];
}

export default function EventResultSubmissionsAdminPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const batches = useMemo<SubmissionBatch[]>(() => {
    const map = new Map<string, SubmissionBatch>();
    for (const item of items) {
      const batchId = item.batch_id || `legacy-${item.submission_id}`;
      const existing = map.get(batchId);
      if (existing) {
        existing.items.push(item);
        existing.totalSize += item.size_bytes || 0;
        if (new Date(item.created_at).getTime() > new Date(existing.created_at).getTime()) {
          existing.created_at = item.created_at;
        }
      } else {
        map.set(batchId, {
          batch_id: batchId,
          label: item.batch_label || item.event_name,
          user: item.nickname,
          email: item.email,
          created_at: item.created_at,
          totalSize: item.size_bytes || 0,
          items: [item],
        });
      }
    }
    return Array.from(map.values())
      .map((batch) => ({
        ...batch,
        items: batch.items.sort((a, b) => (a.batch_file_index || 1) - (b.batch_file_index || 1) || b.submission_id - a.submission_id),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [items]);

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

  async function downloadFile(url: string, fallback: string) {
    setMessage('');
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '下载失败');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = parseDownloadName(res.headers.get('Content-Disposition'), fallback);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '下载失败');
    }
  }

  function countStatuses(batch: SubmissionBatch) {
    return batch.items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
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

      <div className="space-y-4">
        {batches.map((batch) => {
          const statusCounts = countStatuses(batch);
          return (
            <section key={batch.batch_id} className="overflow-hidden rounded-2xl border border-cream-200 bg-cream-50 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-cream-200 bg-cream-100/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-brown-800">{batch.label}</h2>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs text-brown-600">{batch.items.length} 份 PDF</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs text-warm-gray-500">{formatSize(batch.totalSize)}</span>
                  </div>
                  <div className="mt-2 text-xs text-warm-gray-500">
                    {batch.user} · {batch.email} · {new Date(batch.created_at).toLocaleString('zh-CN')} · 批次 {batch.batch_id}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(statusCounts).map(([key, value]) => (
                      <span key={key} className="rounded-full border border-cream-200 bg-white px-2 py-0.5 text-[11px] text-warm-gray-500">
                        {statusLabels[key] || key} {value}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => downloadFile(`/api/admin/event-result-submissions/batches/${encodeURIComponent(batch.batch_id)}/download`, `${batch.label}-成绩册.zip`)}
                  className="h-10 rounded-lg bg-brown-500 px-4 text-sm font-semibold text-white hover:bg-brown-600"
                >
                  下载本批次 ZIP
                </button>
              </div>

              <div className="divide-y divide-cream-200">
                {batch.items.map((item) => (
                  <div key={item.submission_id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(260px,1fr)_130px_minmax(260px,0.9fr)_260px] lg:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-brown-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                          第 {item.batch_file_index || 1}/{item.batch_total || batch.items.length} 份
                        </span>
                        <span className="font-medium text-brown-800">{item.original_filename}</span>
                      </div>
                      <div className="mt-1 text-xs text-warm-gray-500">
                        {[item.event_date, item.location].filter(Boolean).join(' · ') || '未填写日期/地点'} · {formatSize(item.size_bytes)}
                      </div>
                      {item.user_note && <div className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-warm-gray-500">用户备注：{item.user_note}</div>}
                    </div>
                    <div>
                      <span className="rounded-full bg-cream-100 px-2 py-1 text-xs text-brown-700">{statusLabels[item.status] || item.status}</span>
                      <div className="mt-2 text-xs text-warm-gray-400">{new Date(item.created_at).toLocaleString('zh-CN')}</div>
                    </div>
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
                    <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-cream-300 px-3 py-2 text-xs text-brown-500 hover:border-brown-400">打开</a>
                      <button onClick={() => downloadFile(`/api/admin/event-result-submissions/${item.submission_id}/download`, item.original_filename)} className="rounded-lg border border-cream-300 px-3 py-2 text-xs text-brown-500 hover:border-brown-400">下载</button>
                      <button onClick={() => updateSubmission(item, 'reviewing')} className="rounded-lg border border-cream-300 px-3 py-2 text-xs text-brown-500 hover:border-brown-400">处理中</button>
                      <button onClick={() => updateSubmission(item, 'imported')} className="rounded-lg border border-green-200 px-3 py-2 text-xs text-green-700 hover:border-green-400">已入库</button>
                      <button onClick={() => updateSubmission(item, 'rejected')} className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-500 hover:border-red-400">驳回</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {!loading && !batches.length && (
          <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-10 text-center text-warm-gray-400">暂无成绩册提交</div>
        )}
        {loading && <div className="rounded-xl border border-cream-200 bg-cream-50 py-4 text-center text-sm text-warm-gray-400">加载中...</div>}
      </div>
    </div>
  );
}
