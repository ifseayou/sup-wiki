'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

interface IdentityRow {
  link_id: number;
  athlete_id: number | null;
  athlete_name: string | null;
  display_name: string;
  gender_hint: string | null;
  team_hint: string | null;
  confidence: string;
  status: string;
  note: string | null;
}

export default function AthleteIdentitiesPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<IdentityRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ status: 'pending' });
    if (search) params.set('search', search);
    fetch(`/api/admin/athlete-identities?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setItems(data.items || []));
  }, [token, search]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brown-800">运动员身份匹配</h1>
          <p className="mt-1 text-sm text-warm-gray-500">查看导入成绩时产生的同名或低置信度候选，后续可在这里扩展合并/拆分操作。</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索姓名 / 队伍" className="h-10 rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm" />
      </div>
      <div className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
            <tr>
              <th className="px-4 py-3">导入姓名</th>
              <th className="px-4 py-3">候选运动员</th>
              <th className="px-4 py-3">性别/组别</th>
              <th className="px-4 py-3">队伍线索</th>
              <th className="px-4 py-3">置信度</th>
              <th className="px-4 py-3">备注</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.link_id} className="border-t border-cream-200">
                <td className="px-4 py-3 font-medium text-brown-800">{item.display_name}</td>
                <td className="px-4 py-3 text-warm-gray-600">{item.athlete_name || (item.athlete_id ? `#${item.athlete_id}` : '-')}</td>
                <td className="px-4 py-3 text-warm-gray-500">{item.gender_hint || '-'}</td>
                <td className="px-4 py-3 text-warm-gray-500">{item.team_hint || '-'}</td>
                <td className="px-4 py-3 text-warm-gray-600">{item.confidence}</td>
                <td className="px-4 py-3 text-warm-gray-500">{item.note || '-'}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-warm-gray-400">暂无待确认身份</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
