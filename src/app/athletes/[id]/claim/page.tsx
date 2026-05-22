'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/components/UserContext';

interface ClaimOption {
  result_id: number;
  event_name: string;
  start_date: string | null;
  province: string | null;
  city: string | null;
  discipline: string | null;
  gender_group: string | null;
  rank_position: number | null;
  finish_time: string | null;
  bib_prefix: string;
}

interface AthleteOption {
  athlete_id: number;
  name: string;
  photo: string | null;
  province: string | null;
  city: string | null;
  bio: string | null;
}

export default function AthleteClaimPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, loading } = useUser();
  const athleteId = Number(params.id);
  const [athlete, setAthlete] = useState<AthleteOption | null>(null);
  const [results, setResults] = useState<ClaimOption[]>([]);
  const [form, setForm] = useState({
    submitted_name: '',
    submitted_avatar_url: '',
    submitted_birth_year: '',
    submitted_hometown_province: '',
    submitted_hometown_city: '',
    submitted_living_province: '',
    submitted_living_city: '',
    submitted_started_sup_year: '',
    submitted_intro_short: '',
    submitted_intro: '',
    result_id: '',
    submitted_bib_number: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) router.replace(`/login?redirect=${encodeURIComponent(`/athletes/${athleteId}/claim`)}`);
  }, [athleteId, loading, router, token]);

  useEffect(() => {
    if (!token || !athleteId) return;
    fetch(`/api/user/athlete-claims/options?athlete_id=${athleteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '加载失败');
        setAthlete(data.athlete);
        setResults(data.recent_results || []);
        setForm((prev) => ({
          ...prev,
          submitted_name: data.athlete?.name || '',
          submitted_hometown_province: data.athlete?.province || '',
          submitted_hometown_city: data.athlete?.city || '',
          result_id: data.recent_results?.[0]?.result_id ? String(data.recent_results[0].result_id) : '',
          submitted_bib_number: data.recent_results?.[0]?.bib_prefix || '',
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'));
  }, [athleteId, token]);

  const selectedResult = useMemo(
    () => results.find((item) => String(item.result_id) === form.result_id) || null,
    [form.result_id, results]
  );

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadAvatar(file: File) {
    if (!token) return;
    setUploading(true);
    setError('');
    const data = new FormData();
    data.set('file', file);
    try {
      const res = await fetch('/api/user/athlete-claims/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '头像上传失败');
      update('submitted_avatar_url', json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/user/athlete-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, athlete_id: athleteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      setMessage('资料已提交，管理员审核通过后会更新到运动员主页。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !token) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-stone-500">正在检查登录状态...</div>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/athletes" className="text-stone-500 no-underline">运动员</Link>
        <span> / </span>
        <Link href={`/athletes/${athleteId}`} className="text-stone-500 no-underline">{athlete?.name || '详情'}</Link>
        <span> / 更新资料</span>
      </nav>

      <section className="mb-6 rounded-lg border border-[#E3D8C9] bg-[#FEFCF9] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-[#B39A78]">Athlete Claim</div>
        <h1 className="mt-2 text-2xl font-semibold text-[#2E2118]">这是我，更新资料</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
          请选择最近三场比赛中的一场，并补全号码牌。号码牌只用于后台校验，不会在公开成绩页展示。
        </p>
      </section>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <form onSubmit={submit} className="space-y-5 rounded-lg border border-[#E3D8C9] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            姓名
            <input value={form.submitted_name} onChange={(e) => update('submitted_name', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            出生年份
            <input inputMode="numeric" value={form.submitted_birth_year} onChange={(e) => update('submitted_birth_year', e.target.value.replace(/[^\d]/g, '').slice(0, 4))} placeholder="例如 1998" className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            籍贯省份
            <input value={form.submitted_hometown_province} onChange={(e) => update('submitted_hometown_province', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            籍贯城市
            <input value={form.submitted_hometown_city} onChange={(e) => update('submitted_hometown_city', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            现居省份
            <input value={form.submitted_living_province} onChange={(e) => update('submitted_living_province', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            现居城市
            <input value={form.submitted_living_city} onChange={(e) => update('submitted_living_city', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
          </label>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          从哪一年开始玩桨板
          <input inputMode="numeric" value={form.submitted_started_sup_year} onChange={(e) => update('submitted_started_sup_year', e.target.value.replace(/[^\d]/g, '').slice(0, 4))} placeholder="例如 2021" className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
        </label>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="rounded-lg border border-[#E3D8C9] bg-[#FAF6EF] p-3">
            {form.submitted_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.submitted_avatar_url} alt="头像预览" className="aspect-square w-full rounded-md object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-md bg-[#EFE4D6] text-sm text-stone-400">头像预览</div>
            )}
          </div>
          <label className="block text-sm font-medium text-stone-700">
            上传新头像
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadAvatar(file); }} className="mt-1 block w-full rounded-md border border-[#D8CDBE] px-3 py-2 text-sm" />
            <span className="mt-2 block text-xs text-stone-400">{uploading ? '上传中...' : '支持 JPG、PNG、WebP，审核通过后替换公开头像。'}</span>
          </label>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          最近比赛校验
          <select value={form.result_id} onChange={(e) => {
            const next = results.find((item) => String(item.result_id) === e.target.value);
            setForm((prev) => ({ ...prev, result_id: e.target.value, submitted_bib_number: next?.bib_prefix || '' }));
          }} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]">
            {results.map((item) => (
              <option key={item.result_id} value={item.result_id}>
                {item.event_name} / {item.discipline || '项目'} / {item.finish_time || '成绩'}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          补全该场号码牌
          <input value={form.submitted_bib_number} onChange={(e) => update('submitted_bib_number', e.target.value.toUpperCase())} placeholder={selectedResult?.bib_prefix ? `已填前两位：${selectedResult.bib_prefix}` : '请输入号码牌'} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          一句话介绍自己
          <input value={form.submitted_intro_short} onChange={(e) => update('submitted_intro_short', e.target.value)} maxLength={120} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          几句话介绍自己
          <textarea value={form.submitted_intro} onChange={(e) => update('submitted_intro', e.target.value)} rows={5} maxLength={1000} className="mt-1 w-full rounded-md border border-[#D8CDBE] px-3 py-2 outline-none focus:border-[#8B7355]" />
        </label>

        <div className="flex justify-end gap-3">
          <Link href={`/athletes/${athleteId}`} className="inline-flex h-11 items-center rounded-md border border-[#D8CDBE] px-4 text-sm font-medium text-stone-600 no-underline">返回</Link>
          <button disabled={submitting || results.length === 0} className="h-11 rounded-md bg-[#6B3E1E] px-5 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? '提交中...' : '提交审核'}
          </button>
        </div>
      </form>
    </main>
  );
}
