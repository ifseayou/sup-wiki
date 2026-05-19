'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

interface SourceRow {
  source_id: number;
  event_id: number | null;
  event_name: string | null;
  file_name: string;
  file_type: string;
  original_path: string | null;
  source_url: string | null;
  parser_status: string;
  parser_note: string | null;
  extracted_rows: number;
  imported_rows: number;
  updated_at: string;
}

const statusLabels: Record<string, string> = {
  pending_review: '待复核',
  parsed: '已解析',
  imported: '已入库',
  ignored: '已忽略',
  failed: '失败',
};

export default function ResultSourcesAdminPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<SourceRow[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [payloadText, setPayloadText] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '50' });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    return params.toString();
  }, [status, search]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/result-sources?${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, [query, token]);

  async function mark(source: SourceRow, parser_status: string) {
    const res = await fetch(`/api/admin/result-sources/${source.source_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ parser_status }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((item) => item.source_id === source.source_id ? { ...item, parser_status } : item));
    }
  }

  async function importPayload() {
    setMessage('');
    let payloads: unknown[];
    try {
      const parsed = JSON.parse(payloadText);
      payloads = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      setMessage('JSON 格式错误');
      return;
    }

    let ok = 0;
    for (const payload of payloads) {
      const res = await fetch('/api/admin/result-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) ok += 1;
    }
    setMessage(`已导入 ${ok}/${payloads.length} 个来源`);
    setPayloadText('');
    const data = await fetch(`/api/admin/result-sources?${query}`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.json());
    setItems(data.items || []);
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brown-800">成绩导入与复核</h1>
          <p className="mt-1 text-sm text-warm-gray-500">管理原始成绩册、解析状态和本地解析脚本生成的导入 JSON。</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索文件 / 赛事" className="h-10 rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm">
            <option value="">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-cream-200 bg-cream-50 p-4">
        <div className="mb-2 text-sm font-medium text-brown-800">粘贴解析 JSON 导入</div>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          rows={6}
          placeholder="运行 scripts/parse-race-results.py 后，将生成的 payload 或数组粘贴到这里"
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 font-mono text-xs text-brown-800"
        />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={importPayload} disabled={!payloadText.trim()} className="rounded-lg bg-brown-500 px-4 py-2 text-sm text-white disabled:opacity-40">导入成绩</button>
          {message && <span className="text-sm text-warm-gray-500">{message}</span>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
            <tr>
              <th className="px-4 py-3">来源文件</th>
              <th className="px-4 py-3">赛事</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">解析/入库</th>
              <th className="px-4 py-3">备注</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((source) => (
              <tr key={source.source_id} className="border-t border-cream-200">
                <td className="px-4 py-3">
                  <div className="font-medium text-brown-800">{source.file_name}</div>
                  <div className="text-xs text-warm-gray-400">{source.file_type} · {source.original_path}</div>
                  {source.source_url && <a className="text-xs text-brown-500" href={source.source_url} target="_blank" rel="noopener noreferrer">打开来源</a>}
                </td>
                <td className="px-4 py-3 text-warm-gray-600">{source.event_name || '-'}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-cream-100 px-2 py-1 text-xs text-brown-700">{statusLabels[source.parser_status] || source.parser_status}</span></td>
                <td className="px-4 py-3 text-warm-gray-600">{source.extracted_rows || 0} / {source.imported_rows || 0}</td>
                <td className="max-w-md px-4 py-3 text-warm-gray-500">{source.parser_note || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => mark(source, 'pending_review')} className="mr-2 text-xs text-brown-500">待复核</button>
                  <button onClick={() => mark(source, 'ignored')} className="text-xs text-warm-gray-500">忽略</button>
                </td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-warm-gray-400">暂无来源文件</td></tr>}
          </tbody>
        </table>
        {loading && <div className="border-t border-cream-200 py-4 text-center text-sm text-warm-gray-400">加载中...</div>}
      </div>
    </div>
  );
}
