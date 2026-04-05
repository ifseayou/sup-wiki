'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  placeholder: string;
  options: FilterOption[];
}

export default function FilterBar({ filters }: { filters: FilterConfig[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`);
  }

  const hasActive = filters.some(f => searchParams.get(f.key));

  return (
    <>
      <style>{`
        .filter-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 20px; }
        .filter-select {
          padding: 7px 32px 7px 12px;
          border: 1px solid #EDE5D8;
          border-radius: 8px;
          background: #FEFCF9 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23A08060'/%3E%3C/svg%3E") no-repeat right 10px center;
          -webkit-appearance: none;
          appearance: none;
          font-size: 13px;
          color: #8A8078;
          outline: none;
          cursor: pointer;
          min-width: 110px;
          transition: border-color 0.15s, color 0.15s;
        }
        .filter-select.active { border-color: #7A6145; color: #2E2118; }
        .filter-select:focus { border-color: #7A6145; }
        .filter-clear {
          font-size: 12px; color: #A08060; background: none; border: none;
          cursor: pointer; padding: 6px 4px; letter-spacing: 0.02em;
          text-decoration: underline; text-decoration-color: #C0B4A4;
          white-space: nowrap;
        }
        @media (max-width: 480px) {
          .filter-bar { gap: 6px; }
          .filter-select { min-width: 0; flex: 1 1 calc(50% - 6px); font-size: 12px; padding: 8px 28px 8px 10px; }
        }
      `}</style>
      <div className="filter-bar">
        {filters.map(f => (
          <select
            key={f.key}
            value={searchParams.get(f.key) || ''}
            onChange={e => handleChange(f.key, e.target.value)}
            className={`filter-select${searchParams.get(f.key) ? ' active' : ''}`}
          >
            <option value="">{f.placeholder}</option>
            {f.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ))}
        {hasActive && (
          <button
            className="filter-clear"
            onClick={() => router.push('?')}
          >
            清除筛选
          </button>
        )}
      </div>
    </>
  );
}
