'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useUser } from '@/components/UserContext';

function ClubClaimForm() {
  const searchParams = useSearchParams();
  const { user, token, loading } = useUser();
  const [clubName, setClubName] = useState(searchParams.get('club_name') || searchParams.get('team_name') || '');
  const [role, setRole] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [aliasNames, setAliasNames] = useState(searchParams.get('team_name') || '');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loginHref = useMemo(() => {
    const query = searchParams.toString();
    const redirect = `/clubs/claim${query ? `?${query}` : ''}`;
    return `/login?redirect=${encodeURIComponent(redirect)}`;
  }, [searchParams]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setMessage('');
    setError('');
    const form = new FormData();
    form.set('club_name', clubName);
    form.set('submitted_role', role);
    form.set('contact_info', contactInfo);
    form.set('alias_names', aliasNames);
    form.set('claim_note', note);
    const aliasId = searchParams.get('alias_id');
    const clubId = searchParams.get('club_id');
    if (aliasId) form.set('alias_id', aliasId);
    if (clubId) form.set('club_id', clubId);
    files.forEach((file) => form.append('proof_images', file));

    try {
      const res = await fetch('/api/user/club-claims', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '提交失败，请稍后重试');
        return;
      }
      setMessage('认领申请已提交，管理员审核后会完成绑定。遇到问题可联系客服微信：i_add_u');
      setFiles([]);
      setNote('');
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#2E2118]">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/clubs" className="text-sm text-[#8A735C] no-underline">← 返回俱乐部库</Link>
        <div className="mt-8 rounded-2xl border border-[#E2D5C5] bg-[#FEFCF9] p-6 shadow-[0_16px_36px_rgba(69,45,22,0.08)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#987D59]">Club Claim</p>
          <h1 className="mt-3 text-3xl font-bold">认领俱乐部 / 队伍</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#655D56]">
            成绩册中的“队伍”会先进入待认领池。提交后不会自动公开修改资料，管理员会核对证明材料，再绑定到正式俱乐部主页。
          </p>

          {loading ? (
            <div className="mt-8 rounded-xl border border-[#E0D8CC] bg-white p-8 text-sm text-[#8A8078]">加载中...</div>
          ) : !user ? (
            <div className="mt-8 rounded-xl border border-[#E0D8CC] bg-white p-8">
              <h2 className="text-lg font-semibold">请先登录后认领</h2>
              <p className="mt-2 text-sm leading-7 text-[#655D56]">认领需要绑定用户账号，便于后续确认负责人身份和反馈审核进度。</p>
              <Link href={loginHref} className="mt-6 inline-flex rounded-lg bg-[#6B3E1E] px-5 py-2.5 text-sm font-semibold text-white no-underline">登录后认领</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">俱乐部 / 队伍名称</span>
                <input value={clubName} onChange={(e) => setClubName(e.target.value)} required maxLength={200} className="h-11 rounded-lg border border-[#E0D8CC] bg-white px-3 text-sm outline-none focus:border-[#8B7355]" />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">你的身份</span>
                  <input value={role} onChange={(e) => setRole(e.target.value)} required maxLength={100} placeholder="负责人 / 教练 / 队长 / 管理员" className="h-11 rounded-lg border border-[#E0D8CC] bg-white px-3 text-sm outline-none focus:border-[#8B7355]" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">联系方式</span>
                  <input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} required maxLength={255} placeholder="微信 / 手机 / 邮箱，前台不会公开" className="h-11 rounded-lg border border-[#E0D8CC] bg-white px-3 text-sm outline-none focus:border-[#8B7355]" />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">曾用队伍名 / 成绩册队伍名</span>
                <textarea value={aliasNames} onChange={(e) => setAliasNames(e.target.value)} rows={3} className="rounded-lg border border-[#E0D8CC] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B7355]" placeholder="一行一个，或用逗号分隔" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">证明图片</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 8))} className="rounded-lg border border-dashed border-[#C4A882] bg-[#FFF8EE] px-3 py-4 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[#6B3E1E] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
                <span className="text-xs text-[#8A8078]">支持俱乐部照片、证书、公众号后台、赛事报名队伍证明等。没有图片时请在说明中写清可核验依据。</span>
              </label>
              {files.length > 0 && <div className="text-xs text-[#8A8078]">已选择 {files.length} 张图片</div>}
              <label className="grid gap-2">
                <span className="text-sm font-semibold">补充说明</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} className="rounded-lg border border-[#E0D8CC] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B7355]" placeholder="说明俱乐部所在城市、水域、你与俱乐部的关系、可核验材料来源" />
              </label>
              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {message && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-6 text-[#8A8078]">有问题可联系客服微信：<span className="font-semibold text-[#6B3E1E]">i_add_u</span></p>
                <button disabled={submitting} className="rounded-lg bg-[#6B3E1E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#563018] disabled:opacity-50">{submitting ? '提交中...' : '提交认领'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ClubClaimPage() {
  return (
    <Suspense fallback={<div className="px-4 py-12 text-center text-sm text-[#8A8078]">加载中...</div>}>
      <ClubClaimForm />
    </Suspense>
  );
}
