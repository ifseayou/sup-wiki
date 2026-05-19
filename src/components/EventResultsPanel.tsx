'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/components/UserContext';

interface EventResultRow {
  result_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  gender_group: string;
  discipline: string;
  round_label: string | null;
  rank_position: number;
  result_label: string | null;
  finish_time: string;
  athlete_name: string | null;
  source_file_url: string | null;
  source_file_name: string | null;
  source_url: string | null;
  source_title: string | null;
  source_locator: string | null;
}

export default function EventResultsPanel({ eventId }: { eventId: number }) {
  const { token, loading } = useUser();
  const pathname = usePathname();
  const [items, setItems] = useState<EventResultRow[]>([]);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    fetch(`/api/events/${eventId}/results`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '赛事成绩加载失败');
        setItems(data.items || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '赛事成绩加载失败'))
      .finally(() => setFetching(false));
  }, [eventId, token]);

  const groupedResults = useMemo(() => items.reduce<Record<string, Record<string, EventResultRow[]>>>((acc, item) => {
    const groupName = item.gender_group || '公开组';
    const discipline = item.discipline || '未分项目';
    acc[groupName] ||= {};
    acc[groupName][discipline] ||= [];
    acc[groupName][discipline].push(item);
    return acc;
  }, {}), [items]);

  if (loading) {
    return <div className="mb-6 rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6 text-sm text-stone-500">正在检查登录状态...</div>;
  }

  if (!token) {
    return (
      <div className="mb-6 rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6">
        <h2 className="mb-2 text-lg font-semibold text-stone-800">赛事成绩档案</h2>
        <p className="mb-4 text-sm text-stone-500">成绩明细和原始成绩册是登录用户可见内容。</p>
        <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="inline-flex rounded-lg bg-[#8B7355] px-4 py-2 text-sm font-medium text-white hover:bg-[#6F5B42]">
          登录后查看
        </Link>
      </div>
    );
  }

  if (error) {
    return <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  if (fetching) {
    return <div className="mb-6 rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6 text-sm text-stone-500">成绩加载中...</div>;
  }

  if (!items.length) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-semibold text-stone-800">赛事成绩档案</h2>
      <div className="space-y-4">
        {Object.entries(groupedResults).map(([groupName, disciplines]) => (
          <div key={groupName} className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5">
            <div className="mb-4 text-sm font-medium text-[#7A6145]">{groupName}</div>
            <div className="space-y-4">
              {Object.entries(disciplines).map(([discipline, rows]) => (
                <div key={discipline}>
                  <div className="mb-2 text-sm text-stone-500">{discipline}</div>
                  <div className="overflow-x-auto rounded-lg border border-[#E8DED1]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5F1EB] text-stone-500">
                        <tr>
                          <th className="px-4 py-3 text-left">名次</th>
                          <th className="px-4 py-3 text-left">运动员</th>
                          <th className="px-4 py-3 text-left">轮次</th>
                          <th className="px-4 py-3 text-left">说明</th>
                          <th className="px-4 py-3 text-right">耗时</th>
                          <th className="px-4 py-3 text-left">来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.result_id} className="border-t border-[#EEE4D8]">
                            <td className="px-4 py-3 font-medium text-stone-700">{row.rank_position}</td>
                            <td className="px-4 py-3 text-stone-700">
                              {row.athlete_id ? (
                                <Link href={`/athletes/${row.athlete_id}`} className="text-[#7A6145] hover:text-[#5E4A33]">
                                  {row.athlete_name || row.athlete_name_snapshot}
                                </Link>
                              ) : row.athlete_name_snapshot}
                            </td>
                            <td className="px-4 py-3 text-stone-500">{row.round_label || '-'}</td>
                            <td className="px-4 py-3 text-stone-500">{row.result_label || '-'}</td>
                            <td className="px-4 py-3 text-right font-medium text-[#8B7355]">{row.finish_time}</td>
                            <td className="px-4 py-3 text-xs">
                              {(row.source_file_url || row.source_url) ? (
                                <a href={row.source_file_url || row.source_url || '#'} target="_blank" rel="noopener noreferrer" className="text-[#7A6145] hover:text-[#5E4A33]">
                                  {row.source_file_name || row.source_title || '成绩册'}{row.source_locator ? ` · ${row.source_locator}` : ''}
                                </a>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
