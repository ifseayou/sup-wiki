'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserContext';

type SubmissionType = 'professional' | 'club';
type FileGroup = 'profile_images' | 'club_photos' | 'certificate_images' | 'license_images';

const roleOptions = [
  { value: 'coach', label: '教练员', hint: '上传教练员证或培训证' },
  { value: 'referee', label: '裁判员', hint: '上传裁判员证或执裁证明' },
  { value: 'club_owner', label: '俱乐部负责人', hint: '上传俱乐部或负责人证明' },
];

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
  files,
  onChange,
}: {
  title: string;
  description: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  return (
    <div className="rounded-3xl border border-[#E2D4C2] bg-[#FFFDF9] p-5 shadow-[0_18px_40px_rgba(73,48,25,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#2D2218]">{title}</h3>
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

export default function JoinPage() {
  const initialType = useInitialType();
  const [submissionType, setSubmissionType] = useState<SubmissionType>('professional');
  const [roles, setRoles] = useState<string[]>(['coach']);
  const [name, setName] = useState('');
  const [clubName, setClubName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [locationNote, setLocationNote] = useState('');
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

  useEffect(() => setSubmissionType(initialType), [initialType]);
  useEffect(() => {
    if (!loading && !token) router.replace(`/login?redirect=${encodeURIComponent('/join')}`);
  }, [loading, token, router]);

  function updateFiles(group: FileGroup, next: File[]) {
    setFiles((current) => ({ ...current, [group]: next }));
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
    if (submissionType === 'professional' && roles.length === 0) {
      setError('请选择至少一个身份');
      return;
    }
    if (submissionType === 'professional' && files.profile_images.length + files.certificate_images.length + files.license_images.length === 0) {
      setError('请至少上传一张本人照片或证件照片');
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
      form.append('contact_info', contactInfo.trim());
      form.append('location_note', locationNote.trim());
      roles.forEach((role) => form.append('roles', role));
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
      setSuccess(`提交成功，编号 #${data.submission_id}。后台审核通过后会生成正式资料。`);
      setFiles({ profile_images: [], club_photos: [], certificate_images: [], license_images: [] });
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
              <div className="font-semibold text-[#2D2218]">录入原则</div>
              <p className="mt-2">信息越少越好，照片越清晰越好。联系方式只供后台审核沟通，不会自动公开。</p>
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
                  <label className="block">
                    <span className="text-sm font-medium text-[#776B60]">所属俱乐部</span>
                    <input value={clubName} onChange={(event) => setClubName(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8C8B6] bg-[#FFFDF9] px-4 outline-none focus:border-[#8B6A45]" placeholder="可选，审核后会尝试关联" />
                  </label>
                ) : (
                  <label className="block">
                    <span className="text-sm font-medium text-[#776B60]">城市 / 水域 / 地址</span>
                    <input value={locationNote} onChange={(event) => setLocationNote(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8C8B6] bg-[#FFFDF9] px-4 outline-none focus:border-[#8B6A45]" placeholder="可选，例如：杭州余杭塘河" />
                  </label>
                )}
              </div>

              {submissionType === 'professional' && (
                <div className="mt-6">
                  <div className="text-sm font-medium text-[#776B60]">身份 *</div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {roleOptions.map((role) => {
                      const checked = roles.includes(role.value);
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => setRoles((current) => checked ? current.filter((item) => item !== role.value) : [...current, role.value])}
                          className={`rounded-2xl border p-4 text-left transition ${checked ? 'border-[#805D37] bg-[#F2E4D0]' : 'border-[#E2D4C2] bg-[#FFFDF9]'}`}
                        >
                          <div className="font-semibold">{role.label}</div>
                          <div className="mt-1 text-xs leading-5 text-[#8A8077]">{role.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {submissionType === 'professional' ? (
              <>
                <ImagePicker title="本人或工作照片" description="用于头像或资料核对。照片清晰即可，不强制专业证件照。" files={files.profile_images} onChange={(next) => updateFiles('profile_images', next)} />
                <ImagePicker title="教练员证 / 裁判员证" description="请上传清晰证书照片，平台会用 OCR 辅助识别证书名称、发证机构和编号。" files={files.certificate_images} onChange={(next) => updateFiles('certificate_images', next)} />
                <ImagePicker title="其他负责人证明" description="俱乐部负责人、执裁证明或其他能证明身份的图片。" files={files.license_images} onChange={(next) => updateFiles('license_images', next)} />
              </>
            ) : (
              <>
                <ImagePicker title="俱乐部照片 *" description="门头、训练场景、上下水点、器材区等照片，越清晰越便于审核。" files={files.club_photos} onChange={(next) => updateFiles('club_photos', next)} />
                <ImagePicker title="营业执照 / 负责人证明" description="可选。用于后台核验俱乐部主体，不会自动公开展示。" files={files.license_images} onChange={(next) => updateFiles('license_images', next)} />
              </>
            )}

            {(error || success) && (
              <div className={`rounded-2xl border px-5 py-4 text-sm ${error ? 'border-[#F2B8B5] bg-[#FFF2F1] text-[#B3261E]' : 'border-[#B7D7B2] bg-[#F1FAEF] text-[#3D6B35]'}`}>
                {error || success}
              </div>
            )}
            <div className="flex items-center justify-between rounded-3xl border border-[#E2D4C2] bg-white p-5">
              <p className="text-sm text-[#8A8077]">提交后进入后台审核，通过后会生成正式资料。</p>
              <button disabled={submitting} className="rounded-2xl bg-[#6B4B2E] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#553923] disabled:cursor-not-allowed disabled:bg-[#B8A691]">
                {submitting ? '提交中…' : '提交入驻资料'}
              </button>
            </div>
          </section>
        </form>
      </section>
    </main>
  );
}
