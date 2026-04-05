'use client';

import EntityManager from '@/components/admin/EntityManager';
import ImageUpload from '@/components/admin/ImageUpload';
import { useAdminAuth } from '../layout';

const CATEGORIES = [
  { value: 'equipment', label: '装备知识' },
  { value: 'technique', label: '技术动作' },
  { value: 'race', label: '竞赛规则' },
  { value: 'safety', label: '安全知识' },
  { value: 'maintenance', label: '保养维护' },
  { value: 'history', label: '运动历史' },
];

const DIFFICULTIES = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高级' },
];

function QuestionForm({ data, onChange, token }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';

  const options = Array.isArray(data.options) ? (data.options as string[]) : ['', '', '', ''];

  function setOption(i: number, val: string) {
    const newOpts = [...options];
    newOpts[i] = val;
    set('options', newOpts.filter(o => o !== '').length > 0 ? newOpts : options);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">题目 *</label>
        <textarea className={inp} rows={3} value={String(data.question || '')} onChange={e => set('question', e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">题型</label>
          <select className={inp} value={String(data.type || 'single')} onChange={e => set('type', e.target.value)}>
            <option value="single">单选</option>
            <option value="multiple">多选</option>
            <option value="truefalse">判断</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">分类</label>
          <select className={inp} value={String(data.category || 'equipment')} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">难度</label>
          <select className={inp} value={String(data.difficulty || 'beginner')} onChange={e => set('difficulty', e.target.value)}>
            {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">选项（每行一个，判断题填"正确"和"错误"）</label>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-warm-gray-400 w-5">{String.fromCharCode(65 + i)}.</span>
            <input className={inp} value={options[i] || ''} onChange={e => setOption(i, e.target.value)} placeholder={`选项 ${String.fromCharCode(65 + i)}`} />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">正确答案（单选/判断填索引如 0，多选填 JSON 数组如 [0,2]）</label>
        <input className={inp} value={
          Array.isArray(data.correct) ? JSON.stringify(data.correct) : String(data.correct ?? '')
        } onChange={e => {
          try {
            const v = JSON.parse(e.target.value);
            set('correct', v);
          } catch {
            set('correct', e.target.value);
          }
        }} placeholder="0 或 [0,2]" style={{ maxWidth: 200 }} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">解析说明</label>
        <textarea className={inp} rows={3} value={String(data.explanation || '')} onChange={e => set('explanation', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">解析配图</label>
        <ImageUpload
          value={String(data.explanation_image || '')}
          onChange={url => set('explanation_image', url)}
          folder="quiz-images"
          token={token}
          label="解析配图"
        />
        <p className="text-xs text-warm-gray-400 mt-1">也可直接填写图片 URL（如 /quiz-images/leash-types.svg）</p>
        <input
          className={inp}
          value={String(data.explanation_image || '')}
          onChange={e => set('explanation_image', e.target.value)}
          placeholder="/quiz-images/xxx.svg 或 https://..."
          style={{ marginTop: 4 }}
        />
      </div>
    </div>
  );
}

const columns = [
  { key: 'question', label: '题目', render: (v: unknown) => String(v).slice(0, 40) + (String(v).length > 40 ? '...' : '') },
  { key: 'type', label: '题型', render: (v: unknown) => ({ single: '单选', multiple: '多选', truefalse: '判断' }[String(v)] || String(v)) },
  { key: 'category', label: '分类', render: (v: unknown) => ({ equipment: '装备', technique: '技术', race: '竞赛', safety: '安全', maintenance: '保养', history: '历史' }[String(v)] || String(v)) },
  { key: 'difficulty', label: '难度', render: (v: unknown) => ({ beginner: '入门', intermediate: '进阶', advanced: '高级' }[String(v)] || String(v)) },
];

const defaultFormData = {
  question_id: undefined, question: '', type: 'single', options: ['', '', '', ''],
  correct: 0, explanation: '', explanation_image: '', category: 'equipment', difficulty: 'beginner',
};

export default function LearnQuestionsPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="题目"
      apiPath="/api/admin/learn-questions"
      columns={columns}
      FormComponent={QuestionForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索题目..."
    />
  );
}
