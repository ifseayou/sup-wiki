'use client';

import { useMemo, useState } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/components/UserContext';

const requestLabels: Record<string, string> = {
  correction: '我要更正',
  hide_athlete: '我要隐藏',
  hide_results_points: '我要隐藏成绩&积分',
  restore_results_points: '我要公开成绩&积分',
};

function PrivacyRequestContent() {
  const searchParams = useSearchParams();
  const { token, loading } = useUser();
  const requestType = searchParams.get('request_type') || 'correction';
  const targetType = searchParams.get('target_type') || 'athlete';
  const targetId = searchParams.get('target_id') || '';
  const title = searchParams.get('title') || '';
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const label = requestLabels[requestType] || '提交请求';
  const loginHref = useMemo(() => `/login?redirect=${encodeURIComponent(`/privacy-request?${searchParams.toString()}`)}`, [searchParams]);

  async function submit() {
    if (!token) return;
    setSubmitting(true);
    setMessage('');
    const res = await fetch('/api/user/privacy-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        request_type: requestType,
        target_type: targetType,
        target_id: targetId,
        athlete_id: targetType === 'athlete' ? targetId : searchParams.get('athlete_id'),
        result_id: targetType === 'result' ? targetId : searchParams.get('result_id'),
        event_id: searchParams.get('event_id'),
        description,
        contact,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setMessage(data.error || '提交失败');
      return;
    }
    setMessage('已提交，管理员会在后台处理。');
    setDescription('');
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/data-privacy" className="text-sm text-[#8A6A45] no-underline hover:underline">数据与隐私说明</Link>
      <section className="mt-5 rounded-2xl border border-[#E0D4C6] bg-[#FEFCF9] p-6 shadow-[0_18px_42px_rgba(73,48,25,0.07)]">
        <h1 className="text-3xl font-bold text-[#2A2118]">{label}</h1>
        <p className="mt-2 text-sm text-[#7B6D5E]">{title || `对象：${targetType} #${targetId}`}</p>
        {!loading && !token ? (
          <div className="mt-6 rounded-xl border border-[#E8D9C4] bg-[#FFF8ED] p-4 text-sm text-[#6B4A24]">
            请先登录后提交隐私或更正请求。
            <Link href={loginHref} className="ml-3 font-semibold text-[#6B3E1E]">去登录</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={7} placeholder="请说明你希望更正或隐藏的原因，越具体越容易处理。" className="w-full rounded-xl border border-[#D8CDBE] bg-white px-4 py-3 text-sm outline-none focus:border-[#8B7355]" />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="联系方式（可选，仅管理员审核使用）" className="h-12 rounded-xl border border-[#D8CDBE] bg-white px-4 text-sm outline-none focus:border-[#8B7355]" />
            {message && <div className="rounded-lg bg-[#F7F1E8] px-3 py-2 text-sm text-[#6B4A24]">{message}</div>}
            <button disabled={submitting || !description.trim()} onClick={submit} className="h-12 rounded-xl bg-[#6B3E1E] px-5 text-sm font-semibold text-white disabled:opacity-45">
              {submitting ? '提交中...' : '提交请求'}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default function PrivacyRequestPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-10 text-sm text-[#7B6D5E]">正在加载...</main>}>
      <PrivacyRequestContent />
    </Suspense>
  );
}
