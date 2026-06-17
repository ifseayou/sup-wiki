'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

interface RecentResult {
  event_name: string;
  start_date: string | null;
  discipline: string | null;
  gender_group: string | null;
  rank_position: number | null;
  finish_time: string | null;
  result_status_code: string | null;
}
interface Candidate {
  athlete_id: number;
  name: string;
  status: string;
  is_claimed: boolean;
  result_count: number;
  gender: string | null;
  nationality: string | null;
  province: string | null;
  city: string | null;
  bio: string | null;
  photo: string | null;
  created_at: string | null;
  recent_results: RecentResult[];
}
interface SourceResult {
  result_id: number;
  event_name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  bib_number: string | null;
  gender_group: string | null;
  discipline: string | null;
  board_class: string | null;
  round_label: string | null;
  rank_position: number | null;
  finish_time: string | null;
  result_status_code: string | null;
  team_name: string | null;
  nationality_snapshot: string | null;
}
interface IdentityRow {
  link_id: number;
  athlete_id: number | null;
  athlete_name: string | null;
  athlete_admin_display_name: string | null;
  display_name: string;
  gender_hint: string | null;
  team_hint: string | null;
  nationality_hint: string | null;
  confidence: string;
  status: string;
  note: string | null;
  candidates: Candidate[];
  source_results: SourceResult[];
}

const GENDER_LABEL: Record<string, string> = { male: '男', female: '女', mixed: '混合', unknown: '未知' };

function rankText(r: RecentResult | SourceResult): string {
  if (r.result_status_code) return r.result_status_code;
  if (r.rank_position != null && r.rank_position > 0 && r.rank_position < 9000) return `第${r.rank_position}名`;
  return '-';
}

