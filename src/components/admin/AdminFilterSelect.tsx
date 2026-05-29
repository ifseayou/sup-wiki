'use client';

import { useEffect, useRef, useState } from 'react';

export interface AdminFilterOption {
  label: string;
  value: string;
  meta?: string | null;
}

export default function AdminFilterSelect({
  value,
  options,
  placeholder,
  onChange,
  className = '',
  disabled = false,
}: {
  value: string;
  options: AdminFilterOption[];
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full min-w-[132px] items-center justify-between gap-3 rounded-lg border border-[#D8CCBA] bg-white px-3 text-left text-sm text-[#5E5144] outline-none transition hover:border-[#B99A70] focus:border-[#0F5C52] focus:ring-2 focus:ring-[#0F5C52]/10 disabled:cursor-not-allowed disabled:bg-[#F3EDE5] disabled:text-[#A69B8F]"
      >
        <span className={`truncate ${selected ? 'font-semibold text-[#3A2F24]' : ''}`}>{selected?.label || placeholder}</span>
        <svg className={`h-4 w-4 shrink-0 text-[#9C8669] transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-auto rounded-lg border border-[#D8C9B6] bg-[#FFFDF9] py-1 shadow-[0_18px_45px_rgba(47,35,24,0.16)]">
          {options.map((option) => {
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
        </div>
      )}
    </div>
  );
}
