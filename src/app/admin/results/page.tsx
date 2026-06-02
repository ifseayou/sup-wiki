'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import AdminFilterSelect from '@/components/admin/AdminFilterSelect';
import ResultStatusBadge from '@/components/ResultStatusBadge';

interface ResultRow {
  result_id: number;
  event_id: number;
  event_name: string;
  start_date: string | null;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  bib_number: string | null;
  gender_group: string;
  discipline: string;
  board_class: string | null;
  round_label: string | null;
  rank_position: number;
  result_label: string | null;
  finish_time: string;
  result_status_code: string | null;
  result_status_note: string | null;
  team_name: string | null;
  nationality_snapshot: string | null;
  display_nationality: string | null;
  display_province: string | null;
  display_city: string | null;
  source_id: number | null;
  source_file_name: string | null;
  review_status: string;
  team_members: unknown;
}

const emptyForm = {
  result_id: '',
  event_id: '',
  athlete_id: '',
  athlete_name_snapshot: '',
  bib_number: '',
  gender_group: '公开组',
  discipline: '',
  board_class: '',
  round_label: '',
  rank_position: '',
  result_label: '',
  finish_time: '',
  result_status_code: '',
  result_status_note: '',
  team_name: '个人',
  nationality_snapshot: '',
  team_members: '',
  source_id: '',
  source_title: '',
  source_locator: '',
  source_url: '',
  source_note: '',
  review_status: 'confirmed',
};

function initialQueryValue(key: string) {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
}

