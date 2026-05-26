'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useUser } from '@/components/UserContext';

function UploadResultsForm() {
  const searchParams = useSearchParams();
  const { user, token, loading } = useUser();
  const [eventName, setEventName] = useState(searchParams.get('event_name') || '');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loginHref = useMemo(() => {
    const redirect = `/events/upload-results${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return `/login?redirect=${encodeURIComponent(redirect)}`;
  }, [searchParams]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setMessage('');
    setError('');

    const form = new FormData();
    form.set('event_name', eventName);
    form.set('event_date', eventDate);
    form.set('location', location);
    form.set('user_note', note);
    const eventId = searchParams.get('event_id');
    if (eventId) form.set('event_id', eventId);
    files.forEach((file) => form.append('files', file));

    try {
      const res = await fetch('/api/user/event-result-submissions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '提交失败，请稍后重试');
        return;
      }
      setMessage(`已提交 ${data.file_count || files.length || 1} 份成绩册，等待整理录入。遇到问题可联系客服微信：i_add_u`);
      setFiles([]);
      setNote('');
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-8 flex items-center gap-2 text-sm text-stone-400">
        <Link href="/events" className="hover:text-[#8B7355]">赛事</Link>
        <span>/</span>
        <span className="text-stone-600">上传成绩册</span>
      </nav>

      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#987D59]">Result Book</p>
        <h1 className="text-3xl font-bold text-stone-800">上传赛事成绩册</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">
          如果你手上有尚未收录的官方 PDF 成绩册，可以提交给我们整理入库。成绩不会自动公开，管理员会先复核来源和内容。
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-8 text-sm text-stone-500">加载中...</div>
      ) : !user ? (
        <div className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-8">
          <h2 className="text-lg font-semibold text-stone-800">请先登录后上传</h2>
          <p className="mt-2 text-sm leading-7 text-stone-500">
            成绩册提交需要绑定用户账号，便于后续确认来源和反馈处理进度。
          </p>
          <Link
            href={loginHref}
            className="mt-6 inline-flex rounded-lg bg-[#6B3E1E] px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#563018]"
          >
            登录后上传
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6 sm:p-8">
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-stone-700">赛事名称</span>
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                maxLength={160}
                className="h-11 rounded-lg border border-[#E0D8CC] bg-white px-3 text-sm text-stone-800 outline-none focus:border-[#8B7355]"
                placeholder="例如：2025中国百城桨板公开赛宁波梅山湾站"
              />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-stone-700">赛事日期</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="h-11 rounded-lg border border-[#E0D8CC] bg-white px-3 text-sm text-stone-800 outline-none focus:border-[#8B7355]"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-stone-700">举办地</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={160}
                  className="h-11 rounded-lg border border-[#E0D8CC] bg-white px-3 text-sm text-stone-800 outline-none focus:border-[#8B7355]"
                  placeholder="城市 / 水域 / 场地"
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-stone-700">PDF 成绩册</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                required
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="rounded-lg border border-dashed border-[#C4A882] bg-[#FFF8EE] px-3 py-4 text-sm text-stone-700 file:mr-4 file:rounded-md file:border-0 file:bg-[#6B3E1E] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <span className="text-xs text-stone-400">仅支持 PDF，单个文件不超过 20MB，一次最多 10 个文件。</span>
              {files.length > 0 && (
                <div className="rounded-lg border border-[#E8DAC8] bg-white p-3">
                  <div className="mb-2 text-xs font-semibold text-stone-500">本批次 {files.length} 份成绩册</div>
                  <div className="grid gap-2">
                    {files.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-[#FAF6EF] px-3 py-2 text-xs text-stone-600">
                        <span className="min-w-0 truncate">第 {index + 1} 份 · {item.name}</span>
                        <span className="shrink-0 text-stone-400">{(item.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-stone-700">备注</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={1000}
                className="rounded-lg border border-[#E0D8CC] bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-[#8B7355]"
                placeholder="可补充来源、缺失项目、需要特别核对的地方"
              />
            </label>
          </div>

          {error && <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && <div className="mt-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-6 text-stone-400">
              遇到上传失败或成绩有误，可联系客服微信：<span className="font-semibold text-[#6B3E1E]">i_add_u</span>
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#6B3E1E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#563018] disabled:opacity-50"
            >
              {submitting ? '提交中...' : '提交成绩册'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function UploadResultsPage() {
  return (
    <Suspense fallback={<div className="px-4 py-12 text-center text-sm text-stone-400">加载中...</div>}>
      <UploadResultsForm />
    </Suspense>
  );
}
