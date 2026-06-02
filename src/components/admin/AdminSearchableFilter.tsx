'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { readAdminResponse } from '@/lib/admin-api-client';

export interface AdminSearchableFilterOption {
  label: string;
  value: string;
  meta?: string | null;
}

export default function AdminSearchableFilter({
  value,
  placeholder,
  endpoint,
  token,
  onChange,
  className = '',
  disabled = false,
}: {
  value: string;
  placeholder: string;
  endpoint: string;
  token: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<AdminSearchableFilterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayValue = useMemo(() => {
    const selected = options.find((option) => option.value === value);
    return selected?.label || value || '';
  }, [options, value]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open || disabled) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL(endpoint, window.location.origin);
        if (search.trim()) url.searchParams.set('search', search.trim());
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readAdminResponse(res);
        setOptions(Array.isArray(data.items) ? data.items : []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [disabled, endpoint, open, search, token]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setSearch('');
          setOpen((current) => !current);
        }}
        className="flex h-10 w-full min-w-[150px] items-center justify-between gap-3 rounded-lg border border-[#D8CCBA] bg-white px-3 text-left text-sm text-[#5E5144] outline-none transition hover:border-[#B99A70] focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10 disabled:cursor-not-allowed disabled:bg-[#F3EDE5] disabled:text-[#A69B8F]"
      >
        <span className={`truncate ${value ? 'font-semibold text-[#3A2F24]' : 'text-[#B1A69A]'}`}>{displayValue || placeholder}</span>
        <svg className={`h-4 w-4 shrink-0 text-[#9C8669] transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-[#D8C9B6] bg-[#FFFDF9] shadow-[0_18px_45px_rgba(47,35,24,0.16)]">
          <div className="border-b border-[#F1E7DA] p-2">
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={placeholder}
              className="h-9 w-full rounded-md border border-[#D8CCBA] bg-white px-2.5 text-sm text-[#3A2F24] outline-none placeholder:text-[#B1A69A] focus:border-[#0F5C52]"
            />
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-[#F1E7DA] px-3 py-2.5 text-left text-sm font-semibold text-[#8A6B46] hover:bg-[#F7EFE4]"
              >
                清空筛选
              </button>
            )}
            {loading && <div className="px-3 py-3 text-sm text-[#9E8F7E]">加载中...</div>}
            {!loading && options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={`${option.value}-${option.label}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 border-b border-[#F1E7DA] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[#F7EFE4] ${active ? 'bg-[#F0E4D3]' : ''}`}
                >
                  <span className={`truncate ${active ? 'font-bold text-[#2F2419]' : 'font-semibold text-[#3A2F24]'}`}>{option.label}</span>
                  {option.meta && <span className="shrink-0 text-xs text-[#9E8F7E]">{option.meta}</span>}
                </button>
              );
            })}
            {!loading && options.length === 0 && <div className="px-3 py-3 text-sm text-[#9E8F7E]">没有匹配项</div>}
          </div>
        </div>
      )}
    </div>
  );
}
