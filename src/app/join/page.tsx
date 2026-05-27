'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserContext';

type SubmissionType = 'professional' | 'club';
type ProfessionalRole = 'coach' | 'referee' | 'club_owner';
type FileGroup = 'profile_images' | 'club_photos' | 'certificate_images' | 'license_images';

interface AthleteOption {
  athlete_id: number;
  name: string;
  photo?: string | null;
  province?: string | null;
  city?: string | null;
  discipline?: string | null;
}

interface UserSubmission {
  submission_id: number;
  submission_type: SubmissionType;
  name: string;
  roles: string[];
  club_name: string | null;
  athlete_id: number | null;
  athlete_name: string | null;
  athlete_photo: string | null;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  admin_note: string | null;
  created_club_id: number | null;
  created_professional_id: number | null;
  created_at: string;
  updated_at: string;
}

const roleOptions: Array<{ value: ProfessionalRole; label: string; hint: string }> = [
  { value: 'coach', label: '教练员', hint: '教练员证必传' },
  { value: 'referee', label: '裁判员', hint: '裁判员证或执裁证明必传' },
  { value: 'club_owner', label: '俱乐部负责人', hint: '负责人或俱乐部证明必传' },
];

const roleLabels: Record<string, string> = {
  coach: '教练员',
  referee: '裁判员',
  club_owner: '俱乐部负责人',
};

const statusLabels: Record<UserSubmission['status'], string> = {
  pending: '已提交',
  reviewing: '审核中',
  approved: '已通过',
  rejected: '已驳回',
};

