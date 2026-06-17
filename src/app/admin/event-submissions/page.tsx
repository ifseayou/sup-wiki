'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { readAdminResponse } from '@/lib/admin-api-client';
import { formatChinaDateTime } from '@/lib/china-time';

interface PrizeRow { rank: number; amount: number }
interface CategoryRow { name: string; discipline?: string; gender_group?: string; fee?: string; quota?: number | null; prizes?: PrizeRow[] }
interface OfficialRow { role_category?: string; role_title?: string; name: string; region?: string }
interface EventForm {
  name?: string; name_en?: string; start_date?: string; end_date?: string;
  registration_start_date?: string; registration_deadline?: string;
  province?: string; city?: string; venue?: string; location?: string;
  organizer?: string; source_scope?: string; price_range?: string; prize_pool?: string; registration_url?: string;
  disciplines?: string[]; categories?: CategoryRow[]; officials?: OfficialRow[];
  [k: string]: unknown;
}
interface SubmissionRow {
  submission_id: number; user_id: number; nickname: string; submission_type: string; source: string;
  image_urls: string[]; link_url: string; user_note: string; source_text: string;
  extracted_json: EventForm | null; extract_status: string; extract_error: string;
  review_status: string; event_id: number | null; admin_note: string; created_at: string;
  publish_time?: string | null;
}

const reviewLabels: Record<string, string> = { pending: '待处理', reviewing: '处理中', ingested: '已录入', rejected: '已驳回' };
const statusColor: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', ingested: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600', reviewing: 'bg-blue-100 text-blue-700',
};
const tabs = [
  { value: 'pending', label: '待处理' }, { value: 'ingested', label: '已录入' },
  { value: 'rejected', label: '已驳回' }, { value: 'all', label: '全部' },
];

const BASE_FIELDS: { key: keyof EventForm; label: string; ph?: string }[] = [
  { key: 'name', label: '赛事名称' }, { key: 'start_date', label: '开始日期', ph: 'YYYY-MM-DD' },
  { key: 'end_date', label: '结束日期', ph: 'YYYY-MM-DD' }, { key: 'registration_start_date', label: '报名开始', ph: 'YYYY-MM-DD' },
  { key: 'registration_deadline', label: '报名截止', ph: 'YYYY-MM-DD' }, { key: 'province', label: '省份' },
  { key: 'city', label: '城市' }, { key: 'venue', label: '场地' }, { key: 'location', label: '详细地点' },
  { key: 'organizer', label: '主办方' }, { key: 'prize_pool', label: '总奖金' }, { key: 'price_range', label: '报名费' },
  { key: 'registration_url', label: '报名链接' }, { key: 'source_scope', label: '范围(全国/本省)' },
];

const fmtPrizes = (p?: PrizeRow[]) => (p || []).map(x => `${x.rank}:${x.amount}`).join(', ');
const parsePrizes = (s: string): PrizeRow[] => s.split(',').map(seg => {
  const m = seg.trim().match(/(\d+)\s*[:：]\s*(\d+)/);
  return m ? { rank: Number(m[1]), amount: Number(m[2]) } : null;
}).filter(Boolean) as PrizeRow[];

