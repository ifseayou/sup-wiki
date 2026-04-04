'use client';

import EntityManager from '@/components/admin/EntityManager';
import ImageUpload from '@/components/admin/ImageUpload';
import { useAdminAuth } from '../layout';

function CreatorForm({ data, onChange, token }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  return (
    <div className="space-y-4">
      <ImageUpload value={String(data.avatar || '')} onChange={url => set('avatar', url)} folder="creators" token={token} label="博主头像" />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">昵称 *</label>
          <input className={inp} value={String(data.nickname || '')} onChange={e => set('nickname', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">平台 *</label>
          <select className={inp} value={String(data.platform || 'douyin')} onChange={e => set('platform', e.target.value)}>
            <option value="douyin">抖音</option>
            <option value="xiaohongshu">小红书</option>
            <option value="bilibili">B站</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="weibo">微博</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">粉丝量级</label>
          <select className={inp} value={String(data.follower_tier || '1k-10k')} onChange={e => set('follower_tier', e.target.value)}>
            <option value="1k-10k">1k-10k</option>
            <option value="10k-100k">10k-100k</option>
            <option value="100k-1m">100k-1m</option>
            <option value="1m+">1m+</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">内容风格</label>
          <select className={inp} value={String(data.content_style || 'vlog')} onChange={e => set('content_style', e.target.value)}>
            <option value="tutorial">教学</option>
            <option value="review">测评</option>
            <option value="vlog">Vlog</option>
            <option value="adventure">探险</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">主页链接</label>
        <input className={inp} value={String(data.profile_url || '')} onChange={e => set('profile_url', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">简介</label>
        <textarea className={inp} rows={3} value={String(data.bio || '')} onChange={e => set('bio', e.target.value)} />
      </div>
    </div>
  );
}

const columns = [
  { key: 'nickname', label: '昵称' },
  { key: 'platform', label: '平台', render: (v: unknown) => ({'douyin':'抖音','xiaohongshu':'小红书','bilibili':'B站','youtube':'YouTube','instagram':'Instagram','weibo':'微博'}[String(v)] || String(v)) },
  { key: 'follower_tier', label: '粉丝量级' },
  { key: 'content_style', label: '内容风格', render: (v: unknown) => ({'tutorial':'教学','review':'测评','vlog':'Vlog','adventure':'探险'}[String(v)] || String(v)) },
];
const defaultFormData = { creator_id: undefined, nickname: '', platform: 'douyin', follower_tier: '1k-10k', content_style: 'vlog', profile_url: '', avatar: '', bio: '' };

export default function CreatorsAdminPage() {
  const { token } = useAdminAuth();
  return <EntityManager entityName="博主" apiPath="/api/admin/creators" columns={columns} FormComponent={CreatorForm} defaultFormData={defaultFormData} token={token} searchPlaceholder="搜索昵称..." />;
}
