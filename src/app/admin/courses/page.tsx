'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import EntityManager from '@/components/admin/EntityManager';
import ImageUpload, { MultiImageUpload } from '@/components/admin/ImageUpload';
import MediaLibraryPicker from '@/components/admin/MediaLibraryPicker';
import { useAdminAuth } from '../layout';

interface TechniqueOption {
  technique_id: number;
  source_code: string | null;
  name: string;
  cover_image?: string | null;
  images?: unknown;
  stage: number;
  stage_label: string;
  level: string;
  category: string;
}

const levelLabels: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶',
};

function getIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function getTechniqueImage(item: TechniqueOption) {
  if (item.cover_image) return item.cover_image;
  if (Array.isArray(item.images)) {
    return item.images.find((url): url is string => typeof url === 'string' && url.length > 0) || '';
  }
  if (typeof item.images === 'string' && item.images) {
    try {
      const parsed = JSON.parse(item.images);
      return Array.isArray(parsed) ? parsed.find((url): url is string => typeof url === 'string' && url.length > 0) || '' : '';
    } catch {
      return '';
    }
  }
  return '';
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getObjectArray(value: unknown): Record<string, string>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map((item) => Object.fromEntries(Object.entries(item).map(([key, val]) => [key, String(val || '')])));
}

function FieldGroup({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-cream-200 bg-cream-100/60 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-brown-700">{title}</h3>
        {desc && <p className="mt-1 text-xs leading-5 text-warm-gray-400">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function StringListEditor({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: unknown;
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const items = getStringArray(value);
  const nextItems = items.length ? items : [''];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs text-warm-gray-400">{label}</label>
        <button type="button" onClick={() => onChange([...items, ''])} className="text-xs text-brown-600 hover:text-brown-800">+ 添加</button>
      </div>
      <div className="space-y-2">
        {nextItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              className="w-full rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-500 focus:ring-2 focus:ring-brown-500"
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const draft = [...nextItems];
                draft[index] = e.target.value;
                onChange(draft.map((text) => text.trim()).filter(Boolean));
              }}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              className="rounded-lg border border-cream-300 px-3 text-xs text-warm-gray-500 hover:border-red-300 hover:text-red-500"
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PairListEditor({
  label,
  value,
  onChange,
  firstKey,
  secondKey,
  firstPlaceholder,
  secondPlaceholder,
}: {
  label: string;
  value: unknown;
  onChange: (value: Record<string, string>[]) => void;
  firstKey: string;
  secondKey: string;
  firstPlaceholder: string;
  secondPlaceholder: string;
}) {
  const items = getObjectArray(value);
  const nextItems = items.length ? items : [{ [firstKey]: '', [secondKey]: '' }];
  const update = (index: number, key: string, nextValue: string) => {
    const draft = nextItems.map((item) => ({ ...item }));
    draft[index][key] = nextValue;
    onChange(draft.filter((item) => String(item[firstKey] || '').trim() || String(item[secondKey] || '').trim()));
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs text-warm-gray-400">{label}</label>
        <button type="button" onClick={() => onChange([...items, { [firstKey]: '', [secondKey]: '' }])} className="text-xs text-brown-600 hover:text-brown-800">+ 添加</button>
      </div>
      <div className="space-y-3">
        {nextItems.map((item, index) => (
          <div key={index} className="rounded-lg border border-cream-200 bg-cream-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-warm-gray-400">第 {index + 1} 条</span>
              <button type="button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="text-xs text-red-500">删除</button>
            </div>
            <input
              className="mb-2 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800"
              value={item[firstKey] || ''}
              placeholder={firstPlaceholder}
              onChange={(e) => update(index, firstKey, e.target.value)}
            />
            <textarea
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800"
              rows={2}
              value={item[secondKey] || ''}
              placeholder={secondPlaceholder}
              onChange={(e) => update(index, secondKey, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachProfileEditor({ value, onChange }: { value: unknown; onChange: (value: Record<string, string>) => void }) {
  const profile = getRecord(value);
  const setField = (key: string, nextValue: string) => onChange({ ...profile, [key]: nextValue } as Record<string, string>);
  const input = 'w-full rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800';
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[
        ['name', '教练姓名 / 昵称'],
        ['experience', '训练与桨板经历'],
        ['specialties', '擅长方向'],
        ['philosophy', '教学理念'],
        ['certificates', '证书或资质说明'],
      ].map(([key, label]) => (
        <div key={key} className={key === 'certificates' ? 'md:col-span-2' : ''}>
          <label className="mb-1 block text-xs text-warm-gray-400">{label}</label>
          <textarea className={input} rows={key === 'name' ? 1 : 2} value={String(profile[key] || '')} onChange={(e) => setField(key, e.target.value)} />
        </div>
      ))}
    </div>
  );
}

function TechniquePicker({
  token,
  selectedIds,
  onSelect,
}: {
  token: string;
  selectedIds: number[];
  onSelect: (ids: number[]) => void;
}) {
  const [items, setItems] = useState<TechniqueOption[]>([]);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [level, setLevel] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/techniques?pageSize=200&status=published', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setItems(data.items || []);
    }
    void load();
  }, [token]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = items.filter((item) => {
    const keyword = search.trim().toLowerCase();
    const matchSearch = !keyword || `${item.source_code || ''} ${item.name} ${item.stage_label}`.toLowerCase().includes(keyword);
    const matchStage = !stage || String(item.stage) === stage;
    const matchLevel = !level || item.level === level;
    return matchSearch && matchStage && matchLevel;
  });

  function toggle(id: number) {
    if (selectedSet.has(id)) {
      onSelect(selectedIds.filter((selected) => selected !== id));
    } else {
      onSelect([...selectedIds, id]);
    }
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-cream-100/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-brown-700">课程技术动作</h3>
          <p className="mt-1 text-xs text-warm-gray-400">已选择 {selectedIds.length} 个动作</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect([])}
          className="text-xs text-warm-gray-400 hover:text-brown-600"
        >
          清空
        </button>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索动作"
          className="px-3 py-2 border border-cream-300 rounded-lg text-sm bg-cream-50 text-brown-800"
        />
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="px-3 py-2 border border-cream-300 rounded-lg text-sm bg-cream-50 text-brown-800">
          <option value="">全部阶段</option>
          {Array.from(new Set(items.map((item) => item.stage))).sort((a, b) => a - b).map((stageNo) => {
            const label = items.find((item) => item.stage === stageNo)?.stage_label || `阶段 ${stageNo}`;
            return <option key={stageNo} value={stageNo}>{label}</option>;
          })}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="px-3 py-2 border border-cream-300 rounded-lg text-sm bg-cream-50 text-brown-800">
          <option value="">全部难度</option>
          <option value="beginner">入门</option>
          <option value="intermediate">进阶</option>
          <option value="advanced">高阶</option>
        </select>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {filtered.map((item) => (
          <label
            key={item.technique_id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-all ${
              selectedSet.has(item.technique_id)
                ? 'border-brown-500 bg-cream-50 text-brown-800'
                : 'border-cream-200 bg-cream-50/60 text-warm-gray-600 hover:border-cream-300'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedSet.has(item.technique_id)}
              onChange={() => toggle(item.technique_id)}
              className="mt-1"
            />
            <span className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-cream-200">
              {getTechniqueImage(item) ? (
                <img src={getTechniqueImage(item)} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-xs font-semibold text-brown-500">{item.source_code || item.stage}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {item.source_code ? `${item.source_code}. ` : ''}{item.name}
              </span>
              <span className="mt-0.5 block text-xs text-warm-gray-400">
                {item.stage_label} · {levelLabels[item.level] || item.level}
              </span>
            </span>
          </label>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-warm-gray-400">暂无符合条件的动作</div>
        )}
      </div>
    </div>
  );
}

function CourseForm({ data, onChange, token }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const [pickerMode, setPickerMode] = useState<'cover' | 'gallery' | null>(null);
  const input = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  const images = getStringArray(data.images);

  return (
    <div className="space-y-4">
      <FieldGroup title="A. 基本招生信息" desc="前台课程卡片和小程序课程卡优先展示这些信息。">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">课程名称 *</label>
            <input className={input} value={String(data.title || '')} onChange={e => set('title', e.target.value)} placeholder="桨板入门课" />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">Slug *</label>
            <input className={input} value={String(data.slug || '')} onChange={e => set('slug', e.target.value)} placeholder="sup-beginner" />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">课程类型</label>
            <select className={input} value={String(data.course_type || 'custom')} onChange={e => set('course_type', e.target.value)}>
              <option value="experience">体验课</option>
              <option value="beginner">入门课</option>
              <option value="advanced">进阶课</option>
              <option value="combo">入门&进阶</option>
              <option value="custom">其他课程</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">副标题</label>
            <input className={input} value={String(data.subtitle || '')} onChange={e => set('subtitle', e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">一句话定位</label>
          <input className={input} value={String(data.positioning || '')} onChange={e => set('positioning', e.target.value)} placeholder="5 小时从安全下水到独立划行" />
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">摘要</label>
          <textarea className={input} rows={2} value={String(data.summary || '')} onChange={e => set('summary', e.target.value)} />
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">详细介绍</label>
          <textarea className={input} rows={4} value={String(data.description || '')} onChange={e => set('description', e.target.value)} />
        </div>
      </FieldGroup>

      <FieldGroup title="B. 课程图片" desc="上传后会自动进入全站图片库，也可以直接从图片库复用。">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div>
            <ImageUpload
              value={String(data.cover_image || '')}
              onChange={(url) => set('cover_image', url)}
              folder="courses"
              token={token}
              label="课程封面"
            />
            <button
              type="button"
              onClick={() => setPickerMode('cover')}
              className="mt-2 rounded-lg border border-cream-300 px-3 py-1.5 text-xs text-brown-600 hover:border-brown-500"
            >
              从图片库选择封面
            </button>
          </div>
          <div>
            <MultiImageUpload
              values={images}
              onChange={(urls) => set('images', urls)}
              folder="courses"
              token={token}
              label="课程相册"
              max={12}
              sortable
            />
            <button
              type="button"
              onClick={() => setPickerMode('gallery')}
              className="mt-2 rounded-lg border border-cream-300 px-3 py-1.5 text-xs text-brown-600 hover:border-brown-500"
            >
              从图片库添加到相册
            </button>
          </div>
        </div>
      </FieldGroup>

      <FieldGroup title="C. 价格、地点与排课">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">费用展示</label>
            <input className={input} value={String(data.price_display || '')} onChange={e => set('price_display', e.target.value)} placeholder="598元/5小时/人" />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">时长（分钟）</label>
            <input className={input} type="number" value={String(data.duration_minutes ?? '')} onChange={e => set('duration_minutes', e.target.value ? Number(e.target.value) : '')} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">场地</label>
            <input className={input} value={String(data.venue || '')} onChange={e => set('venue', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">课程时间说明</label>
            <input className={input} value={String(data.schedule_note || '')} onChange={e => set('schedule_note', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">人数限制</label>
            <input className={input} value={String(data.capacity_note || '')} onChange={e => set('capacity_note', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">年龄说明</label>
            <input className={input} value={String(data.age_note || '')} onChange={e => set('age_note', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">器材说明</label>
            <input className={input} value={String(data.equipment_note || '')} onChange={e => set('equipment_note', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">板型说明</label>
            <input className={input} value={String(data.board_note || '')} onChange={e => set('board_note', e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <PairListEditor
            label="价格选项"
            value={data.price_options}
            onChange={(value) => set('price_options', value)}
            firstKey="label"
            secondKey="price"
            firstPlaceholder="入门课"
            secondPlaceholder="598元/5小时/人"
          />
        </div>
      </FieldGroup>

      <FieldGroup title="D. 适合人群与学习成果">
        <div className="grid gap-4 md:grid-cols-2">
          <StringListEditor label="卡片标签" value={data.audience_tags} onChange={(value) => set('audience_tags', value)} placeholder="零基础" />
          <StringListEditor label="适合人群" value={data.target_audience} onChange={(value) => set('target_audience', value)} placeholder="第一次接触桨板的人" />
          <StringListEditor label="需提前沟通人群" value={data.consultation_required} onChange={(value) => set('consultation_required', value)} placeholder="不会游泳或明显怕水的人" />
          <StringListEditor label="学完能获得什么" value={data.learning_outcomes} onChange={(value) => set('learning_outcomes', value)} placeholder="独立完成上下水、站立和直线划行" />
        </div>
      </FieldGroup>

      <FieldGroup title="E. 费用、安全和退改规则">
        <div className="grid gap-4 md:grid-cols-2">
          <StringListEditor label="费用包含" value={data.includes} onChange={(value) => set('includes', value)} placeholder="课程教学" />
          <StringListEditor label="费用不包含" value={data.excludes} onChange={(value) => set('excludes', value)} placeholder="个人交通" />
          <StringListEditor label="学员需自带" value={data.bring_items} onChange={(value) => set('bring_items', value)} placeholder="速干衣物" />
          <StringListEditor label="安全保障" value={data.safety_notes} onChange={(value) => set('safety_notes', value)} placeholder="全程穿戴救生衣" />
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">天气 / 改期 / 退款规则</label>
          <textarea className={input} rows={3} value={String(data.change_policy || '')} onChange={e => set('change_policy', e.target.value)} />
        </div>
      </FieldGroup>

      <FieldGroup title="F. 上课流程、教练与 FAQ">
        <div className="space-y-4">
          <PairListEditor
            label="上课流程"
            value={data.class_flow}
            onChange={(value) => set('class_flow', value)}
            firstKey="title"
            secondKey="description"
            firstPlaceholder="集合签到"
            secondPlaceholder="确认身体状况，穿戴装备"
          />
          <CoachProfileEditor value={data.coach_profile} onChange={(value) => set('coach_profile', value)} />
          <PairListEditor
            label="FAQ 常见问题"
            value={data.faq}
            onChange={(value) => set('faq', value)}
            firstKey="question"
            secondKey="answer"
            firstPlaceholder="不会游泳可以参加吗？"
            secondPlaceholder="可以提前沟通。课程全程穿救生衣..."
          />
        </div>
      </FieldGroup>

      <FieldGroup title="G. 报名与发布">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">微信号</label>
            <input className={input} value={String(data.wechat_id || 'i_add_u')} onChange={e => set('wechat_id', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">按钮文案</label>
            <input className={input} value={String(data.cta_text || '微信咨询课程')} onChange={e => set('cta_text', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">排序</label>
            <input className={input} type="number" value={String(data.sort_order ?? 0)} onChange={e => set('sort_order', Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">报名备注说明</label>
          <textarea className={input} rows={3} value={String(data.enrollment_note || '')} onChange={e => set('enrollment_note', e.target.value)} />
        </div>
      </FieldGroup>

      <TechniquePicker
        token={token}
        selectedIds={getIds(data.technique_ids)}
        onSelect={(ids) => set('technique_ids', ids)}
      />
      <MediaLibraryPicker
        token={token}
        open={pickerMode !== null}
        multiple={pickerMode === 'gallery'}
        selectedUrls={pickerMode === 'gallery' ? images : (data.cover_image ? [String(data.cover_image)] : [])}
        folder="courses"
        onClose={() => setPickerMode(null)}
        onConfirm={(urls) => {
          if (pickerMode === 'cover') {
            set('cover_image', urls[0] || '');
          } else if (pickerMode === 'gallery') {
            set('images', Array.from(new Set([...images, ...urls])));
          }
          setPickerMode(null);
        }}
      />
    </div>
  );
}

const columns = [
  { key: 'title', label: '课程' },
  { key: 'cover_image', label: '封面', render: (v: unknown) => v ? <img src={String(v)} alt="" className="h-10 w-14 rounded object-cover" /> : '—' },
  { key: 'course_type', label: '类型', render: (v: unknown) => ({ experience: '体验', beginner: '入门', advanced: '进阶', combo: '完整' }[String(v)] || '其他') },
  { key: 'price_display', label: '费用' },
  { key: 'duration_minutes', label: '时长', render: (v: unknown) => v ? `${v} 分钟` : '—' },
  { key: 'audience_tags', label: '标签', render: (v: unknown) => getStringArray(v).slice(0, 3).join(' / ') || '—' },
  { key: 'techniques_count', label: '动作数', render: (v: unknown) => String(v || 0) },
  { key: 'sort_order', label: '排序' },
];

const defaultFormData = {
  course_id: undefined,
  slug: '',
  title: '',
  subtitle: '',
  summary: '',
  description: '',
  cover_image: '',
  images: [],
  venue: '中流击水桨板俱乐部（余杭塘河-梦想小镇段）',
  schedule_note: '课程时间和教练自行约定',
  equipment_note: '',
  board_note: '',
  course_type: 'custom',
  positioning: '',
  audience_tags: [],
  target_audience: [],
  consultation_required: [],
  learning_outcomes: [],
  capacity_note: '',
  age_note: '',
  includes: [],
  excludes: [],
  bring_items: [],
  safety_notes: [],
  class_flow: [],
  change_policy: '',
  coach_profile: {
    name: 'i_add_u',
    experience: '',
    specialties: '',
    philosophy: '',
    certificates: '',
  },
  faq: [],
  enrollment_note: '',
  wechat_id: 'i_add_u',
  cta_text: '微信咨询课程',
  duration_minutes: '',
  price_display: '',
  price_options: [],
  technique_ids: [],
  sort_order: 0,
};

export default function CoursesAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="课程"
      apiPath="/api/admin/courses"
      columns={columns}
      FormComponent={CourseForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索课程名称 / 摘要..."
    />
  );
}