export default function AthleteIdentitiesPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<IdentityRow[]>([]);
  const [search, setSearch] = useState('');
  const [keepSel, setKeepSel] = useState<Record<number, number>>({}); // link_id → 选中的保留 athlete_id
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // `${link_id}-${athlete_id}` → 展开档案详情
  const [showHelp, setShowHelp] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams({ status: 'pending' });
    if (search) params.set('search', search);
    fetch(`/api/admin/athlete-identities?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.items as IdentityRow[]) || [];
        setItems(rows);
        // 默认保留：优先「已认领」，否则第一个 published，否则首个
        const sel: Record<number, number> = {};
        for (const r of rows) {
          const cs = r.candidates || [];
          const pick = cs.find((c) => c.is_claimed) || cs.find((c) => c.status === 'published') || cs[0];
          if (pick) sel[r.link_id] = pick.athlete_id;
        }
        setKeepSel(sel);
      })
      .catch((e) => setMsg(e.message));
  }, [token, search]);
  useEffect(() => { load(); }, [load]);

  async function doMerge(row: IdentityRow) {
    const keep = keepSel[row.link_id];
    if (!keep) { setMsg('请先选择要保留的运动员'); return; }
    const mergeIds = (row.candidates || []).filter((c) => c.athlete_id !== keep && c.status === 'draft').map((c) => c.athlete_id);
    if (!confirm(`确认合并？保留 #${keep}，并把草稿档案 ${mergeIds.length ? mergeIds.map((i) => '#' + i).join('、') : '（无）'} 及未关联的同名成绩并入它。`)) return;
    setBusyId(row.link_id); setMsg('');
    try {
      const res = await fetch(`/api/admin/athlete-identities/${row.link_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'merge', keep_athlete_id: keep, merge_athlete_ids: mergeIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '合并失败');
      setMsg('合并完成，成绩已归并到保留档案'); load();
    } catch (e) { setMsg('合并失败：' + (e as Error).message); } finally { setBusyId(null); }
  }

  async function doReject(row: IdentityRow) {
    if (!confirm('确认驳回该候选？')) return;
    setBusyId(row.link_id); setMsg('');
    try {
      const res = await fetch(`/api/admin/athlete-identities/${row.link_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'reject' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '驳回失败');
      setMsg('已驳回'); load();
    } catch (e) { setMsg('驳回失败：' + (e as Error).message); } finally { setBusyId(null); }
  }

  return (
    <div className="p-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brown-800">运动员身份匹配</h1>
          <p className="mt-1 text-sm text-warm-gray-500">导入成绩时产生的同名候选。结合下方<strong>本次来源</strong>与候选档案<strong>历史成绩</strong>判断是否同一人，选择要保留的正式档案后确认合并。</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索姓名 / 队伍" className="h-10 rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm" />
      </div>

      {/* 置信度算法说明 */}
      <button onClick={() => setShowHelp((v) => !v)} className="mb-3 text-xs text-blue-700 underline">
        {showHelp ? '收起' : '置信度是怎么算的？'}
      </button>
      {showHelp && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs leading-6 text-warm-gray-600">
          <div className="mb-1 font-semibold text-brown-700">置信度仅按「同名档案数量」规则给出，并不比对性别/队伍/号码牌：</div>
          <div>· <b>0.85</b>：库中<b>恰好一个</b>同名档案 —— 很可能是同一人，但仍需人工确认。</div>
          <div>· <b>0.45</b>：库中<b>多个</b>同名档案 —— 必须人工挑选到底是哪一个。</div>
          <div>· <b>0.80 / 0.82</b>：库中<b>没有</b>同名 —— 导入时自动建了草稿档案，待补全或与已有人合并。</div>
          <div>· <b>0.95</b>：此前已确认过的同名链接，自动复用。</div>
          <div className="mt-1 text-warm-gray-500">所以请务必用下面的「本次来源」（赛事/组别/号码牌/成绩）与候选档案的历史成绩做对比，再决定合并。</div>
        </div>
      )}

      {msg && <div className="mb-3 rounded px-3 py-2 text-sm text-brown-700 bg-cream-100">{msg}</div>}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.link_id} className="rounded-xl border border-cream-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-brown-800">{item.display_name}</span>
              <span className="text-warm-gray-400">置信度 {item.confidence}</span>
              {item.gender_hint && <span className="text-warm-gray-400">· {item.gender_hint}</span>}
              {item.team_hint && <span className="text-warm-gray-400">· 队伍 {item.team_hint}</span>}
              {item.nationality_hint && <span className="text-warm-gray-400">· {item.nationality_hint}</span>}
            </div>
            <div className="mb-3 text-xs text-warm-gray-500">{item.note || ''}</div>

            {/* 本次导入来源成绩 */}
            <div className="mb-3 rounded-lg border border-cream-200 bg-cream-50 p-3">
              <div className="mb-1.5 text-xs font-semibold text-brown-700">本次导入来源（未关联的同名成绩）</div>
              {(item.source_results || []).length === 0 && <div className="text-xs text-warm-gray-400">无可展示的来源成绩</div>}
              <div className="space-y-1.5">
                {(item.source_results || []).map((s) => (
                  <div key={s.result_id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-warm-gray-600">
                    <span className="font-medium text-brown-700">{s.event_name}</span>
                    {s.start_date && <span className="text-warm-gray-400">{String(s.start_date).slice(0, 10)}</span>}
                    {(s.city || s.province) && <span className="text-warm-gray-400">{s.province || ''}{s.city || ''}</span>}
                    {s.gender_group && <span className="rounded bg-cream-100 px-1.5 py-0.5">{s.gender_group}</span>}
                    {s.discipline && <span className="rounded bg-cream-100 px-1.5 py-0.5">{s.discipline}</span>}
                    {s.board_class && <span className="rounded bg-cream-100 px-1.5 py-0.5">{s.board_class}</span>}
                    {s.bib_number && <span className="text-brown-600">号码牌 {s.bib_number}</span>}
                    <span className="text-brown-600">{rankText(s)}</span>
                    {s.finish_time && <span className="text-warm-gray-500">{s.finish_time}</span>}
                    {s.team_name && s.team_name !== '个人' && <span className="text-warm-gray-400">队伍 {s.team_name}</span>}
                    {s.nationality_snapshot && <span className="text-warm-gray-400">{s.nationality_snapshot}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* 候选档案 */}
            <div className="mb-3 space-y-2">
              <div className="text-xs text-warm-gray-500">同名档案（选保留项，可展开看历史成绩对比）：</div>
              {(item.candidates || []).length === 0 && <div className="text-xs text-warm-gray-400">无同名档案</div>}
              {(item.candidates || []).map((c) => {
                const ek = `${item.link_id}-${c.athlete_id}`;
                const isOpen = !!expanded[ek];
                return (
                  <div key={c.athlete_id} className="rounded-lg border border-cream-200 bg-white">
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <input type="radio" name={`keep-${item.link_id}`} checked={keepSel[item.link_id] === c.athlete_id}
                        onChange={() => setKeepSel((p) => ({ ...p, [item.link_id]: c.athlete_id }))} />
                      <span className="text-brown-800">{c.name} <span className="text-warm-gray-400">#{c.athlete_id}</span></span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${c.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{c.status === 'published' ? '正式' : '草稿'}</span>
                      {c.is_claimed && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">已认领</span>}
                      {c.gender && <span className="text-xs text-warm-gray-500">{GENDER_LABEL[c.gender] || c.gender}</span>}
                      {(c.province || c.city) && <span className="text-xs text-warm-gray-500">{c.province || ''}{c.city || ''}</span>}
                      {c.nationality && <span className="text-xs text-warm-gray-400">{c.nationality}</span>}
                      <span className="text-xs text-warm-gray-400">{c.result_count} 条成绩</span>
                      <button onClick={() => setExpanded((p) => ({ ...p, [ek]: !isOpen }))} className="ml-auto text-xs text-blue-700 underline">
                        {isOpen ? '收起详情' : '档案详情'}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-cream-100 px-3 py-2 text-xs text-warm-gray-600">
                        {c.bio && <div className="mb-1.5 text-warm-gray-500">{c.bio}</div>}
                        {c.created_at && <div className="mb-1.5 text-warm-gray-400">档案创建：{String(c.created_at).slice(0, 10)}</div>}
                        <div className="mb-1 font-medium text-brown-700">近期历史成绩</div>
                        {(c.recent_results || []).length === 0 && <div className="text-warm-gray-400">暂无已关联成绩</div>}
                        {(c.recent_results || []).map((r, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span className="text-brown-700">{r.event_name}</span>
                            {r.start_date && <span className="text-warm-gray-400">{String(r.start_date).slice(0, 10)}</span>}
                            {r.gender_group && <span className="text-warm-gray-400">{r.gender_group}</span>}
                            {r.discipline && <span className="text-warm-gray-400">{r.discipline}</span>}
                            <span className="text-brown-600">{rankText(r)}</span>
                            {r.finish_time && <span className="text-warm-gray-500">{r.finish_time}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button disabled={busyId === item.link_id} onClick={() => doMerge(item)} className="rounded-lg bg-brown-600 px-4 py-1.5 text-sm text-white disabled:opacity-50">确认合并</button>
              <button disabled={busyId === item.link_id} onClick={() => doReject(item)} className="rounded-lg border border-cream-300 px-4 py-1.5 text-sm text-brown-700 disabled:opacity-50">驳回</button>
            </div>
          </div>
        ))}
        {!items.length && <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-10 text-center text-warm-gray-400">暂无待确认身份</div>}
      </div>
    </div>
  );
}
