'use client';

import EntityManager from '@/components/admin/EntityManager';
import ImageUpload, { MultiImageUpload } from '@/components/admin/ImageUpload';
import MediaLibraryPicker from '@/components/admin/MediaLibraryPicker';
import { useAdminAuth } from '../layout';
import { useState } from 'react';

const stageOptions = [
  { value: '1', label: '跪姿基础' },
  { value: '2', label: '站立起步' },
  { value: '3', label: '站姿控船' },
  { value: '4', label: '落水与回板' },
  { value: '5', label: '支撑与走板' },
  { value: '6', label: '高阶转向与救援' },
];

const levelOptions = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高阶' },
];

const categoryOptions = [
  { value: 'foundation', label: '基础' },
  { value: 'paddling', label: '划行' },
  { value: 'turning', label: '转向' },
  { value: 'braking', label: '停止' },
  { value: 'balance', label: '平衡' },
  { value: 'posture', label: '姿态' },
  { value: 'safety', label: '安全' },
  { value: 'support', label: '支撑' },
  { value: 'footwork', label: '走板' },
  { value: 'maneuver', label: '控板' },
  { value: 'rescue', label: '救援' },
  { value: 'general', label: '通用' },
];

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function TechniqueForm({ data, onChange, token }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const [pickerMode, setPickerMode] = useState<'cover' | 'gallery' | null>(null);
  const input = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  const images = getStringArray(data.images);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">编号</label>
          <input className={input} value={String(data.source_code || '')} onChange={e => set('source_code', e.target.value)} placeholder="01" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-warm-gray-400 mb-1">动作名称 *</label>
          <input className={input} value={String(data.name || '')} onChange={e => set('name', e.target.value)} placeholder="站立划行" />
        </div>
      </div>
      <div className="rounded-xl border border-cream-200 bg-cream-100/60 p-4">
        <h3 className="mb-3 text-sm font-medium text-brown-700">动作图片</h3>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div>
            <ImageUpload
              value={String(data.cover_image || '')}
              onChange={(url) => set('cover_image', url)}
              folder="techniques"
              token={token}
              label="动作封面"
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
              folder="techniques"
              token={token}
              label="动作相册"
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
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">阶段</label>
          <select
            className={input}
            value={String(data.stage || '1')}
            onChange={e => {
              const option = stageOptions.find(item => item.value === e.target.value);
              onChange({ ...data, stage: Number(e.target.value), stage_label: option?.label || data.stage_label });
            }}
          >
            {stageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">阶段名</label>
          <input className={input} value={String(data.stage_label || '')} onChange={e => set('stage_label', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">难度</label>
          <select className={input} value={String(data.level || 'beginner')} onChange={e => set('level', e.target.value)}>
            {levelOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">分类</label>
          <select className={input} value={String(data.category || 'general')} onChange={e => set('category', e.target.value)}>
            {categoryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">分值</label>
          <input className={input} type="number" value={String(data.points ?? 1)} onChange={e => set('points', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">排序</label>
          <input className={input} type="number" value={String(data.sort_order ?? 0)} onChange={e => set('sort_order', Number(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">动作要点</label>
        <textarea className={input} rows={5} value={String(data.key_points || '')} onChange={e => set('key_points', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">常见错误</label>
        <textarea className={input} rows={3} value={String(data.common_errors || '')} onChange={e => set('common_errors', e.target.value)} />
      </div>
      <MediaLibraryPicker
        token={token}
        open={pickerMode !== null}
        multiple={pickerMode === 'gallery'}
        selectedUrls={pickerMode === 'gallery' ? images : (data.cover_image ? [String(data.cover_image)] : [])}
        folder="techniques"
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
  { key: 'source_code', label: '编号' },
  { key: 'cover_image', label: '封面', render: (v: unknown) => v ? <img src={String(v)} alt="" loading="lazy" decoding="async" className="h-10 w-14 rounded object-cover" /> : '—' },
  { key: 'name', label: '动作' },
  { key: 'stage_label', label: '阶段' },
  { key: 'level', label: '难度', render: (v: unknown) => levelOptions.find(option => option.value === String(v))?.label || String(v) },
  { key: 'category', label: '分类', render: (v: unknown) => categoryOptions.find(option => option.value === String(v))?.label || String(v) },
  { key: 'sort_order', label: '排序' },
];

const defaultFormData = {
  technique_id: undefined,
  source_code: '',
  name: '',
  cover_image: '',
  images: [],
  stage: 1,
  stage_label: '跪姿基础',
  level: 'beginner',
  category: 'general',
  points: 1,
  key_points: '',
  common_errors: '',
  sort_order: 0,
};

export default function TechniquesAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="技术动作"
      apiPath="/api/admin/techniques"
      getItemPath={(id) => `/api/admin/techniques/${id}`}
      columns={columns}
      FormComponent={TechniqueForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索动作名称 / 编号 / 要点..."
      additionalFilters={[
        { key: 'stage', placeholder: '全部阶段', options: stageOptions },
        { key: 'level', placeholder: '全部难度', options: levelOptions },
        { key: 'category', placeholder: '全部分类', options: categoryOptions },
      ]}
    />
  );
}
