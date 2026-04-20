'use client';

import EntityManager from '@/components/admin/EntityManager';
import { useAdminAuth } from '../layout';

const categoryOptions = [
  { value: 'muscle', label: '肌肉训练' },
  { value: 'stretch', label: '拉伸指南' },
  { value: 'technique', label: '技术动作' },
  { value: 'safety', label: '安全知识' },
  { value: 'equipment', label: '装备知识' },
  { value: 'general', label: '通用' },
];

const difficultyOptions = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '专家' },
];

function LearnDocForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">标题 *</label>
          <input className={inp} value={String(data.title || '')} onChange={e => set('title', e.target.value)} placeholder="如：桨板需要锻炼的肌肉模块" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">Slug *</label>
          <input className={inp} value={String(data.slug || '')} onChange={e => set('slug', e.target.value)} placeholder="sup-muscle-groups" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">分类</label>
          <select className={inp} value={String(data.category || 'muscle')} onChange={e => set('category', e.target.value)}>
            {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">难度</label>
          <select className={inp} value={String(data.difficulty || 'beginner')} onChange={e => set('difficulty', e.target.value)}>
            {difficultyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">排序（数字越小越靠前）</label>
          <input className={inp} type="number" value={String(data.sort_order ?? 0)} onChange={e => set('sort_order', Number(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">摘要（列表卡片描述）</label>
        <textarea className={inp} rows={2} value={String(data.summary || '')} onChange={e => set('summary', e.target.value)} placeholder="一两句话概括文档要点..." />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">
          正文内容（Markdown：## 标题、**加粗**、- 列表、| 表格、![图](URL)）
        </label>
        <textarea
          className={`${inp} font-mono`}
          rows={24}
          value={String(data.content || '')}
          onChange={e => set('content', e.target.value)}
          placeholder={'## 一级段落标题\n\n正文内容...\n\n![示意图](https://...)'}
          style={{ fontSize: 12, lineHeight: 1.6 }}
        />
      </div>
    </div>
  );
}

const columns = [
  { key: 'title', label: '标题' },
  { key: 'category', label: '分类', render: (v: unknown) => categoryOptions.find(o => o.value === String(v))?.label || String(v) },
  { key: 'difficulty', label: '难度', render: (v: unknown) => difficultyOptions.find(o => o.value === String(v))?.label || String(v) },
  { key: 'sort_order', label: '排序' },
  { key: 'updated_at', label: '更新', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('zh-CN') : '' },
];

const defaultFormData = {
  article_id: undefined,
  title: '',
  slug: '',
  category: 'muscle',
  difficulty: 'beginner',
  summary: '',
  content: '',
  sort_order: 0,
};

export default function LearnDocsAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="学习文档"
      apiPath="/api/admin/learn-docs"
      columns={columns}
      FormComponent={LearnDocForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索标题..."
    />
  );
}
