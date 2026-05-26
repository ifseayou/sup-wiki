'use client';

import EntityManager from '@/components/admin/EntityManager';
import { useAdminAuth } from '../layout';
import dynamic from 'next/dynamic';

const TechniqueForm = dynamic(() => import('./TechniqueForm'), {
  loading: () => <div className="py-10 text-center text-sm text-warm-gray-400">正在加载编辑表单...</div>,
});

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

const columns = [
  { key: 'source_code', label: '编号' },
  { key: 'cover_image', label: '封面', render: (v: unknown) => v ? <img src={String(v)} alt="" loading="lazy" decoding="async" className="h-10 w-14 rounded object-cover" /> : '—' },
  { key: 'name', label: '动作' },
  { key: 'image_count', label: '相册', render: (v: unknown) => `${Number(v || 0)} 张` },
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
