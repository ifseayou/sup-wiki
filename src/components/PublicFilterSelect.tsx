'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface PublicFilterOption {
  value: string;
  label: string;
  meta?: string;
}

interface PublicFilterSelectProps {
  label: string;
  name: string;
  value?: string;
  placeholder: string;
  options: PublicFilterOption[];
  disabled?: boolean;
  icon?: 'chevron' | 'search' | 'user' | 'trophy' | 'calendar' | 'star';
  dropdownClassName?: string;
}

export default function PublicFilterSelect({
  label,
  name,
  value = '',
  placeholder,
  options,
  disabled = false,
  icon = 'chevron',
  dropdownClassName = '',
}: PublicFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selected),
    [options, selected],
  );
  const display = selectedOption?.label || placeholder;

  return (
    <div ref={boxRef} className="relative">
      {!disabled && <input type="hidden" name={name} value={selected} />}
      <label className="mb-1.5 block text-xs font-semibold text-[#5F4D3A]">{label}</label>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className="relative flex h-12 w-full items-center rounded-md border border-[#E3D5C2] bg-white/85 px-3 pr-9 text-left text-sm text-[#3D3328] outline-none transition placeholder:text-[#B5AA9C] focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#D79E49]/20 disabled:bg-[#F4EDE4] disabled:text-[#A69B8F]"
      >
        <span className={`${selectedOption ? 'text-[#3D3328]' : 'text-[#B5AA9C]'} min-w-0 truncate`}>
          {display}
        </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#987D59]">
          <FilterIcon name={icon} />
        </span>
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-30 mt-2 max-h-72 min-w-full overflow-auto rounded-md border border-[#DCCBB4] bg-[#FFFDF9] shadow-[0_18px_50px_rgba(54,38,24,0.16)] ${dropdownClassName}`}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === selected}
              key={`${name}-${option.value}-${option.label}`}
              className={`flex w-full items-center justify-between gap-3 border-b border-[#F0E6D9] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[#F8EFE2] ${
                option.value === selected ? 'bg-[#F0E4D3]' : ''
              }`}
              onClick={() => {
                setSelected(option.value);
                setOpen(false);
              }}
            >
              <span className="min-w-0 whitespace-normal break-words font-medium text-[#3A2B20]">{option.label}</span>
              {option.meta && <span className="shrink-0 text-xs text-[#9E8F7E]">{option.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterIcon({ name }: { name: NonNullable<PublicFilterSelectProps['icon']> }) {
  const paths = {
    chevron: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    trophy: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></>,
    calendar: <><path d="M7 3v3M17 3v3M4.5 9h15" /><path d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
