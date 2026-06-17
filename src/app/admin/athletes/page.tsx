'use client';

/* eslint-disable @next/next/no-img-element */
import EntityManager from '@/components/admin/EntityManager';
import ImageUpload, { MultiImageUpload } from '@/components/admin/ImageUpload';
import OfficialEliteBadge from '@/components/OfficialEliteBadge';
import RegionSelect from '@/components/admin/RegionSelect';
import { genderLabel } from '@/lib/athlete-gender';
import { getNationalityOptions, normalizeNationality } from '@/lib/nationality';
import { useAdminAuth } from '../layout';

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function profileString(profile: Record<string, unknown>, key: string) {
  return String(profile[key] || '');
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Plain text input is handled below.
  }
  return String(value)
    .split(/[、,，\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

const currentYear = new Date().getFullYear();
const startedYearOptions = Array.from({ length: currentYear - 1990 + 1 }, (_, index) => String(currentYear - index));
const nationalityOptions = getNationalityOptions();

function AthleteForm({ data, onChange, token }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  const photos = Array.isArray(data.photos) ? (data.photos as string[]) : [];
  const socialLinks = parseRecord(data.social_links);
  const publicProfile = parseRecord(socialLinks.public_profile);
  const eliteGroups = parseStringList(data.elite_event_groups);

  function updatePublicProfile(patch: Record<string, unknown>, extraData: Record<string, unknown> = {}) {
    onChange({
      ...data,
      ...extraData,
      social_links: {
        ...socialLinks,
        public_profile: {
          ...publicProfile,
          ...patch,
        },
      },
    });
  }

  function updatePhotos(urls: string[]) {
    updatePublicProfile(
      { sup_photos: urls, photos: urls },
      { photos: urls },
    );
  }

  function updateBio(value: string) {
    updatePublicProfile({ intro: value }, { bio: value });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-cream-200 bg-white/70 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-brown-800">图片资料</h3>
          <p className="mt-1 text-xs text-warm-gray-400">头像用于列表和主页首图，更多照片会同步到运动员主页照片墙。</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
        <ImageUpload value={String(data.photo || '')} onChange={url => set('photo', url)} folder="athletes" token={token} label="主头像（列表展示用）" />
        <div>
          <MultiImageUpload values={photos} onChange={updatePhotos} folder="athletes" token={token} label="更多照片（详情页展示）" max={8} />
        </div>
        </div>
      </section>

      <section className="rounded-xl border border-cream-200 bg-white/70 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-brown-800">基础身份</h3>
          <p className="mt-1 text-xs text-warm-gray-400">国籍、性别和主项使用标准选项，避免手输导致筛选不一致。</p>
        </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">姓名 *</label>
          <input className={inp} value={String(data.name || '')} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">英文名</label>
          <input className={inp} value={String(data.name_en || '')} onChange={e => set('name_en', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">国籍</label>
          <select className={inp} value={normalizeNationality(data.nationality) || ''} onChange={e => set('nationality', e.target.value)}>
            <option value="">请选择国籍</option>
            {nationalityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">性别</label>
          <select className={inp} value={String(data.gender || 'unknown')} onChange={e => onChange({ ...data, gender: e.target.value, gender_source: 'manual', gender_confidence: null })}>
            <option value="unknown">未知</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="mixed">混合/团体</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">运动项目</label>
          <select className={inp} value={String(data.discipline || 'race')} onChange={e => set('discipline', e.target.value)}>
            <option value="race">竞速</option>
            <option value="surf">冲浪</option>
            <option value="distance">长距离</option>
            <option value="technical">技巧</option>
          </select>
        </div>
      </div>
      </section>

      <section className="rounded-xl border border-cream-200 bg-white/70 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-brown-800">官方精英标记</h3>
          <p className="mt-1 text-xs text-warm-gray-400">用于前台官方精英/官方精英(补)徽章展示；组别可用顿号或逗号分隔。</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">精英名单状态</label>
            <select className={inp} value={String(data.elite_event_status || 'none')} onChange={e => set('elite_event_status', e.target.value)}>
              <option value="none">不展示</option>
              <option value="formal">官方精英</option>
              <option value="reserve">官方精英(补)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">精英组别</label>
            <input
              className={inp}
              value={eliteGroups.join('、')}
              onChange={e => set('elite_event_groups', parseStringList(e.target.value))}
              placeholder="例如：男子精英组、公开男子组"
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">来源标题</label>
            <input className={inp} value={String(data.elite_event_source_title || '')} onChange={e => set('elite_event_source_title', e.target.value)} placeholder="例如：中国桨板精英赛事正式运动员名单" />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">备注</label>
            <input className={inp} value={String(data.elite_event_note || '')} onChange={e => set('elite_event_note', e.target.value)} placeholder="内部说明或名单备注" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-cream-200 bg-white/70 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-brown-800">地区与经历</h3>
          <p className="mt-1 text-xs text-warm-gray-400">籍贯写入主表并同步到主页资料；现居仅用于主页公开资料。</p>
        </div>
      <div className="grid grid-cols-2 gap-4">
        <RegionSelect
          idPrefix="athlete-origin"
          province={String(data.province || '')}
          city={String(data.city || '')}
          provinceLabel="籍贯省份"
          cityLabel="籍贯城市"
          onChange={(value) => updatePublicProfile({
            hometown_province: value.province,
            hometown_city: value.city,
            hometown: { province: value.province, city: value.city },
          }, {
            province: value.province,
            city: value.city,
          })}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <RegionSelect
          idPrefix="athlete-living"
          province={profileString(publicProfile, 'living_province') || profileString(parseRecord(publicProfile.living), 'province')}
          city={profileString(publicProfile, 'living_city') || profileString(parseRecord(publicProfile.living), 'city')}
          provinceLabel="现居省份"
          cityLabel="现居城市"
          onChange={(value) => updatePublicProfile({
            living_province: value.province,
            living_city: value.city,
            living: { province: value.province, city: value.city },
          })}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">出生年月日</label>
          <input
            className={inp}
            type="date"
            min="1940-01-01"
            max={`${currentYear}-12-31`}
            value={profileString(publicProfile, 'birth_date')}
            onChange={(e) => updatePublicProfile({
              birth_date: e.target.value,
              birth_year: e.target.value ? Number(e.target.value.slice(0, 4)) : null,
            })}
          />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">开始玩桨板年份</label>
          <select
            className={inp}
            value={profileString(publicProfile, 'started_sup_year')}
            onChange={(e) => updatePublicProfile({ started_sup_year: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">请选择年份</option>
            {startedYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>
      </section>

      <section className="rounded-xl border border-cream-200 bg-white/70 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-brown-800">主页资料</h3>
          <p className="mt-1 text-xs text-warm-gray-400">一句话简介限制 20 字，个人简介限制 300 字；联系方式仅管理员审核可见。</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">ICF 排名</label>
            <input className={inp} type="number" value={String(data.icf_ranking || '')} onChange={e => set('icf_ranking', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">联系方式</label>
            <input className={inp} value={profileString(publicProfile, 'contact')} onChange={e => updatePublicProfile({ contact: e.target.value })} placeholder="微信号或手机号，仅管理员可见" />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">一句话简介</label>
          <input
            className={inp}
            value={profileString(publicProfile, 'intro_short')}
            onChange={e => updatePublicProfile({ intro_short: e.target.value.slice(0, 20) })}
            maxLength={20}
            placeholder="例如：脚脚 / 荧光战神"
          />
          <div className="mt-1 text-right text-xs text-warm-gray-400">{profileString(publicProfile, 'intro_short').length}/20</div>
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">个人简介</label>
          <textarea
            className={inp}
            rows={5}
            value={String(data.bio || profileString(publicProfile, 'intro'))}
            onChange={e => updateBio(e.target.value.slice(0, 300))}
            maxLength={300}
            placeholder="介绍桨板经历、训练地点或代表队信息"
          />
          <div className="mt-1 text-right text-xs text-warm-gray-400">{String(data.bio || profileString(publicProfile, 'intro')).length}/300</div>
        </div>
      </section>
      </div>
  );
}

function formatLocation(province: unknown, city: unknown) {
  return [province, city].filter(Boolean).join(' / ') || '—';
}

function formatAnnualRank(row: Record<string, unknown>) {
  const rank = Number(row.latest_annual_rank || 0);
  if (!Number.isFinite(rank) || rank <= 0 || rank >= 999999) return '—';
  const year = row.latest_annual_year ? `${row.latest_annual_year}年` : '';
  const group = row.latest_annual_group ? String(row.latest_annual_group) : '';
  const points = row.latest_annual_points ? `${Number(row.latest_annual_points).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}分` : '';
  const meta = [year, group, points].filter(Boolean).join(' · ');
  return (
    <div>
      <div className="font-medium text-brown-700">#{rank}</div>
      {meta && <div className="mt-0.5 max-w-40 truncate text-xs text-warm-gray-400" title={meta}>{meta}</div>}
    </div>
  );
}

function renderAthleteName(_value: unknown, row: Record<string, unknown>) {
  const name = String(row.name || '未命名运动员');
  const adminName = String(row.admin_display_name || name);
  const nameEn = String(row.name_en || '').trim();
  const photo = String(row.photo || '').trim();
  const showEliteBadge = row.elite_event_status === 'formal' || row.elite_event_status === 'reserve';
  const eliteGroups = Array.isArray(row.elite_event_groups) ? row.elite_event_groups as string[] : [];
  return (
    <div className="flex min-w-48 items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E8DDCF] bg-[#F4EFE7] text-sm font-semibold text-[#7A6245]">
        {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 1)}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-[#2E3D38]">{adminName}</span>
          {showEliteBadge && <OfficialEliteBadge status={row.elite_event_status as 'formal' | 'reserve'} groups={eliteGroups} />}
        </div>
        <div className="mt-0.5 truncate text-xs text-[#9A9085]">
          #{String(row.athlete_id || '—')}{nameEn ? ` · ${nameEn}` : ''}
        </div>
      </div>
    </div>
  );
}

function renderGender(value: unknown, row: Record<string, unknown>) {
  const inferred = row.gender_source === 'result_inferred';
  return (
    <span className="inline-flex rounded-full bg-[#F3ECE2] px-2.5 py-1 text-xs font-medium text-[#705B42]">
      {genderLabel(value)}{inferred ? ' · 推断' : ''}
    </span>
  );
}

function privacyLabel(value: unknown) {
  const mode = String(value || 'public');
  if (mode !== 'public') return { text: '隐藏主页', cls: 'bg-amber-50 text-amber-700 ring-amber-100' };
  return { text: '展示主页', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
}

function resultPrivacyLabel(value: unknown) {
  const hidden = Number(value || 0) > 0;
  return hidden
    ? { text: '隐藏成绩&积分', cls: 'bg-amber-50 text-amber-700 ring-amber-100' }
    : { text: '公开成绩与积分', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
}

function buildColumns(token: string) {
  async function setPrivacy(row: Record<string, unknown>, requestType: 'hide_athlete' | 'restore_frontend' | 'hide_results_points' | 'restore_results_points') {
    const athleteId = Number(row.athlete_id || 0);
    if (!athleteId) return;
    const res = await fetch('/api/admin/athletes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'set_privacy', athlete_id: athleteId, request_type: requestType }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || '隐私设置失败');
      return;
    }
    window.location.reload();
  }

  return [
  { key: 'name', label: '运动员', render: renderAthleteName },
  { key: 'gender', label: '性别', render: renderGender },
  { key: 'nationality', label: '国籍', sortable: true, render: (v: unknown) => normalizeNationality(v) || '—' },
  { key: 'province', label: '籍贯', render: (_v: unknown, row: Record<string, unknown>) => formatLocation(row.province, row.city) },
  { key: 'living_city', label: '现居城市', render: (_v: unknown, row: Record<string, unknown>) => formatLocation(row.living_province, row.living_city) },
  { key: 'latest_annual_rank', label: '国内年度排名', sortable: true, render: (_v: unknown, row: Record<string, unknown>) => formatAnnualRank(row) },
  { key: 'is_claimed', label: '认领', render: (v: unknown) => Number(v) > 0 ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">已认领</span> : <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-warm-gray-400">未认领</span> },
  { key: 'discipline', label: '项目', render: (v: unknown) => ({'race':'竞速','surf':'冲浪','distance':'长距离','technical':'技巧'}[String(v)] || String(v)) },
  {
    key: 'privacy_mode',
    label: '隐私',
    render: (v: unknown, row: Record<string, unknown>) => {
      const current = String(v || 'public');
      const profileHidden = current !== 'public';
      const profile = privacyLabel(current);
      const resultsHidden = Number(row.results_points_hidden || 0) > 0;
      const results = resultPrivacyLabel(row.results_points_hidden);
      return (
        <div className="min-w-48 space-y-3">
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${profile.cls}`}>{profile.text}</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={profileHidden}
                onClick={() => setPrivacy(row, 'hide_athlete')}
                className="rounded-md border border-[#E4D8C8] bg-white px-2 py-1 text-[11px] text-[#5E554D] hover:border-[#0F5C52] hover:text-[#0F5C52] disabled:cursor-not-allowed disabled:opacity-40"
              >
                隐藏主页
              </button>
              <button
                type="button"
                disabled={!profileHidden}
                onClick={() => setPrivacy(row, 'restore_frontend')}
                className="rounded-md border border-[#E4D8C8] bg-white px-2 py-1 text-[11px] text-[#5E554D] hover:border-[#0F5C52] hover:text-[#0F5C52] disabled:cursor-not-allowed disabled:opacity-40"
              >
                展示主页
              </button>
            </div>
          </div>
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${results.cls}`}>{results.text}</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={resultsHidden}
                onClick={() => setPrivacy(row, 'hide_results_points')}
                className="rounded-md border border-[#E4D8C8] bg-white px-2 py-1 text-[11px] text-[#5E554D] hover:border-[#0F5C52] hover:text-[#0F5C52] disabled:cursor-not-allowed disabled:opacity-40"
              >
                隐藏成绩&积分
              </button>
              <button
                type="button"
                disabled={!resultsHidden}
                onClick={() => setPrivacy(row, 'restore_results_points')}
                className="rounded-md border border-[#E4D8C8] bg-white px-2 py-1 text-[11px] text-[#5E554D] hover:border-[#0F5C52] hover:text-[#0F5C52] disabled:cursor-not-allowed disabled:opacity-40"
              >
                公开成绩与积分
              </button>
            </div>
          </div>
        </div>
      );
    },
  },
  ];
}
const defaultFormData = {
  athlete_id: undefined,
  name: '',
  name_en: '',
  gender: 'unknown',
  gender_source: 'manual',
  gender_confidence: null,
  nationality: '中国',
  province: '',
  city: '',
  photo: '',
  photos: [],
  bio: '',
  discipline: 'race',
  icf_ranking: '',
  achievements: [],
  social_links: { public_profile: {} },
  elite_event_status: 'none',
  elite_event_groups: [],
  elite_event_note: '',
  elite_event_source_title: '',
};

const athleteFilters = [
  {
    key: 'claimed',
    placeholder: '全部绑定状态',
    options: [
      { value: '1', label: '仅已绑定' },
      { value: '0', label: '仅未绑定' },
    ],
  },
  {
    key: 'gender',
    placeholder: '全部性别',
    options: [
      { value: 'male', label: '男' },
      { value: 'female', label: '女' },
      { value: 'mixed', label: '混合/团体' },
      { value: 'unknown', label: '未知' },
    ],
  },
  { key: 'nationality', placeholder: '筛选国籍', type: 'search' as const, endpoint: '/api/admin/athletes/filter-options?type=nationality', options: [] },
  { key: 'city', placeholder: '筛选城市', type: 'search' as const, endpoint: '/api/admin/athletes/filter-options?type=city', options: [] },
  {
    key: 'rankBucket',
    placeholder: '全部排名',
    options: [
      { value: 'top10', label: '前 10' },
      { value: 'top50', label: '前 50' },
      { value: 'top100', label: '前 100' },
      { value: 'ranked', label: '有排名' },
      { value: 'unranked', label: '无排名' },
    ],
  },
];

export default function AthletesAdminPage() {
  const { token } = useAdminAuth();
  return <EntityManager entityName="运动员" apiPath="/api/admin/athletes" columns={buildColumns(token)} FormComponent={AthleteForm} defaultFormData={defaultFormData} token={token} searchPlaceholder="搜索姓名 / 英文名 / 国籍..." additionalFilters={athleteFilters} enableBulkActions />;
}
