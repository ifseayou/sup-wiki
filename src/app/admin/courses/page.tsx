'use client';

import { useEffect, useMemo, useState } from 'react';
import EntityManager from '@/components/admin/EntityManager';
import ImageUpload, { MultiImageUpload } from '@/components/admin/ImageUpload';
import MediaLibraryPicker from '@/components/admin/MediaLibraryPicker';
import { useAdminAuth } from '../layout';

interface TechniqueOption {
  technique_id: number;
  source_code: string | null;
  name: string;
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
  const priceOptionsText = typeof data.price_options_text === 'string'
    ? data.price_options_text
    : JSON.stringify(data.price_options || [], null, 2);
  const images = getStringArray(data.images);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">课程名称 *</label>
          <input className={input} value={String(data.title || '')} onChange={e => set('title', e.target.value)} placeholder="桨板入门课" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">Slug *</label>
          <input className={input} value={String(data.slug || '')} onChange={e => set('slug', e.target.value)} placeholder="sup-beginner" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">副标题</label>
        <input className={input} value={String(data.subtitle || '')} onChange={e => set('subtitle', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">摘要</label>
        <textarea className={input} rows={2} value={String(data.summary || '')} onChange={e => set('summary', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">课程介绍</label>
        <textarea className={input} rows={4} value={String(data.description || '')} onChange={e => set('description', e.target.value)} />
      </div>
      <div className="rounded-xl border border-cream-200 bg-cream-100/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-brown-700">课程图片</h3>
            <p className="mt-1 text-xs text-warm-gray-400">上传后会自动进入全站图片库，也可以直接从图片库复用。</p>
          </div>
        </div>
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
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">费用展示</label>
          <input className={input} value={String(data.price_display || '')} onChange={e => set('price_display', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">时长（分钟）</label>
          <input className={input} type="number" value={String(data.duration_minutes ?? '')} onChange={e => set('duration_minutes', e.target.value ? Number(e.target.value) : '')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">场地</label>
          <input className={input} value={String(data.venue || '')} onChange={e => set('venue', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">课程时间说明</label>
          <input className={input} value={String(data.schedule_note || '')} onChange={e => set('schedule_note', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">器材说明</label>
          <input className={input} value={String(data.equipment_note || '')} onChange={e => set('equipment_note', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">板型说明</label>
          <input className={input} value={String(data.board_note || '')} onChange={e => set('board_note', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">价格选项 JSON</label>
        <textarea
          className={`${input} font-mono`}
          rows={5}
          value={priceOptionsText}
          onChange={e => {
            const nextText = e.target.value;
            try {
              onChange({ ...data, price_options_text: nextText, price_options: JSON.parse(nextText) });
            } catch {
              onChange({ ...data, price_options_text: nextText });
            }
          }}
        />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">排序</label>
        <input className={input} type="number" value={String(data.sort_order ?? 0)} onChange={e => set('sort_order', Number(e.target.value))} />
      </div>
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
  { key: 'price_display', label: '费用' },
  { key: 'duration_minutes', label: '时长', render: (v: unknown) => v ? `${v} 分钟` : '—' },
  { key: 'venue', label: '场地' },
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
