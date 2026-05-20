'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';
import ImageUpload from '@/components/admin/ImageUpload';
import type { MediaAsset } from '@/components/admin/MediaLibraryPicker';

export default function MediaAdminPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [externalUrl, setExternalUrl] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ status: 'active', pageSize: '80' });
      if (search.trim()) params.set('search', search.trim());
      if (folder.trim()) params.set('folder', folder.trim());
      try {
        const res = await fetch(`/api/admin/media?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok) setItems(data.items || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const timer = window.setTimeout(load, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, search, folder, refresh]);

  async function addExternal() {
    if (!externalUrl.trim()) return;
    setMessage('');
    const res = await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: externalUrl.trim(), folder: folder || 'external', source_context: 'manual' }),
    });
    if (res.ok) {
      setExternalUrl('');
      setRefresh((tick) => tick + 1);
    }
  }

  async function hide(id: number) {
    setMessage('');
    const res = await fetch(`/api/admin/media/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setRefresh((tick) => tick + 1);
  }

  async function remove(id: number) {
    if (!window.confirm('确认永久删除这张图片？系统会先检查是否仍被内容引用，删除后也会尝试清理 OSS 文件。')) return;
    setMessage('');
    const res = await fetch(`/api/admin/media/${id}?permanent=1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage('图片已从图片库删除。');
      setRefresh((tick) => tick + 1);
      return;
    }
    const refs = Array.isArray(data.references)
      ? `：${data.references.map((item: { label: string; count: number }) => `${item.label}${item.count}处`).join('、')}`
      : '';
    setMessage(`${data.error || '删除失败'}${refs}`);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brown-800">图片库管理</h1>
          <p className="mt-1 text-sm text-warm-gray-400">上传后的 OSS 图片会自动进入图片库，可在课程等内容中复用。</p>
        </div>
      </div>

      <div className="mb-5 grid gap-4 rounded-xl border border-cream-200 bg-cream-50 p-5 lg:grid-cols-[320px_1fr]">
        <ImageUpload
          value=""
          onChange={() => setRefresh((tick) => tick + 1)}
          folder={folder || 'media'}
          token={token}
          label="上传新图片"
        />
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文件名 / URL / 说明"
              className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800"
            />
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="目录筛选，如 courses"
              className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="登记已有图片 URL"
              className="flex-1 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800"
            />
            <button onClick={addExternal} className="rounded-lg bg-brown-500 px-4 py-2 text-sm text-white hover:bg-brown-600">
              加入图片库
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-cream-200 bg-white px-4 py-3 text-sm text-brown-700">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-cream-200 bg-cream-50 p-5">
        {loading ? (
          <div className="py-16 text-center text-sm text-warm-gray-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-warm-gray-400">暂无图片</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => (
              <div key={item.asset_id} className="overflow-hidden rounded-lg border border-cream-200 bg-white">
                <div className="aspect-[4/3] bg-cream-100">
                  <img src={item.url} alt={item.alt_text || ''} className="h-full w-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="truncate text-xs font-medium text-brown-800">{item.filename || item.url}</div>
                  <div className="mt-1 truncate text-[11px] text-warm-gray-400">{item.folder || 'misc'}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <button onClick={() => hide(item.asset_id)} className="text-xs text-red-400 hover:text-red-600">
                      隐藏
                    </button>
                    <button onClick={() => remove(item.asset_id)} className="text-xs text-red-500 hover:text-red-700">
                      删除 OSS
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
