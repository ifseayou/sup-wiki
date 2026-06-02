'use client';

import { useEffect, useMemo, useState } from 'react';

export interface MediaAsset {
  asset_id: number;
  url: string;
  folder: string | null;
  module?: string | null;
  athlete_upload?: {
    athlete_id: number;
    athlete_name: string;
    created_at?: string;
  } | null;
  filename: string | null;
  alt_text: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  created_at: string;
}

interface MediaLibraryPickerProps {
  token: string;
  open: boolean;
  multiple?: boolean;
  selectedUrls?: string[];
  folder?: string;
  onConfirm: (urls: string[]) => void;
  onClose: () => void;
}

export default function MediaLibraryPicker({
  token,
  open,
  multiple = true,
  selectedUrls = [],
  folder = '',
  onConfirm,
  onClose,
}: MediaLibraryPickerProps) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState(folder);
  const [picked, setPicked] = useState<string[]>(selectedUrls);

  useEffect(() => {
    if (!open) return;
    setPicked(selectedUrls);
  }, [open, selectedUrls]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ pageSize: '80', status: 'active' });
      if (search.trim()) params.set('search', search.trim());
      if (folderFilter) params.set('folder', folderFilter);
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
  }, [open, token, search, folderFilter]);

  const folders = useMemo(() => {
    const values = new Set(items.map((item) => item.folder).filter(Boolean) as string[]);
    if (folder) values.add(folder);
    return Array.from(values).sort();
  }, [items, folder]);

  if (!open) return null;

  function toggle(url: string) {
    if (multiple) {
      setPicked((prev) => prev.includes(url) ? prev.filter((item) => item !== url) : [...prev, url]);
    } else {
      setPicked([url]);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 md:items-center">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-t-2xl border border-cream-200 bg-cream-50 shadow-xl md:mx-4 md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-brown-800">从图片库选择</h2>
            <p className="mt-1 text-xs text-warm-gray-400">已选择 {picked.length} 张</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl leading-none text-warm-gray-400 hover:text-brown-600">×</button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-cream-200 px-5 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文件名 / 说明 / URL"
            className="w-64 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800"
          />
          <select
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
            className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800"
          >
            <option value="">全部目录</option>
            {folders.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-warm-gray-400">加载中...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-warm-gray-400">暂无图片</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {items.map((item) => {
                const active = picked.includes(item.url);
                return (
                  <button
                    key={item.asset_id}
                    type="button"
                    onClick={() => toggle(item.url)}
                    className={`group overflow-hidden rounded-lg border bg-white text-left transition-all ${
                      active ? 'border-brown-500 ring-2 ring-brown-500/20' : 'border-cream-200 hover:border-brown-300'
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-cream-100">
                      <img src={item.url} alt={item.alt_text || ''} className="h-full w-full object-cover" />
                      {active && (
                        <span className="absolute right-2 top-2 rounded-full bg-brown-600 px-2 py-0.5 text-xs text-white">已选</span>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="truncate text-xs font-medium text-brown-800">{item.filename || item.url}</div>
                      <div className="mt-1 truncate text-[11px] text-warm-gray-400">{item.folder || 'misc'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-cream-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-cream-300 px-4 py-2 text-sm text-warm-gray-600 hover:border-brown-500">取消</button>
          <button
            type="button"
            onClick={() => onConfirm(picked)}
            className="rounded-lg bg-brown-500 px-4 py-2 text-sm text-white hover:bg-brown-600"
          >
            使用所选图片
          </button>
        </div>
      </div>
    </div>
  );
}
