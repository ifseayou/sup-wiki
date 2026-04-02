'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from './layout';

interface Stats {
  brands: { total: number; draft: number };
  products: { total: number; draft: number };
  athletes: { total: number; draft: number };
  creators: { total: number; draft: number };
  events: { total: number; draft: number };
}

const entityCards = [
  { key: 'brands' as const, label: '品牌', icon: '🏷️', href: '/admin/brands' },
  { key: 'products' as const, label: '产品', icon: '🏄', href: '/admin/products' },
  { key: 'athletes' as const, label: '运动员', icon: '🏆', href: '/admin/athletes' },
  { key: 'creators' as const, label: '博主', icon: '📱', href: '/admin/creators' },
  { key: 'events' as const, label: '赛事', icon: '🗓️', href: '/admin/events' },
];

export default function AdminDashboard() {
  const { token } = useAdminAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [b, p, a, c, e, bd, pd, ad, cd, ed] = await Promise.all([
          fetch('/api/admin/brands?pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/products?pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/athletes?pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/creators?pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/events?pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/brands?status=draft&pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/products?status=draft&pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/athletes?status=draft&pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/creators?status=draft&pageSize=1', { headers }).then(r => r.json()),
          fetch('/api/admin/events?status=draft&pageSize=1', { headers }).then(r => r.json()),
        ]);
        setStats({
          brands: { total: b.total ?? 0, draft: bd.total ?? 0 },
          products: { total: p.total ?? 0, draft: pd.total ?? 0 },
          athletes: { total: a.total ?? 0, draft: ad.total ?? 0 },
          creators: { total: c.total ?? 0, draft: cd.total ?? 0 },
          events: { total: e.total ?? 0, draft: ed.total ?? 0 },
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [token]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brown-800">仪表板</h1>
        <p className="text-warm-gray-400 text-sm mt-1">内容管理概览</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {entityCards.map(card => {
          const s = stats?.[card.key];
          return (
            <Link
              key={card.key}
              href={card.href}
              className="bg-cream-50 border border-cream-200 rounded-xl p-4 hover:border-brown-500 hover:shadow-sm transition-all"
            >
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-xl font-bold text-brown-800">
                {loading ? '—' : s?.total ?? 0}
              </div>
              <div className="text-sm text-warm-gray-500">{card.label}</div>
              {!loading && s && s.draft > 0 && (
                <div className="mt-1.5 text-xs text-amber-600 font-medium">{s.draft} 草稿待审</div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="bg-cream-50 border border-cream-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-brown-800 mb-4">快速操作</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {entityCards.map(card => (
            <Link
              key={card.key}
              href={`${card.href}?action=new`}
              className="flex items-center gap-2 px-4 py-2.5 border border-cream-300 rounded-lg text-sm text-warm-gray-600 hover:border-brown-500 hover:text-brown-600 transition-all"
            >
              <span>{card.icon}</span>
              新建{card.label}
            </Link>
          ))}
          <Link
            href="/admin/import"
            className="flex items-center gap-2 px-4 py-2.5 bg-brown-500 text-white rounded-lg text-sm hover:bg-brown-600 transition-all"
          >
            <span>📥</span>
            批量导入
          </Link>
        </div>
      </div>
    </div>
  );
}