function parseMembers(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!item || typeof item !== 'object') return '';
      const member = item as { name?: unknown; member_name?: unknown };
      return String(member.name || member.member_name || '');
    }).filter(Boolean);
  }
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => item?.name || item?.member_name || '').filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function AdminResultsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<ResultRow[]>([]);
  const [search, setSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [athleteName, setAthleteName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [nationality, setNationality] = useState('');
  const [city, setCity] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [genderGroupFilter, setGenderGroupFilter] = useState('');
  const [statusCode, setStatusCode] = useState('');
  const [reviewStatus, setReviewStatus] = useState(() => initialQueryValue('review_status'));
  const [eventId] = useState(() => initialQueryValue('event_id'));
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [pageInput, setPageInput] = useState('1');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '30' });
    if (search) params.set('search', search);
    if (eventId) params.set('event_id', eventId);
    if (eventSearch) params.set('event_search', eventSearch);
    if (athleteName) params.set('athlete_name', athleteName);
    if (memberName) params.set('member_name', memberName);
    if (nationality) params.set('nationality', nationality);
    if (city) params.set('city', city);
    if (disciplineFilter) params.set('discipline', disciplineFilter);
    if (genderGroupFilter) params.set('gender_group', genderGroupFilter);
    if (statusCode) params.set('result_status_code', statusCode);
    if (reviewStatus) params.set('review_status', reviewStatus);
    return params.toString();
  }, [athleteName, city, disciplineFilter, eventId, eventSearch, genderGroupFilter, memberName, nationality, page, reviewStatus, search, statusCode]);

  async function load() {
    setLoading(true);
    const data = await fetch(`/api/admin/results?${query}`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.json());
    setItems(data.items || []);
    setTotal(Number(data.total || 0));
    const nextTotalPages = Math.max(1, Number(data.totalPages || 1));
    setTotalPages(nextTotalPages);
    setPageInput(String(Math.min(page, nextTotalPages)));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, token]);

  function edit(row: ResultRow) {
    setForm({
      ...emptyForm,
      result_id: String(row.result_id),
      event_id: String(row.event_id || ''),
      athlete_id: String(row.athlete_id || ''),
      athlete_name_snapshot: row.athlete_name_snapshot || '',
      bib_number: row.bib_number || '',
      gender_group: row.gender_group || '公开组',
      discipline: row.discipline || '',
      board_class: row.board_class || '',
      round_label: row.round_label || '',
      rank_position: String(row.rank_position || ''),
      result_label: row.result_label || '',
      finish_time: row.finish_time || '',
      result_status_code: row.result_status_code || '',
      result_status_note: row.result_status_note || '',
      team_name: row.team_name || '个人',
      nationality_snapshot: row.nationality_snapshot || row.display_nationality || '',
      team_members: parseMembers(row.team_members).join('、'),
      source_id: String(row.source_id || ''),
      review_status: row.review_status || 'confirmed',
    });
    setModalOpen(true);
  }

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm);
  }

  async function save() {
    setMessage('');
    const payload = {
      ...form,
      event_id: Number(form.event_id),
      athlete_id: form.athlete_id ? Number(form.athlete_id) : null,
      rank_position: Number(form.rank_position),
      source_id: form.source_id ? Number(form.source_id) : null,
      team_members: form.team_members,
    };
    const editing = Boolean(form.result_id);
    const res = await fetch(editing ? `/api/admin/results/${form.result_id}` : '/api/admin/results', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || '保存失败');
      return;
    }
    setMessage(editing ? '已更新成绩' : '已创建成绩');
    closeModal();
    await load();
  }

  async function remove(row: ResultRow) {
    if (!window.confirm(`确认删除 ${row.athlete_name_snapshot} 的这条成绩？`)) return;
    const res = await fetch(`/api/admin/results/${row.result_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await load();
  }

  const inputClass = 'h-10 rounded-lg border border-cream-300 bg-white px-3 text-sm text-brown-800 outline-none focus:border-brown-400';
  const filterInputClass = 'h-10 rounded-lg border border-[#D8CCBA] bg-white px-3 text-sm text-[#3A2F24] outline-none transition-all placeholder:text-[#B1A69A] focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10';

  function resetFilters() {
    setSearch('');
    setEventSearch('');
    setAthleteName('');
    setMemberName('');
    setNationality('');
    setCity('');
    setDisciplineFilter('');
    setGenderGroupFilter('');
    setStatusCode('');
    setReviewStatus('');
    setPage(1);
  }

  function jumpToPage() {
    const target = Math.min(totalPages, Math.max(1, Number(pageInput) || 1));
    setPage(target);
    setPageInput(String(target));
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brown-800">运动员成绩明细</h1>
          <p className="mt-1 text-sm text-warm-gray-500">维护单人成绩、团队赛成员、成绩状态和原始来源。</p>
        </div>
        <button onClick={openCreate} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0F5C52] px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0B4A43]">
          + 新增成绩
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] p-4 shadow-[0_10px_28px_rgba(74,58,38,0.04)]">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="全局搜索" className={filterInputClass} />
          <input value={eventSearch} onChange={(e) => { setEventSearch(e.target.value); setPage(1); }} placeholder="赛事名称" className={filterInputClass} />
          <input value={athleteName} onChange={(e) => { setAthleteName(e.target.value); setPage(1); }} placeholder="运动员名称" className={filterInputClass} />
          <input value={memberName} onChange={(e) => { setMemberName(e.target.value); setPage(1); }} placeholder="成员姓名" className={filterInputClass} />
          <input value={nationality} onChange={(e) => { setNationality(e.target.value); setPage(1); }} placeholder="国籍" className={filterInputClass} />
          <input value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} placeholder="城市" className={filterInputClass} />
          <input value={disciplineFilter} onChange={(e) => { setDisciplineFilter(e.target.value); setPage(1); }} placeholder="项目" className={filterInputClass} />
          <input value={genderGroupFilter} onChange={(e) => { setGenderGroupFilter(e.target.value); setPage(1); }} placeholder="组别" className={filterInputClass} />
          <AdminFilterSelect
            value={statusCode}
            placeholder="全部状态码"
            onChange={(value) => { setStatusCode(value); setPage(1); }}
            options={[
              { value: '', label: '全部状态码' },
              ...['DNS', 'DNF', 'DQ', 'DSQ', 'DNQ', 'OTL'].map((code) => ({ value: code, label: code })),
            ]}
          />
          <AdminFilterSelect
            value={reviewStatus}
            placeholder="全部复核状态"
            onChange={(value) => { setReviewStatus(value); setPage(1); }}
            options={[
              { value: '', label: '全部复核状态' },
              { value: 'confirmed', label: '已确认' },
              { value: 'needs_review', label: '需复核' },
              { value: 'pending', label: '待处理' },
            ]}
          />
          <button onClick={resetFilters} className="h-10 rounded-lg border border-[#D8CCBA] bg-white px-3 text-sm text-[#6B5E50] transition hover:border-[#0F5C52]">重置筛选</button>
          <div className="flex h-10 items-center justify-center rounded-lg border border-[#E8DDCF] bg-[#F8F3EC] px-3 text-sm text-[#8B8175]">
            共 <span className="ml-1 font-semibold text-[#263D36]">{total}</span> 条
          </div>
        </div>
      </div>

      {message && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{message}</div>}

      <div className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
            <tr>
              <th className="px-4 py-3">运动员 / 成员</th>
              <th className="px-4 py-3">国籍 / 城市</th>
              <th className="px-4 py-3">赛事</th>
              <th className="px-4 py-3">项目</th>
              <th className="px-4 py-3">组别</th>
              <th className="px-4 py-3">名次</th>
              <th className="px-4 py-3">成绩</th>
              <th className="px-4 py-3">队伍</th>
              <th className="px-4 py-3">来源</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const members = parseMembers(row.team_members);
              return (
                <tr key={row.result_id} className="border-t border-cream-200 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-brown-800">{row.athlete_name_snapshot}</div>
                    {members.length > 0 && <div className="mt-1 max-w-xs text-xs text-warm-gray-500">成员：{members.join('、')}</div>}
                  </td>
                  <td className="px-4 py-3 text-warm-gray-600">
                    <div>{row.display_nationality || row.nationality_snapshot || '-'}</div>
                    <div className="mt-1 text-xs text-warm-gray-400">{[row.display_province, row.display_city].filter(Boolean).join(' / ') || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-warm-gray-600">{row.event_name}<div className="text-xs text-warm-gray-400">{row.start_date?.slice(0, 10) || '-'}</div></td>
                  <td className="px-4 py-3 text-warm-gray-600">{row.discipline}{row.board_class ? ` / ${row.board_class}` : ''}</td>
                  <td className="px-4 py-3 text-warm-gray-600">{row.gender_group}{row.round_label ? ` · ${row.round_label}` : ''}</td>
                  <td className="px-4 py-3 font-semibold text-brown-800">{row.rank_position}</td>
                  <td className="px-4 py-3 font-semibold text-brown-700"><ResultStatusBadge finishTime={row.finish_time} statusCode={row.result_status_code} statusNote={row.result_status_note} /></td>
                  <td className="px-4 py-3 text-warm-gray-500">{row.team_name || '个人'}</td>
                  <td className="px-4 py-3 text-xs text-warm-gray-500">{row.source_file_name || row.source_id || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => edit(row)} className="mr-3 text-xs text-brown-500">编辑</button>
                    <button onClick={() => remove(row)} className="text-xs text-red-500">删除</button>
                  </td>
                </tr>
              );
            })}
            {!loading && !items.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-warm-gray-400">暂无成绩明细</td></tr>}
          </tbody>
        </table>
        {loading && <div className="border-t border-cream-200 py-4 text-center text-sm text-warm-gray-400">加载中...</div>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-warm-gray-500">
        <span>共 {total} 条，第 {page} / {totalPages} 页</span>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="rounded-lg border border-cream-300 px-3 py-2 disabled:opacity-40">上一页</button>
          <div className="flex items-center gap-2">
            <span>跳至</span>
            <input
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') jumpToPage();
              }}
              className="h-9 w-20 rounded-lg border border-cream-300 bg-white px-2 text-center text-sm text-brown-800 outline-none focus:border-brown-400"
              inputMode="numeric"
            />
            <button onClick={jumpToPage} className="rounded-lg border border-cream-300 px-3 py-2 text-brown-700">确定</button>
          </div>
          <button disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))} className="rounded-lg border border-cream-300 px-3 py-2 disabled:opacity-40">下一页</button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-t-2xl border border-cream-200 bg-cream-50 shadow-xl md:rounded-2xl">
            <div className="flex items-center justify-between border-b border-cream-200 px-6 py-4">
              <div>
                <h2 className="font-semibold text-brown-800">{form.result_id ? `编辑成绩 #${form.result_id}` : '新增成绩'}</h2>
                <p className="mt-1 text-xs text-warm-gray-400">维护赛事、运动员、国籍、组别、成绩状态和来源。</p>
              </div>
              <button onClick={closeModal} className="text-xl leading-none text-warm-gray-400 hover:text-brown-600">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input className={inputClass} placeholder="赛事 ID" value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })} />
                <input className={inputClass} placeholder="运动员 ID（可空）" value={form.athlete_id} onChange={(e) => setForm({ ...form, athlete_id: e.target.value })} />
                <input className={inputClass} placeholder="运动员/团队代表" value={form.athlete_name_snapshot} onChange={(e) => setForm({ ...form, athlete_name_snapshot: e.target.value })} />
                <input className={inputClass} placeholder="国籍" value={form.nationality_snapshot} onChange={(e) => setForm({ ...form, nationality_snapshot: e.target.value })} />
                <input className={inputClass} placeholder="项目" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} />
                <input className={inputClass} placeholder="组别" value={form.gender_group} onChange={(e) => setForm({ ...form, gender_group: e.target.value })} />
                <input className={inputClass} placeholder="板型" value={form.board_class} onChange={(e) => setForm({ ...form, board_class: e.target.value })} />
                <input className={inputClass} placeholder="轮次" value={form.round_label} onChange={(e) => setForm({ ...form, round_label: e.target.value })} />
                <input className={inputClass} placeholder="名次" value={form.rank_position} onChange={(e) => setForm({ ...form, rank_position: e.target.value })} />
                <input className={inputClass} placeholder="成绩" value={form.finish_time} onChange={(e) => setForm({ ...form, finish_time: e.target.value })} />
                <input className={inputClass} placeholder="状态码 DNS/DNF/DQ" value={form.result_status_code} onChange={(e) => setForm({ ...form, result_status_code: e.target.value.toUpperCase() })} />
                <input className={inputClass} placeholder="状态说明" value={form.result_status_note} onChange={(e) => setForm({ ...form, result_status_note: e.target.value })} />
                <input className={inputClass} placeholder="队伍" value={form.team_name} onChange={(e) => setForm({ ...form, team_name: e.target.value })} />
                <input className={inputClass} placeholder="队员/成员姓名，多人用顿号或逗号分隔" value={form.team_members} onChange={(e) => setForm({ ...form, team_members: e.target.value })} />
                <input className={inputClass} placeholder="来源 ID" value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })} />
                <input className={inputClass} placeholder="来源标题" value={form.source_title} onChange={(e) => setForm({ ...form, source_title: e.target.value })} />
                <input className={inputClass} placeholder="来源页码 / 定位" value={form.source_locator} onChange={(e) => setForm({ ...form, source_locator: e.target.value })} />
                <input className={inputClass} placeholder="来源 URL" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} />
                <input className={inputClass} placeholder="备注" value={form.source_note} onChange={(e) => setForm({ ...form, source_note: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-cream-200 px-6 py-4">
              {message && <span className="text-sm text-warm-gray-500">{message}</span>}
              <div className="flex-1" />
              <button onClick={() => setForm(emptyForm)} className="rounded-lg border border-cream-300 px-4 py-2 text-sm text-brown-700">清空</button>
              <button onClick={closeModal} className="rounded-lg border border-cream-300 px-4 py-2 text-sm text-warm-gray-600">取消</button>
              <button onClick={save} className="rounded-lg bg-brown-500 px-4 py-2 text-sm text-white hover:bg-brown-600">保存成绩</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
