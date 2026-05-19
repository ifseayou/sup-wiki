'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserContext';

interface ResultRow {
  result_id: number;
  event_id: number;
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
  time_seconds: number | null;
  points: number | null;
  team_name: string | null;
  source_title: string | null;
  source_url: string | null;
  source_locator: string | null;
  event_name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  star_level: string | null;
  score_coefficient: string | null;
  athlete_name: string | null;
  source_file_url: string | null;
  source_file_name: string | null;
}

const inputStyle = 'h-10 rounded-md border border-[#D8CDBE] bg-[#FEFCF9] px-3 text-sm text-stone-700 outline-none focus:border-[#8B7355] focus:ring-2 focus:ring-[#8B7355]/15';

export default function ResultsPage() {
  const router = useRouter();
  const { token, loading } = useUser();
  const [items, setItems] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    gender: '',
    discipline: '',
    year: '',
    rank_max: '',
    star_level: '',
  });

  useEffect(() => {
    if (!loading && !token) {
      router.replace(`/login?redirect=${encodeURIComponent('/results')}`);
    }
  }, [loading, token, router]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '30' });
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    setError('');
    fetch(`/api/results?${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '成绩查询失败');
        setItems(data.items || []);
        setTotal(Number(data.total || 0));
      })
      .catch((err) => setError(err instanceof Error ? err.message : '成绩查询失败'))
      .finally(() => setFetching(false));
  }, [token, query]);

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  if (loading || !token) {
    return <div className="min-h-[60vh] px-6 py-20 text-center text-stone-500">正在检查登录状态...</div>;
  }

  return (
    <main className="min-h-screen bg-[#F7F2EA]">
      <section className="border-b border-[#E5D9C8] bg-[#2E281F] text-[#F9F3E8]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.28em] text-[#CDBB9E]">Race Intelligence</p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">桨板成绩查询</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#D9CDBA]">
                按运动员、项目、组别和赛事等级筛选成绩，用于查看个人档案、对标目标选手和回溯官方成绩册。
              </p>
            </div>
            <div className="rounded-md border border-[#7D6B52] px-4 py-3 text-sm text-[#E7D9C3]">
              已收录 <span className="text-xl font-semibold text-white">{total}</span> 条成绩
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 grid gap-3 rounded-lg border border-[#DED2C1] bg-[#FFFCF7] p-4 md:grid-cols-[1.5fr_repeat(5,1fr)]">
          <input className={inputStyle} placeholder="运动员 / 队伍 / 赛事" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
          <input className={inputStyle} placeholder="性别组" value={filters.gender} onChange={(e) => setFilter('gender', e.target.value)} />
          <input className={inputStyle} placeholder="项目，如 200米" value={filters.discipline} onChange={(e) => setFilter('discipline', e.target.value)} />
          <input className={inputStyle} placeholder="年份" value={filters.year} onChange={(e) => setFilter('year', e.target.value)} />
          <select className={inputStyle} value={filters.rank_max} onChange={(e) => setFilter('rank_max', e.target.value)}>
            <option value="">全部名次</option>
            <option value="3">前三</option>
            <option value="10">前十</option>
            <option value="30">前三十</option>
          </select>
          <select className={inputStyle} value={filters.star_level} onChange={(e) => setFilter('star_level', e.target.value)}>
            <option value="">全部星级</option>
            <option value="五星+">五星+</option>
            <option value="五星">五星</option>
            <option value="四星+">四星+</option>
            <option value="四星">四星</option>
            <option value="三星">三星</option>
          </select>
        </div>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-hidden rounded-lg border border-[#DED2C1] bg-[#FFFCF7]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[#ECE2D3] text-left text-xs uppercase tracking-wide text-[#6E604E]">
                <tr>
                  <th className="px-4 py-3">运动员</th>
                  <th className="px-4 py-3">赛事</th>
                  <th className="px-4 py-3">项目</th>
                  <th className="px-4 py-3">组别</th>
                  <th className="px-4 py-3 text-center">名次</th>
                  <th className="px-4 py-3 text-right">成绩</th>
                  <th className="px-4 py-3">队伍</th>
                  <th className="px-4 py-3">来源</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.result_id} className="border-t border-[#EEE4D8] hover:bg-[#F8F0E5]">
                    <td className="px-4 py-3 font-medium text-[#34291F]">
                      {row.athlete_id ? <Link href={`/athletes/${row.athlete_id}`} className="hover:text-[#7A6145]">{row.athlete_name || row.athlete_name_snapshot}</Link> : row.athlete_name_snapshot}
                      {row.bib_number && <div className="text-xs font-normal text-stone-400">#{row.bib_number}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/events/${row.event_id}`} className="font-medium text-[#6F563B] hover:text-[#4B3927]">{row.event_name}</Link>
                      <div className="text-xs text-stone-400">{[row.province, row.city].filter(Boolean).join(' · ')} {row.start_date?.slice(0, 10)}</div>
                    </td>
                    <td className="px-4 py-3 text-stone-700">{row.discipline}{row.board_class ? ` / ${row.board_class}` : ''}</td>
                    <td className="px-4 py-3 text-stone-600">{row.gender_group}{row.round_label ? ` · ${row.round_label}` : ''}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#2E281F]">{row.rank_position}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#7A6145]">{row.finish_time}</td>
                    <td className="px-4 py-3 text-stone-500">{row.team_name || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {(row.source_file_url || row.source_url) ? (
                        <a className="text-[#7A6145] hover:text-[#4B3927]" href={row.source_file_url || row.source_url || '#'} target="_blank" rel="noopener noreferrer">
                          {row.source_file_name || row.source_title || '成绩册'}{row.source_locator ? ` · ${row.source_locator}` : ''}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {!fetching && items.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-stone-400">没有匹配的成绩</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {fetching && <div className="border-t border-[#EEE4D8] px-4 py-4 text-center text-sm text-stone-400">加载中...</div>}
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-stone-500">
          <span>第 {page} 页</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="rounded-md border border-[#D8CDBE] px-3 py-2 disabled:opacity-40">上一页</button>
            <button disabled={items.length < 30} onClick={() => setPage((v) => v + 1)} className="rounded-md border border-[#D8CDBE] px-3 py-2 disabled:opacity-40">下一页</button>
          </div>
        </div>
      </section>
    </main>
  );
}