export default function EventSubmissionsPage() {
  const { token } = useAdminAuth();
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showText, setShowText] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<EventForm>({});
  const [jsonMode, setJsonMode] = useState(false);
  const [editJson, setEditJson] = useState('');
  const [supId, setSupId] = useState('');
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState('1');

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/admin/event-submissions?review_status=${tab}&page=${page}&pageSize=${PAGE_SIZE}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => readAdminResponse(res))
      .then((data) => {
        setItems((data.items as SubmissionRow[]) || []);
        setTotal(Number(data.total || 0));
        const tp = Math.max(1, Number(data.totalPages || 1));
        setTotalPages(tp);
        setPageInput(String(Math.min(page, tp)));
      })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, [tab, token, page]);
  useEffect(() => { load(); }, [load]);

  const [crawlBusy, setCrawlBusy] = useState(false);
  async function triggerCrawl() {
    setCrawlBusy(true); setMsg('');
    try {
      const res = await fetch('/api/admin/wechat-crawl', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ maxPerRun: 10 }),
      });
      const data = await readAdminResponse(res);
      setMsg((data.message as string) || '公众号抓取已启动，稍后刷新列表查看');
      setTimeout(() => load(), 8000);
    } catch (e) { setMsg('触发失败：' + (e as Error).message); } finally { setCrawlBusy(false); }
  }

  // 切换状态分栏时回到第 1 页
  function changeTab(value: string) {
    if (value === tab) return;
    setTab(value);
    setPage(1);
  }
  function jumpToPage() {
    const target = Math.min(totalPages, Math.max(1, Number(pageInput) || 1));
    setPage(target);
    setPageInput(String(target));
  }

  function copyMaterials(row: SubmissionRow) {
    const pack = { name: row.extracted_json?.name || '', link: row.link_url, text: row.source_text, image_urls: row.image_urls };
    navigator.clipboard.writeText(JSON.stringify(pack, null, 2))
      .then(() => setMsg('素材包已复制，可粘贴到本地 Claude Code / Codex 解析'))
      .catch(() => setMsg('复制失败，请手动选择'));
  }

  async function runExtract(id: number) {
    setBusyId(id); setMsg('AI 抽取中，请稍候…（多图识别约需 1 分钟）');
    try {
      const res = await fetch(`/api/admin/event-submissions/${id}/extract`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      await readAdminResponse(res); // 异步：返回 { started:true }，下面轮询结果
      // 轮询 extract_status（每 3s，最多 ~45s），避免长请求被 nginx 504
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const r2 = await fetch(`/api/admin/event-submissions?review_status=${tab}&page=${page}&pageSize=${PAGE_SIZE}`, { headers: { Authorization: `Bearer ${token}` } });
        const d2 = await readAdminResponse(r2);
        const items2 = (d2.items as SubmissionRow[]) || [];
        setItems(items2);
        setTotal(Number(d2.total || 0));
        setTotalPages(Math.max(1, Number(d2.totalPages || 1)));
        const row = items2.find((x) => x.submission_id === id);
        if (row && row.extract_status !== 'extracting' && row.extract_status !== 'pending') {
          setMsg(row.extract_status === 'extracted' ? 'AI 抽取完成' : ('抽取失败：' + (row.extract_error || '未知原因')));
          return;
        }
      }
      setMsg('抽取仍在进行中，请稍后点「刷新」查看结果');
    } catch (e) { setMsg('抽取失败：' + (e as Error).message); } finally { setBusyId(null); }
  }

  function startEdit(row: SubmissionRow) {
    const ev: EventForm = { ...(row.extracted_json || {}) };
    ev.disciplines = Array.isArray(ev.disciplines) ? ev.disciplines : [];
    ev.categories = Array.isArray(ev.categories) ? ev.categories : [];
    ev.officials = Array.isArray(ev.officials) ? ev.officials : [];
    setEditing(row.submission_id); setForm(ev); setJsonMode(false); setEditJson(JSON.stringify(ev, null, 2)); setSupId(row.event_id ? String(row.event_id) : '');
  }

  function buildEventPayload(): EventForm | null {
    if (jsonMode) { try { return JSON.parse(editJson); } catch { setMsg('JSON 格式错误'); return null; } }
    return form;
  }

  async function runIngest(id: number) {
    const event = buildEventPayload(); if (!event) return;
    setBusyId(id); setMsg('');
    try {
      const res = await fetch(`/api/admin/event-submissions/${id}/ingest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ event }),
      });
      const data = await readAdminResponse(res); setMsg(`已录入新赛事 #${data.event_id}`); setEditing(null); load();
    } catch (e) { setMsg('录入失败：' + (e as Error).message); } finally { setBusyId(null); }
  }

  async function runSupplement(id: number) {
    const event = buildEventPayload(); if (!event) return;
    const eid = Number(supId);
    if (!Number.isInteger(eid) || eid <= 0) { setMsg('请填写要补充的赛事 ID'); return; }
    setBusyId(id); setMsg('');
    try {
      const res = await fetch(`/api/admin/event-submissions/${id}/supplement`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ event_id: eid, event }),
      });
      const data = await readAdminResponse(res); setMsg(`已补充到赛事 #${eid}（${JSON.stringify(data.result || {})}）`); setEditing(null); load();
    } catch (e) { setMsg('补充失败：' + (e as Error).message); } finally { setBusyId(null); }
  }

  async function runReject(id: number) {
    if (!confirm('确认驳回该提报？')) return;
    setBusyId(id); setMsg('');
    try {
      const res = await fetch(`/api/admin/event-submissions/${id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ admin_note: '' }),
      });
      await readAdminResponse(res); load();
    } catch (e) { setMsg('驳回失败：' + (e as Error).message); } finally { setBusyId(null); }
  }

  // 表单更新
  const setF = (k: keyof EventForm, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const setCat = (i: number, patch: Partial<CategoryRow>) => setForm(p => { const c = [...(p.categories || [])]; c[i] = { ...c[i], ...patch }; return { ...p, categories: c }; });
  const addCat = () => setForm(p => ({ ...p, categories: [...(p.categories || []), { name: '', prizes: [] }] }));
  const delCat = (i: number) => setForm(p => ({ ...p, categories: (p.categories || []).filter((_, j) => j !== i) }));
  const setOff = (i: number, patch: Partial<OfficialRow>) => setForm(p => { const o = [...(p.officials || [])]; o[i] = { ...o[i], ...patch }; return { ...p, officials: o }; });
  const addOff = () => setForm(p => ({ ...p, officials: [...(p.officials || []), { name: '' }] }));
  const delOff = (i: number) => setForm(p => ({ ...p, officials: (p.officials || []).filter((_, j) => j !== i) }));

  const inp = 'w-full px-2 py-1.5 border border-cream-300 rounded text-sm bg-cream-50';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-brown-800">赛事提报审核 <span className="text-sm font-normal text-warm-gray-400">(共 {total} 条)</span></h1>
        <div className="flex items-center gap-3">
          <button onClick={triggerCrawl} disabled={crawlBusy} className="rounded-lg border border-brown-300 px-4 py-1.5 text-sm text-brown-700 hover:border-brown-500 disabled:opacity-50">{crawlBusy ? '抓取启动中…' : '立即抓取公众号'}</button>
          <button onClick={load} className="text-sm text-blue-600">刷新</button>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button key={t.value} onClick={() => changeTab(t.value)}
            className={`px-4 py-1.5 rounded-lg text-sm ${tab === t.value ? 'bg-brown-600 text-white' : 'bg-cream-100 text-brown-700'}`}>{t.label}</button>
        ))}
      </div>
      {msg && <div className="mb-3 text-sm text-brown-700 bg-cream-100 rounded px-3 py-2">{msg}</div>}
      {loading && <div className="text-sm text-warm-gray-400">加载中…</div>}

      <div className="space-y-5">
        {items.map((row) => (
          <div key={row.submission_id} className="rounded-2xl border border-cream-200 bg-white shadow-sm overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-cream-100">
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs ${row.source === 'wechat' ? 'bg-emerald-100 text-emerald-700' : 'bg-cream-100 text-brown-600'}`}>{row.source === 'wechat' ? '公众号抓取' : '用户提报'}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${statusColor[row.review_status] || 'bg-cream-100'}`}>{reviewLabels[row.review_status] || row.review_status}</span>
                <span className="text-brown-700 font-medium">{row.extracted_json?.name || row.user_note || `提报 #${row.submission_id}`}</span>
                {row.event_id && <span className="text-xs text-green-700">→ 赛事 #{row.event_id}</span>}
              </div>
              <span className="text-xs text-warm-gray-400">
                {row.source === 'wechat' && row.publish_time ? `发布:${formatChinaDateTime(row.publish_time)} · ` : ''}
                {formatChinaDateTime(row.created_at)} · 抽取:{row.extract_status}
              </span>
            </div>

            <div className="px-5 py-4">
              {row.extract_error && <div className="text-xs text-red-500 mb-2">抽取错误：{row.extract_error}</div>}
              {row.link_url && <div className="text-sm mb-2"><a className="text-blue-600 underline break-all" href={row.link_url} target="_blank" rel="noreferrer">{row.link_url}</a></div>}
              {/* 图片画廊 */}
              {row.image_urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {row.image_urls.map((u, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={i} src={u} alt="" onClick={() => setLightbox(u)} className="w-20 h-20 object-cover rounded border border-cream-200 cursor-zoom-in" />
                  ))}
                </div>
              )}
              {row.source_text && (
                <div className="mb-2">
                  <button onClick={() => setShowText(showText === row.submission_id ? null : row.submission_id)} className="text-xs text-blue-600 underline">{showText === row.submission_id ? '收起正文素材' : '展开正文素材'}</button>
                  {showText === row.submission_id && <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap text-xs bg-cream-50 p-2 rounded border border-cream-200">{row.source_text}</pre>}
                </div>
              )}

              {/* 操作 */}
              <div className="flex flex-wrap gap-2">
                <button disabled={busyId === row.submission_id} onClick={() => runExtract(row.submission_id)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">AI 抽取</button>
                <button onClick={() => (editing === row.submission_id ? setEditing(null) : startEdit(row))} className="px-3 py-1.5 rounded-lg bg-brown-600 text-white text-sm">{editing === row.submission_id ? '收起编辑' : '校对/录入'}</button>
                <button onClick={() => copyMaterials(row)} className="px-3 py-1.5 rounded-lg bg-cream-100 text-brown-700 text-sm">复制素材包</button>
                {row.review_status !== 'rejected' && <button disabled={busyId === row.submission_id} onClick={() => runReject(row.submission_id)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm">驳回</button>}
              </div>

              {/* 结构化表单 */}
              {editing === row.submission_id && (
                <div className="mt-4 border-t border-cream-100 pt-4">
                  <div className="flex justify-end mb-2">
                    <button onClick={() => { if (!jsonMode) setEditJson(JSON.stringify(form, null, 2)); else { try { setForm(JSON.parse(editJson)); } catch { setMsg('JSON 解析失败'); return; } } setJsonMode(!jsonMode); }} className="text-xs text-blue-600 underline">{jsonMode ? '切换到表单' : '切换到 JSON'}</button>
                  </div>
                  {jsonMode ? (
                    <textarea value={editJson} onChange={(e) => setEditJson(e.target.value)} className="w-full h-80 font-mono text-xs p-3 border border-cream-300 rounded bg-cream-50" />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {BASE_FIELDS.map(f => (
                          <div key={String(f.key)}>
                            <label className="block text-xs text-warm-gray-400 mb-1">{f.label}</label>
                            <input className={inp} value={String(form[f.key] ?? '')} placeholder={f.ph} onChange={(e) => setF(f.key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="block text-xs text-warm-gray-400 mb-1">竞赛项目（每行一个）</label>
                        <textarea className={inp + ' h-20'} value={(form.disciplines || []).join('\n')} onChange={(e) => setF('disciplines', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
                      </div>
                      {/* 组别 */}
                      <div>
                        <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-brown-700">组别 / 报名费 / 奖金</span><button onClick={addCat} className="text-xs text-blue-600">+ 添加组别</button></div>
                        <div className="space-y-2">
                          {(form.categories || []).map((c, i) => (
                            <div key={i} className="border border-cream-200 rounded p-2 bg-cream-50/50">
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                <input className={inp} placeholder="组别名" value={c.name || ''} onChange={(e) => setCat(i, { name: e.target.value })} />
                                <input className={inp} placeholder="项目" value={c.discipline || ''} onChange={(e) => setCat(i, { discipline: e.target.value })} />
                                <input className={inp} placeholder="性别组" value={c.gender_group || ''} onChange={(e) => setCat(i, { gender_group: e.target.value })} />
                                <input className={inp} placeholder="报名费" value={c.fee || ''} onChange={(e) => setCat(i, { fee: e.target.value })} />
                                <input className={inp} placeholder="名额" value={c.quota ?? ''} onChange={(e) => setCat(i, { quota: e.target.value ? Number(e.target.value) : null })} />
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <input className={inp} placeholder="奖金 名次:金额, 如 1:4000, 2:3000" value={fmtPrizes(c.prizes)} onChange={(e) => setCat(i, { prizes: parsePrizes(e.target.value) })} />
                                <button onClick={() => delCat(i)} className="text-xs text-red-500 shrink-0">删除</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* 官员 */}
                      <div>
                        <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-brown-700">技术官员</span><button onClick={addOff} className="text-xs text-blue-600">+ 添加官员</button></div>
                        <div className="space-y-2">
                          {(form.officials || []).map((o, i) => (
                            <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
                              <input className={inp} placeholder="类别" value={o.role_category || ''} onChange={(e) => setOff(i, { role_category: e.target.value })} />
                              <input className={inp} placeholder="职务" value={o.role_title || ''} onChange={(e) => setOff(i, { role_title: e.target.value })} />
                              <input className={inp} placeholder="姓名" value={o.name || ''} onChange={(e) => setOff(i, { name: e.target.value })} />
                              <input className={inp} placeholder="地区/单位" value={o.region || ''} onChange={(e) => setOff(i, { region: e.target.value })} />
                              <button onClick={() => delOff(i)} className="text-xs text-red-500">删除</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* 录入操作 */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <button disabled={busyId === row.submission_id} onClick={() => runIngest(row.submission_id)} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50">录入为新赛事</button>
                    <span className="text-warm-gray-300">或</span>
                    <input className="w-28 px-2 py-1.5 border border-cream-300 rounded text-sm" placeholder="赛事ID" value={supId} onChange={(e) => setSupId(e.target.value)} />
                    <button disabled={busyId === row.submission_id} onClick={() => runSupplement(row.submission_id)} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm disabled:opacity-50">补充到该赛事</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && <div className="text-sm text-warm-gray-400">暂无提报</div>}
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-brown-700">
          <span>共 {total} 条，第 {page} / {totalPages} 页</span>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}
              className="px-3 py-1.5 rounded-lg border border-cream-300 bg-white disabled:opacity-40">上一页</button>
            <button disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
              className="px-3 py-1.5 rounded-lg border border-cream-300 bg-white disabled:opacity-40">下一页</button>
            <span className="ml-2">跳至</span>
            <input value={pageInput} onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') jumpToPage(); }}
              inputMode="numeric"
              className="h-9 w-16 rounded-lg border border-cream-300 bg-white px-2 text-center outline-none focus:border-brown-400" />
            <span>页</span>
            <button onClick={jumpToPage} className="px-3 py-1.5 rounded-lg bg-brown-600 text-white">确定</button>
          </div>
        </div>
      )}

      {/* 图片放大 */}
      {lightbox && (
        <div onClick={() => setLightbox('')} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 cursor-zoom-out">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded" />
        </div>
      )}
    </div>
  );
}