function useInitialType() {
  const [initialType, setInitialType] = useState<SubmissionType>('professional');
  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get('type');
    if (type === 'club') {
      const timer = window.setTimeout(() => setInitialType('club'), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);
  return initialType;
}

function ImagePicker({
  title,
  description,
  required,
  files,
  onChange,
}: {
  title: string;
  description: string;
  required?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  return (
    <div className={`rounded-3xl border bg-[#FFFDF9] p-5 shadow-[0_18px_40px_rgba(73,48,25,0.06)] ${required ? 'border-[#B98545]' : 'border-[#E2D4C2]'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#2D2218]">{title} {required && <span className="text-[#B35A31]">*</span>}</h3>
          <p className="mt-1 text-sm leading-6 text-[#8A8077]">{description}</p>
        </div>
        <span className="rounded-full bg-[#F3E8DA] px-3 py-1 text-xs text-[#7A5A3A]">{files.length} 张</span>
      </div>
      <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#CDB9A1] bg-[#F8F1E8] px-5 py-7 text-center transition hover:border-[#8B6A45] hover:bg-[#F5E9D9]">
        <span className="text-3xl">＋</span>
        <span className="mt-2 text-sm font-medium text-[#6D4D2E]">选择图片</span>
        <span className="mt-1 text-xs text-[#A29589]">JPG / PNG / WebP，单张不超过 8MB</span>
        <input
          className="hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            const next = Array.from(event.target.files || []);
            onChange([...files, ...next].slice(0, 8));
            event.currentTarget.value = '';
          }}
        />
      </label>
      {previews.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {previews.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-2xl border border-[#E3D6C7] bg-[#F0E5D6]">
              <img src={item.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                className="absolute right-2 top-2 rounded-full bg-[#2D2218]/78 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusFlow({ item }: { item: UserSubmission }) {
  const steps = [
    { key: 'pending', label: '已提交' },
    { key: 'reviewing', label: '平台审核' },
    { key: 'approved', label: '生成档案' },
  ];
  const statusIndex = item.status === 'rejected' ? 1 : Math.max(0, steps.findIndex((step) => step.key === item.status));

  return (
    <div className="rounded-3xl border border-[#E2D4C2] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#F2E4D0] px-3 py-1 text-xs text-[#6D4D2E]">{item.submission_type === 'club' ? '俱乐部' : roleLabels[item.roles?.[0]] || '专业人员'}</span>
            <span className={`rounded-full px-3 py-1 text-xs ${item.status === 'rejected' ? 'bg-[#FFF1F0] text-[#B3261E]' : item.status === 'approved' ? 'bg-[#ECF6EA] text-[#356B32]' : 'bg-[#F7F1E8] text-[#7A6145]'}`}>{statusLabels[item.status] || item.status}</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[#2D2218]">{item.name}</h3>
          <p className="mt-1 text-sm text-[#8A8077]">
            {item.athlete_name ? `关联运动员：${item.athlete_name}` : item.club_name ? `所属俱乐部：${item.club_name}` : `提交编号 #${item.submission_id}`}
          </p>
        </div>
        <div className="text-right text-xs text-[#A29589]">{item.created_at?.slice(0, 10)}</div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {steps.map((step, index) => {
          const active = index <= statusIndex && item.status !== 'rejected';
          return (
            <div key={step.key} className={`rounded-2xl border px-4 py-3 text-sm ${active ? 'border-[#B98545] bg-[#F8EBDD] text-[#5B3B1E]' : 'border-[#ECE1D5] bg-[#FBF8F4] text-[#AAA098]'}`}>
              <div className="font-semibold">{step.label}</div>
              <div className="mt-1 text-xs">{active ? '已完成' : '等待中'}</div>
            </div>
          );
        })}
      </div>
      {item.status === 'rejected' && <p className="mt-4 rounded-2xl bg-[#FFF1F0] px-4 py-3 text-sm text-[#B3261E]">审核未通过：{item.admin_note || '资料不完整，请根据提示重新提交。'}</p>}
      {item.status === 'approved' && (
        <div className="mt-4 flex flex-wrap gap-3">
          {item.created_professional_id && <Link className="rounded-full bg-[#6B4B2E] px-4 py-2 text-sm text-white no-underline" href={`/professionals/${item.created_professional_id}`}>查看专业档案</Link>}
          {item.created_club_id && <Link className="rounded-full bg-[#6B4B2E] px-4 py-2 text-sm text-white no-underline" href="/clubs">查看俱乐部库</Link>}
        </div>
      )}
    </div>
  );
}

export default function JoinPage() {
  const initialType = useInitialType();
  const [submissionType, setSubmissionType] = useState<SubmissionType>('professional');
  const [role, setRole] = useState<ProfessionalRole>('coach');
  const [name, setName] = useState('');
  const [clubName, setClubName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [athleteQuery, setAthleteQuery] = useState('');
  const [athleteResults, setAthleteResults] = useState<AthleteOption[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteOption | null>(null);
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [files, setFiles] = useState<Record<FileGroup, File[]>>({
    profile_images: [],
    club_photos: [],
    certificate_images: [],
    license_images: [],
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { token, loading } = useUser();

  const loadSubmissions = useCallback(async () => {
    if (!token) return;
    const res = await fetch('/api/user/industry-submissions', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setSubmissions(data.items || []);
  }, [token]);

  useEffect(() => setSubmissionType(initialType), [initialType]);
  useEffect(() => {
    if (!loading && !token) router.replace(`/login?redirect=${encodeURIComponent('/join')}`);
  }, [loading, token, router]);
  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);
  useEffect(() => {
    if (submissionType === 'club') setSelectedAthlete(null);
  }, [submissionType]);
  useEffect(() => {
    const query = athleteQuery.trim();
    if (query.length < 2 || selectedAthlete?.name === query) {
      setAthleteResults([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/athletes?search=${encodeURIComponent(query)}&pageSize=8&sort=name`);
        const data = await res.json();
        setAthleteResults(res.ok ? data.items || [] : []);
      } catch {
        setAthleteResults([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [athleteQuery, selectedAthlete]);

  function updateFiles(group: FileGroup, next: File[]) {
    setFiles((current) => ({ ...current, [group]: next }));
  }

  function certificateTitle() {
    if (role === 'coach') return '教练员证（必传）';
    if (role === 'referee') return '裁判员证 / 执裁证明（必传）';
    return '负责人证明';
  }

  function certificateDescription() {
    if (role === 'coach') return '请上传类似桨板技能教练员等级证书的清晰照片，需能看到姓名、等级、编号、发证日期和签发机构。';
    if (role === 'referee') return '请上传裁判员证、执裁证明或赛事工作人员证明，照片需清晰可核验。';
    return '可选。俱乐部负责人身份主要通过下方负责人/俱乐部证明核验。';
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError('');
    setSuccess('');
    if (!name.trim()) {
      setError(submissionType === 'club' ? '请填写俱乐部名称' : '请填写姓名');
      return;
    }
    if (submissionType === 'professional' && role === 'coach' && files.certificate_images.length === 0) {
      setError('教练员证为必传资料，请上传清晰证书照片');
      return;
    }
    if (submissionType === 'professional' && role === 'referee' && files.certificate_images.length === 0) {
      setError('裁判员证或执裁证明为必传资料');
      return;
    }
    if (submissionType === 'professional' && role === 'club_owner' && files.license_images.length === 0) {
      setError('俱乐部负责人证明为必传资料');
      return;
    }
    if (submissionType === 'club' && files.club_photos.length === 0) {
      setError('请至少上传一张清晰的俱乐部照片');
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('submission_type', submissionType);
      form.append('name', name.trim());
      form.append('club_name', clubName.trim());
      if (selectedAthlete) form.append('athlete_id', String(selectedAthlete.athlete_id));
      form.append('contact_info', contactInfo.trim());
      form.append('location_note', locationNote.trim());
      if (submissionType === 'professional') form.append('roles', role);
      Object.entries(files).forEach(([group, groupFiles]) => {
        groupFiles.forEach((file) => form.append(group, file));
      });
      const res = await fetch('/api/user/industry-submissions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      setSuccess(`提交成功，编号 #${data.submission_id}。你可以在下方查看审核进度。`);
      setFiles({ profile_images: [], club_photos: [], certificate_images: [], license_images: [] });
      await loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#2D2218]">
      <section className="lg:hidden mx-auto max-w-xl px-5 py-16">
        <div className="rounded-3xl border border-[#E2D4C2] bg-white p-8 text-center shadow-[0_22px_56px_rgba(73,48,25,0.1)]">
          <p className="text-sm tracking-[0.28em] text-[#B58A54]">PC ONLY</p>
          <h1 className="mt-3 text-3xl font-semibold">请使用电脑提交资料</h1>
          <p className="mt-4 text-sm leading-7 text-[#776B60]">俱乐部和专业人员入驻需要上传多张清晰图片，当前只开放 PC 端流程，方便核对证件与照片。</p>
          <Link href="/" className="mt-6 inline-flex rounded-full bg-[#6B4B2E] px-5 py-3 text-sm font-semibold text-white no-underline">返回首页</Link>
        </div>
      </section>

      <section className="hidden lg:block">
        <div className="relative overflow-hidden bg-[#251D15]">
          <div className="absolute inset-0 opacity-75" style={{ background: 'radial-gradient(circle at 18% 20%, rgba(203,164,103,0.28), transparent 26%), radial-gradient(circle at 76% 18%, rgba(88,116,84,0.25), transparent 28%), linear-gradient(120deg,#251D15,#3D2B1F 54%,#72583C)' }} />
          <div className="relative mx-auto max-w-[1320px] px-8 py-16">
            <p className="tracking-[0.34em] text-[#C8A16D]">INDUSTRY ONBOARDING</p>
            <h1 className="mt-4 font-[var(--font-display)] text-6xl font-semibold leading-none text-white">入驻 SUP Wiki</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#E8D7C1]">只需要提交少量信息和清晰照片。平台会用 OCR 辅助识别证件内容，后台审核后生成俱乐部或专业人员档案。</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mx-auto grid max-w-[1320px] grid-cols-[380px_1fr] gap-8 px-8 py-10">
          <aside className="space-y-4">
            {[
              { type: 'professional' as const, title: '专业人员入驻', desc: '教练员、裁判员、俱乐部负责人' },
              { type: 'club' as const, title: '俱乐部入驻', desc: '上传俱乐部照片和证明材料' },
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setSubmissionType(item.type)}
                className={`w-full rounded-3xl border p-6 text-left transition ${submissionType === item.type ? 'border-[#805D37] bg-[#EFE2D0] shadow-[0_18px_40px_rgba(73,48,25,0.12)]' : 'border-[#E2D4C2] bg-white hover:border-[#B8956E]'}`}
              >
                <div className="text-xl font-semibold">{item.title}</div>
                <div className="mt-2 text-sm text-[#776B60]">{item.desc}</div>
              </button>
            ))}
            <div className="rounded-3xl border border-[#E2D4C2] bg-white/72 p-6 text-sm leading-7 text-[#776B60]">
              <div className="font-semibold text-[#2D2218]">审核流程</div>
              <div className="mt-3 space-y-3">
                {['提交清晰图片', '平台人工核验', '生成公开档案'].map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2E4D0] text-xs font-semibold text-[#6B4B2E]">{index + 1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4">信息越少越好，照片越清晰越好。联系方式只供后台审核沟通，不会自动公开。</p>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-3xl border border-[#E2D4C2] bg-white p-6 shadow-[0_18px_46px_rgba(73,48,25,0.07)]">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-[#776B60]">{submissionType === 'club' ? '俱乐部名称 *' : '姓名 *'}</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8C8B6] bg-[#FFFDF9] px-4 outline-none focus:border-[#8B6A45]" placeholder={submissionType === 'club' ? '例如：中流击水桨板俱乐部' : '例如：张三'} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#776B60]">审核联系方式</span>
                  <input value={contactInfo} onChange={(event) => setContactInfo(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8C8B6] bg-[#FFFDF9] px-4 outline-none focus:border-[#8B6A45]" placeholder="微信 / 手机 / 邮箱，仅后台可见" />
                </label>
                {submissionType === 'professional' ? (
                  <>
                    <label className="block">
                      <span className="text-sm font-medium text-[#776B60]">所属俱乐部</span>
                      <input value={clubName} onChange={(event) => setClubName(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8C8B6] bg-[#FFFDF9] px-4 outline-none focus:border-[#8B6A45]" placeholder="可选，审核后会尝试关联" />
                    </label>
                    <div className="relative">
                      <span className="text-sm font-medium text-[#776B60]">关联运动员</span>
                      <input value={athleteQuery} onChange={(event) => { setAthleteQuery(event.target.value); setSelectedAthlete(null); }} className="mt-2 h-12 w-full rounded-2xl border border-[#D8C8B6] bg-[#FFFDF9] px-4 outline-none focus:border-[#8B6A45]" placeholder="可选，搜索运动员本人档案" />
                      {selectedAthlete && (
                        <div className="mt-2 flex items-center justify-between rounded-2xl bg-[#F3E8DA] px-3 py-2 text-sm text-[#5F4328]">
                          <span>已关联：{selectedAthlete.name}</span>
                          <button type="button" onClick={() => { setSelectedAthlete(null); setAthleteQuery(''); }} className="text-[#9A6540]">移除</button>
                        </div>
                      )}
                      {athleteResults.length > 0 && !selectedAthlete && (
                        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-[#D8C8B6] bg-white p-2 shadow-[0_20px_48px_rgba(73,48,25,0.16)]">
                          {athleteResults.map((athlete) => (
                            <button
                              key={athlete.athlete_id}
                              type="button"
                              onClick={() => {
                                setSelectedAthlete(athlete);
                                setAthleteQuery(athlete.name);
                                setName((current) => current || athlete.name);
                                setAthleteResults([]);
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#F7F1E8]"
                            >
                              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#EBDCCB] text-sm font-semibold text-[#7A5A3A]">{athlete.photo ? <img src={athlete.photo} alt="" className="h-full w-full object-cover" /> : athlete.name.slice(0, 1)}</span>
                              <span>
                                <span className="block text-sm font-semibold">{athlete.name}</span>
                                <span className="text-xs text-[#8A8077]">{[athlete.province, athlete.city, athlete.discipline].filter(Boolean).join(' / ') || '运动员档案'}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <label className="block">
                    <span className="text-sm font-medium text-[#776B60]">城市 / 水域 / 地址</span>
                    <input value={locationNote} onChange={(event) => setLocationNote(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8C8B6] bg-[#FFFDF9] px-4 outline-none focus:border-[#8B6A45]" placeholder="可选，例如：杭州余杭塘河" />
                  </label>
                )}
              </div>

              {submissionType === 'professional' && (
                <div className="mt-6">
                  <div className="text-sm font-medium text-[#776B60]">身份 *（只能选择 1 个）</div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {roleOptions.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setRole(item.value)}
                        className={`rounded-2xl border p-4 text-left transition ${role === item.value ? 'border-[#805D37] bg-[#F2E4D0]' : 'border-[#E2D4C2] bg-[#FFFDF9]'}`}
                      >
                        <div className="font-semibold">{item.label}</div>
                        <div className="mt-1 text-xs leading-5 text-[#8A8077]">{item.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {submissionType === 'professional' ? (
              <>
                <ImagePicker title="本人或工作照片" description="用于头像或资料核对。照片清晰即可，不强制专业证件照。" files={files.profile_images} onChange={(next) => updateFiles('profile_images', next)} />
                <ImagePicker title={certificateTitle()} description={certificateDescription()} required={role === 'coach' || role === 'referee'} files={files.certificate_images} onChange={(next) => updateFiles('certificate_images', next)} />
                <ImagePicker title="负责人 / 俱乐部证明" description="俱乐部负责人必须上传；教练员或裁判员可选传其他补充证明。" required={role === 'club_owner'} files={files.license_images} onChange={(next) => updateFiles('license_images', next)} />
              </>
            ) : (
              <>
                <ImagePicker title="俱乐部照片" description="门头、训练场景、上下水点、器材区等照片，越清晰越便于审核。" required files={files.club_photos} onChange={(next) => updateFiles('club_photos', next)} />
                <ImagePicker title="营业执照 / 负责人证明" description="可选。用于后台核验俱乐部主体，不会自动公开展示。" files={files.license_images} onChange={(next) => updateFiles('license_images', next)} />
              </>
            )}

            {(error || success) && (
              <div className={`rounded-2xl border px-5 py-4 text-sm ${error ? 'border-[#F2B8B5] bg-[#FFF2F1] text-[#B3261E]' : 'border-[#B7D7B2] bg-[#F1FAEF] text-[#3D6B35]'}`}>
                {error || success}
              </div>
            )}
            <div className="flex items-center justify-between rounded-3xl border border-[#E2D4C2] bg-white p-5">
              <p className="text-sm text-[#8A8077]">提交后可在下方看到完整审核流程，通过后会生成正式资料。</p>
              <button disabled={submitting} className="rounded-2xl bg-[#6B4B2E] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#553923] disabled:cursor-not-allowed disabled:bg-[#B8A691]">
                {submitting ? '提交中…' : '提交入驻资料'}
              </button>
            </div>

            <section className="space-y-4 pt-4">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">我的入驻进度</h2>
                  <p className="mt-1 text-sm text-[#8A8077]">平台审核状态会在这里更新，审核通过后可直接进入正式档案。</p>
                </div>
                <button type="button" onClick={loadSubmissions} className="rounded-full border border-[#D8C8B6] bg-white px-4 py-2 text-sm text-[#6B4B2E]">刷新</button>
              </div>
              {submissions.length > 0 ? submissions.map((item) => <StatusFlow key={item.submission_id} item={item} />) : (
                <div className="rounded-3xl border border-dashed border-[#D8C8B6] bg-white/72 p-8 text-center text-sm text-[#8A8077]">暂无提交记录。</div>
              )}
            </section>
          </section>
        </form>
      </section>
    </main>
  );
}
