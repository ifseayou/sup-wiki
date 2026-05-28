'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/app/admin/layout';

type CoachCheck = {
  check_id: number;
  athlete_id: number | null;
  athlete_name: string;
  query_name: string;
  gender_priority: string | null;
  result_count: number;
  candidate_rank: number;
  query_status: string;
  certificate_no: string | null;
  certificate_no_masked: string | null;
  club_name: string | null;
  expiry_date: string | null;
  source_title: string | null;
  source_url: string | null;
  source_excerpt: string | null;
  match_status: string;
  professional_id: number | null;
  checked_at: string | null;
  updated_at: string;
  linked_athlete_name?: string | null;
  professional_name?: string | null;
};

const queryStatusLabels: Record<string, string> = {
  queued: '待查询',
  hit: '命中',
  not_found: '未命中',
  ambiguous: '重名待确认',
  blocked: '被限制',
  error: '失败',
};

const matchStatusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已驳回',
  linked_elsewhere: '已改挂',
};

const inputClass = 'rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-500 focus:ring-2 focus:ring-brown-500/20';

function Badge({ value, type }: { value: string; type: 'query' | 'match' }) {
  const label = type === 'query' ? queryStatusLabels[value] || value : matchStatusLabels[value] || value;
  const tone =
    value === 'confirmed' || value === 'hit'
      ? 'bg-green-100 text-green-700'
      : value === 'rejected' || value === 'error' || value === 'blocked'
        ? 'bg-red-100 text-red-700'
        : value === 'ambiguous'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-cream-200 text-warm-gray-600';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

function fmtDate(value: string | null) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

export default function CoachCertificateChecksPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<CoachCheck[]>([]);
  const [search, setSearch] = useState('');
  const [queryStatus, setQueryStatus] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<CoachCheck | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const pageSize = 30;

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) params.set('search', search.trim());
    if (queryStatus) params.set('query_status', queryStatus);
    if (matchStatus) params.set('match_status', matchStatus);
    return params.toString();
  }, [page, search, queryStatus, matchStatus]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/coach-certificate-checks?${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {
        if (!cancelled) setMessage('教练员线索加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, token]);

  function refresh() {
    const current = page;
    setPage(1);
    if (current === 1) {
      fetch(`/api/admin/coach-certificate-checks?${query}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          setItems(data.items || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
        });
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusyId(editing.check_id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/coach-certificate-checks/${editing.check_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editing),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '保存失败');
      setEditing(null);
      setMessage('线索已保存');
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmItem(item: CoachCheck) {
    setBusyId(item.check_id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/coach-certificate-checks/${item.check_id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '确认失败');
      setMessage(`已确认入库，专业人员ID：${data.professional_id}`);
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '确认失败');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectItem(item: CoachCheck) {
    setBusyId(item.check_id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/coach-certificate-checks/${item.check_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...item, match_status: 'rejected' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '驳回失败');
      setMessage('已驳回线索');
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '驳回失败');
    } finally {
      setBusyId(null);
    }
  }

  async function importRows() {
    setMessage('');
    try {
      const res = await fetch('/api/admin/coach-certificate-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: importText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '导入失败');
      setMessage(`已导入 ${data.imported || 0} 条教练员证书线索`);
      setImportText('');
      setShowImport(false);
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败');
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brown-800">教练员线索</h1>
          <p className="mt-1 text-sm text-warm-gray-500">查看候选运动员、人工导入公示结果，并确认生成后台教练员档案。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/professionals?primary_role=coach" className="rounded-lg border border-cream-300 px-4 py-2 text-sm text-brown-600 hover:border-brown-400">
            查看正式教练员
          </Link>
          <button onClick={() => setShowImport((value) => !value)} className="rounded-lg bg-brown-500 px-4 py-2 text-sm text-white hover:bg-brown-600">
            导入公示结果
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-cream-200 bg-cream-50 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索姓名 / 证书编号 / 俱乐部"
            className={`${inputClass} w-72`}
          />
          <select value={queryStatus} onChange={(e) => { setQueryStatus(e.target.value); setPage(1); }} className={inputClass}>
            <option value="">全部查询状态</option>
            {Object.entries(queryStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={matchStatus} onChange={(e) => { setMatchStatus(e.target.value); setPage(1); }} className={inputClass}>
            <option value="">全部确认状态</option>
            {Object.entries(matchStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={() => { setSearch(''); setQueryStatus(''); setMatchStatus(''); setPage(1); }} className="rounded-lg border border-cream-300 px-4 py-2 text-sm text-warm-gray-600 hover:border-brown-400">
            清空筛选
          </button>
        </div>
        <div className="mt-3 text-sm text-warm-gray-500">共 {total} 条线索，每页 {pageSize} 条。</div>
      </div>

      {showImport && (
        <div className="mb-4 rounded-xl border border-cream-200 bg-cream-50 p-4">
          <div className="mb-2 font-medium text-brown-800">导入人工整理结果</div>
          <p className="mb-3 text-xs text-warm-gray-500">支持 CSV/TSV：姓名,证书编号,所属俱乐部,证书有效期截止,来源URL。只导入你已授权取得或人工整理的数据。</p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={7}
            className={`${inputClass} w-full font-mono`}
            placeholder={'姓名,证书编号,所属俱乐部,证书有效期截止,来源URL\n谢海龙,CHNSUP2024CC02151,杭州秋晴望月科技有限公司,2027.6.30,'}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowImport(false)} className="rounded-lg border border-cream-300 px-4 py-2 text-sm text-warm-gray-600">取消</button>
            <button onClick={importRows} disabled={!importText.trim()} className="rounded-lg bg-brown-500 px-4 py-2 text-sm text-white disabled:opacity-50">导入</button>
          </div>
        </div>
      )}

      {message && <div className="mb-4 rounded-lg border border-cream-300 bg-cream-50 px-4 py-3 text-sm text-brown-700">{message}</div>}

      <div className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
            <tr>
              <th className="px-4 py-3">运动员</th>
              <th className="px-4 py-3">优先级</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">证书</th>
              <th className="px-4 py-3">俱乐部</th>
              <th className="px-4 py-3">有效期</th>
              <th className="px-4 py-3">来源/时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.check_id} className="border-t border-cream-200 align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold text-brown-800">{item.query_name}</div>
                  <div className="mt-1 text-xs text-warm-gray-400">
                    {item.athlete_id ? `运动员 #${item.athlete_id}` : '未绑定运动员'} · 成绩 {item.result_count || 0} 条
                  </div>
                </td>
                <td className="px-4 py-3 text-warm-gray-600">{item.gender_priority === 'male' ? '男子优先' : '其他'}</td>
                <td className="space-y-1 px-4 py-3">
                  <Badge value={item.query_status} type="query" />
                  <div><Badge value={item.match_status} type="match" /></div>
                </td>
                <td className="px-4 py-3 text-brown-700">{item.certificate_no_masked || item.certificate_no || '-'}</td>
                <td className="max-w-xs px-4 py-3 text-warm-gray-600">{item.club_name || '-'}</td>
                <td className="px-4 py-3 text-warm-gray-600">{fmtDate(item.expiry_date)}</td>
                <td className="px-4 py-3 text-xs text-warm-gray-500">
                  <div>{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer" className="text-brown-600 hover:underline">{item.source_title || '来源'}</a> : (item.source_title || '-')}</div>
                  <div className="mt-1">{item.checked_at ? `查询 ${String(item.checked_at).slice(0, 16)}` : `更新 ${String(item.updated_at).slice(0, 16)}`}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(item)} className="text-warm-gray-500 hover:text-brown-700">编辑</button>
                    <button disabled={busyId === item.check_id || item.match_status === 'confirmed'} onClick={() => confirmItem(item)} className="text-brown-600 hover:text-brown-800 disabled:opacity-40">确认入库</button>
                    <button disabled={busyId === item.check_id || item.match_status === 'rejected'} onClick={() => rejectItem(item)} className="text-red-500 hover:text-red-600 disabled:opacity-40">驳回</button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-warm-gray-400">{loading ? '加载中...' : '暂无教练员线索'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 text-sm text-warm-gray-500">
        <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-cream-300 px-3 py-2 disabled:opacity-40">上一页</button>
        <span>第 {page} / {totalPages} 页</span>
        <button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-cream-300 px-3 py-2 disabled:opacity-40">下一页</button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-3xl rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brown-800">编辑教练员线索</h2>
              <button onClick={() => setEditing(null)} className="text-xl text-warm-gray-400">×</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-warm-gray-500">姓名<input className={`${inputClass} mt-1 w-full`} value={editing.query_name || ''} onChange={(e) => setEditing({ ...editing, query_name: e.target.value, athlete_name: e.target.value })} /></label>
              <label className="text-sm text-warm-gray-500">运动员ID<input className={`${inputClass} mt-1 w-full`} value={editing.athlete_id || ''} onChange={(e) => setEditing({ ...editing, athlete_id: Number(e.target.value) || null })} /></label>
              <label className="text-sm text-warm-gray-500">查询状态<select className={`${inputClass} mt-1 w-full`} value={editing.query_status} onChange={(e) => setEditing({ ...editing, query_status: e.target.value })}>{Object.entries(queryStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm text-warm-gray-500">确认状态<select className={`${inputClass} mt-1 w-full`} value={editing.match_status} onChange={(e) => setEditing({ ...editing, match_status: e.target.value })}>{Object.entries(matchStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm text-warm-gray-500">证书编号<input className={`${inputClass} mt-1 w-full`} value={editing.certificate_no || ''} onChange={(e) => setEditing({ ...editing, certificate_no: e.target.value })} /></label>
              <label className="text-sm text-warm-gray-500">所属俱乐部<input className={`${inputClass} mt-1 w-full`} value={editing.club_name || ''} onChange={(e) => setEditing({ ...editing, club_name: e.target.value })} /></label>
              <label className="text-sm text-warm-gray-500">有效期<input className={`${inputClass} mt-1 w-full`} value={fmtDate(editing.expiry_date)} onChange={(e) => setEditing({ ...editing, expiry_date: e.target.value })} /></label>
              <label className="text-sm text-warm-gray-500">来源URL<input className={`${inputClass} mt-1 w-full`} value={editing.source_url || ''} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} /></label>
              <label className="md:col-span-2 text-sm text-warm-gray-500">来源摘要<textarea rows={3} className={`${inputClass} mt-1 w-full`} value={editing.source_excerpt || ''} onChange={(e) => setEditing({ ...editing, source_excerpt: e.target.value })} /></label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-cream-300 px-4 py-2 text-sm text-warm-gray-600">取消</button>
              <button onClick={saveEdit} disabled={busyId === editing.check_id} className="rounded-lg bg-brown-500 px-4 py-2 text-sm text-white disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
