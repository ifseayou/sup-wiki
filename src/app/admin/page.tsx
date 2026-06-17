'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from './layout';

interface DashboardData {
  todos: {
    pendingAthleteClaims: number;
    pendingResultSubmissions: number;
    reviewingResultSubmissions: number;
    pendingIdentityLinks: number;
    needsReviewResults: number;
    pendingResults: number;
    draftContentTotal: number;
  };
  draftContent: Record<string, number>;
  recentItems: {
    type: string;
    title: string;
    status: string;
    created_at: string;
    href: string;
  }[];
  athleteStats?: {
    total: number;
    claimed: number;
    draft: number;
  };
}

const todoCards = [
  { key: 'pendingAthleteClaims', label: '资料审批', desc: '运动员提交的资料更新', href: '/admin/athlete-claims', tone: 'amber' },
  { key: 'pendingResultSubmissions', label: '成绩册提交', desc: '用户上传等待处理', href: '/admin/event-result-submissions?status=pending', tone: 'brown' },
  { key: 'pendingIdentityLinks', label: '身份匹配', desc: '成绩姓名与运动员档案', href: '/admin/athlete-identities', tone: 'blue' },
  { key: 'needsReviewResults', label: '待核验成绩', desc: '需要人工复核的成绩', href: '/admin/results?review_status=needs_review', tone: 'red' },
];

const quickActions = [
  { label: '新建赛事', href: '/admin/events?action=new', icon: '🗓️' },
  { label: '处理成绩册', href: '/admin/event-result-submissions?status=pending', icon: '📄' },
  { label: '资料审批', href: '/admin/athlete-claims', icon: '✓' },
  { label: '用户管理', href: '/admin/users', icon: '👤' },
];

const statusLabels: Record<string, string> = {
  pending: '待处理',
  reviewing: '处理中',
  approved: '已通过',
  rejected: '已驳回',
  imported: '已入库',
  ignored: '已忽略',
  confirmed: '已确认',
  needs_review: '需复核',
};

const draftLabels: Record<string, string> = {
  brands: '品牌',
  products: '产品',
  athletes: '运动员',
  creators: '博主',
  events: '赛事',
  courses: '课程',
  techniques: '技术动作',
  articles: '文章',
  questions: '题库',
  docs: '学习文档',
  shop: '商城',
};

export default function AdminDashboard() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setError('');
        const res = await fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || '加载失败');
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [token]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brown-800">待办中心</h1>
        <p className="text-warm-gray-400 text-sm mt-1">先处理会影响前台数据质量和用户提交的事项。</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {todoCards.map(card => {
          const count = data?.todos[card.key as keyof DashboardData['todos']];
          return (
            <Link
              key={card.key}
              href={card.href}
              className="bg-cream-50 border border-cream-200 rounded-xl p-5 hover:border-brown-500 hover:shadow-sm transition-all"
            >
              <div className="text-3xl font-bold text-brown-800">{loading ? '—' : count ?? 0}</div>
              <div className="mt-2 text-sm font-semibold text-brown-700">{card.label}</div>
              <div className="mt-1 text-xs leading-5 text-warm-gray-500">{card.desc}</div>
            </Link>
          );
        })}
      </div>

      <section className="mb-8 bg-cream-50 border border-cream-200 rounded-xl p-5">
        <h2 className="mb-4 text-base font-semibold text-brown-800">运动员概览</h2>
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/admin/athletes?status=published"
            className="rounded-xl border border-cream-200 bg-white/60 p-4 transition-all hover:border-brown-500 hover:shadow-sm"
          >
            <div className="text-3xl font-bold text-brown-800">{loading ? '—' : data?.athleteStats?.total ?? 0}</div>
            <div className="mt-1 text-sm font-medium text-brown-700">运动员总数</div>
            <div className="mt-0.5 text-xs text-warm-gray-500">已发布的正式档案</div>
          </Link>
          <Link
            href="/admin/athletes?claimed=1"
            className="rounded-xl border border-cream-200 bg-white/60 p-4 transition-all hover:border-brown-500 hover:shadow-sm"
          >
            <div className="text-3xl font-bold text-brown-800">{loading ? '—' : data?.athleteStats?.claimed ?? 0}</div>
            <div className="mt-1 text-sm font-medium text-brown-700">已绑定运动员</div>
            <div className="mt-0.5 text-xs text-warm-gray-500">用户已认领绑定</div>
          </Link>
          <Link
            href="/admin/athletes?status=draft"
            className="rounded-xl border border-cream-200 bg-white/60 p-4 transition-all hover:border-brown-500 hover:shadow-sm"
          >
            <div className="text-3xl font-bold text-brown-800">{loading ? '—' : data?.athleteStats?.draft ?? data?.draftContent?.athletes ?? 0}</div>
            <div className="mt-1 text-sm font-medium text-brown-700">草稿待完善</div>
            <div className="mt-0.5 text-xs text-warm-gray-500">导入成绩自动生成</div>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5">
        <section className="bg-cream-50 border border-cream-200 rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-brown-800">快速操作</h2>
              <p className="mt-1 text-xs text-warm-gray-400">高频维护入口集中在这里。</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {quickActions.map(action => (
              <Link
                key={action.href}
                href={action.href}
                className="flex h-12 items-center gap-2 rounded-lg border border-cream-300 bg-white/65 px-3 text-sm text-warm-gray-600 transition-all hover:border-brown-500 hover:bg-white hover:text-brown-700"
              >
                <span className="text-base">{action.icon}</span>
                <span className="font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-cream-50 border border-cream-200 rounded-xl p-4">
          <h2 className="text-base font-semibold text-brown-800 mb-3">最近提交</h2>
          <div className="space-y-2">
            {(data?.recentItems || []).map((item, index) => (
              <Link key={`${item.type}-${item.created_at}-${index}`} href={item.href} className="block rounded-lg border border-cream-200 bg-white/60 px-3 py-2.5 hover:border-brown-400">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-brown-600">{item.type}</span>
                  <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-warm-gray-500">{statusLabels[item.status] || item.status || '未知'}</span>
                </div>
                <div className="mt-1 truncate text-sm text-brown-800">{item.title}</div>
              </Link>
            ))}
            {!loading && !data?.recentItems?.length && (
              <div className="rounded-lg border border-cream-200 bg-white/60 px-4 py-6 text-center text-sm text-warm-gray-400">暂无最近提交</div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 bg-cream-50 border border-cream-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-brown-800 mb-4">草稿分布</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {Object.entries(draftLabels).map(([key, label]) => {
            const value = data?.draftContent?.[key] ?? 0;
            return (
              <div key={key} className="rounded-lg border border-cream-200 bg-white/50 px-4 py-3">
                <div className="text-lg font-bold text-brown-800">{loading ? '—' : value}</div>
                <div className="mt-1 text-xs text-warm-gray-500">{label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 bg-cream-50 border border-cream-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-brown-800 mb-4">模块入口</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['赛事成绩', '/admin/events'],
            ['运动员管理', '/admin/athletes'],
            ['内容资料', '/admin/brands'],
            ['学习体系', '/admin/learn-questions'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-2.5 border border-cream-300 rounded-lg text-sm text-warm-gray-600 hover:border-brown-500 hover:text-brown-600 transition-all"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
