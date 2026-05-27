'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../layout';
import ImageUpload from '@/components/admin/ImageUpload';
import type { MediaAsset } from '@/components/admin/MediaLibraryPicker';
import {
  MEDIA_MODULE_DEFAULT_FOLDERS,
  MEDIA_MODULE_LABELS,
  MEDIA_MODULES,
  type MediaModule,
} from '@/lib/media-modules';

interface MediaResponse {
  items?: MediaAsset[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  moduleCounts?: Record<string, number>;
}

const PAGE_SIZE_OPTIONS = [24, 48, 72];
const MODULE_FILTERS: Array<{ value: '' | MediaModule; label: string }> = [
  { value: '', label: '全部' },
  ...MEDIA_MODULES.map((value) => ({ value, label: MEDIA_MODULE_LABELS[value] })),
];

function getModuleCount(moduleCounts: Record<string, number>, module: '' | MediaModule, total: number) {
  if (!module) {
    const counted = Object.values(moduleCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    return counted || total;
  }
  return moduleCounts[module] || 0;
}

export default function MediaAdminPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [module, setModule] = useState<'' | MediaModule>('system');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});
  const [refresh, setRefresh] = useState(0);
  const [externalUrl, setExternalUrl] = useState('');
  const [message, setMessage] = useState('');

  const uploadFolder = folder.trim() || (module ? MEDIA_MODULE_DEFAULT_FOLDERS[module] : 'media');
  const knownFolders = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => {
      if (item.folder) values.add(item.folder);
    });
    if (folder.trim()) values.add(folder.trim());
    return Array.from(values).sort();
  }, [items, folder]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        status: 'active',
        page: String(page),
        pageSize: String(pageSize),
      });
      if (module) params.set('module', module);
      if (search.trim()) params.set('search', search.trim());
      if (folder.trim()) params.set('folder', folder.trim());
      try {
        const res = await fetch(`/api/admin/media?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as MediaResponse;
        if (!cancelled && res.ok) {
          setItems(data.items || []);
          setTotal(Number(data.total || 0));
          setTotalPages(Math.max(1, Number(data.totalPages || 1)));
          setModuleCounts(data.moduleCounts || {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const timer = window.setTimeout(load, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, search, folder, module, page, pageSize, refresh]);

  useEffect(() => {
    setPage(1);
  }, [search, folder, module, pageSize]);

  async function addExternal() {
    if (!externalUrl.trim()) return;
    setMessage('');
    const res = await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        url: externalUrl.trim(),
        folder: uploadFolder || 'external',
        module: module || 'system',
        source_context: 'manual',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setExternalUrl('');
      setRefresh((tick) => tick + 1);
      setMessage('图片已加入图片库。');
    } else {
      setMessage(data.error || '加入图片库失败');
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

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown-800">图片库管理</h1>
          <p className="mt-1 text-sm text-warm-gray-400">上传后的 OSS 图片按业务模块归档，可在后台内容中复用。</p>
        </div>
        <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-sm text-warm-gray-500">
          共 <span className="font-semibold text-brown-700">{total}</span> 张
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-5">
        {MODULE_FILTERS.map((item) => {
          const active = module === item.value;
          return (
            <button
              key={item.value || 'all'}
              type="button"
              onClick={() => setModule(item.value)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-brown-500 bg-brown-50 text-brown-800 shadow-sm'
                  : 'border-cream-200 bg-cream-50 text-warm-gray-500 hover:border-brown-300 hover:text-brown-700'
              }`}
            >
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="mt-1 text-xs opacity-70">{getModuleCount(moduleCounts, item.value, total)} 张图片</div>
            </button>
          );
        })}
      </div>

      <div className="mb-5 grid gap-4 rounded-xl border border-cream-200 bg-cream-50 p-5 lg:grid-cols-[320px_1fr]">
        <ImageUpload
          value=""
          onChange={() => setRefresh((tick) => tick + 1)}
          folder={uploadFolder}
          module={module || 'system'}
          token={token}
          label={`上传新图片${module ? ` · ${MEDIA_MODULE_LABELS[module]}` : ''}`}
        />
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文件名 / URL / 说明"
              className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800"
            />
            <select
              value={module}
              onChange={(e) => setModule(e.target.value as '' | MediaModule)}
              className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800"
            >
              {MODULE_FILTERS.map((item) => (
                <option key={item.value || 'all-select'} value={item.value}>{item.label}模块</option>
              ))}
            </select>
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              list="media-folder-options"
              placeholder={`目录，如 ${uploadFolder}`}
              className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800"
            />
            <datalist id="media-folder-options">
              {knownFolders.map((item) => <option key={item} value={item} />)}
            </datalist>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-warm-gray-500">
            第 {page} / {totalPages} 页，每页
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="mx-2 rounded-md border border-cream-300 bg-cream-50 px-2 py-1 text-brown-800"
            >
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            张
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrev || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm text-brown-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={!canNext || loading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm text-brown-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-warm-gray-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-warm-gray-400">暂无图片</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => {
              const itemModule = (item.module || 'system') as MediaModule;
              return (
                <div key={item.asset_id} className="overflow-hidden rounded-lg border border-cream-200 bg-white">
                  <div className="aspect-[4/3] bg-cream-100">
                    <img src={item.url} alt={item.alt_text || ''} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3">
                    <div className="truncate text-xs font-medium text-brown-800">{item.filename || item.url}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full bg-brown-50 px-2 py-0.5 text-[11px] text-brown-700">
                        {MEDIA_MODULE_LABELS[itemModule] || '系统'}
                      </span>
                      <span className="max-w-full truncate rounded-full bg-cream-100 px-2 py-0.5 text-[11px] text-warm-gray-500">
                        {item.folder || 'misc'}
                      </span>
                    </div>
                    <div className="mt-2 truncate text-[11px] text-warm-gray-400">{item.created_at?.slice(0, 10) || ''}</div>
                    <div className="mt-3 flex items-center gap-3">
                      <button onClick={() => hide(item.asset_id)} className="text-xs text-red-400 hover:text-red-600">
                        隐藏
                      </button>
                      <button onClick={() => remove(item.asset_id)} className="text-xs text-red-500 hover:text-red-700">
                        删除 OSS
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
