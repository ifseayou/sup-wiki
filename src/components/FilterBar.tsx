'use client';

import type { FormEvent } from 'react';
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

export interface SearchConfig {
  key: string;
  placeholder: string;
}

export default function FilterBar({
  filters,
  searches = [],
  defaultValues,
}: {
  filters: FilterConfig[];
  searches?: SearchConfig[];
  defaultValues?: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>, key: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = String(formData.get(key) || '').trim();
    handleChange(key, value);
  }

  const hasActive = [...filters, ...searches].some(f => searchParams.get(f.key));

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
        .filter-search-form { display: flex; align-items: center; gap: 6px; min-width: 260px; }
        .filter-search-input {
          width: 100%;
          min-width: 220px;
          padding: 7px 12px;
          border: 1px solid #EDE5D8;
          border-radius: 8px;
          background: #FEFCF9;
          font-size: 13px;
          color: #2E2118;
          outline: none;
          transition: border-color 0.15s;
        }
        .filter-search-input:focus { border-color: #7A6145; }
        .filter-search-button {
          border: 1px solid #7A6145;
          background: #7A6145;
          color: #fff;
          border-radius: 8px;
          padding: 7px 12px;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        .filter-clear {
          font-size: 12px; color: #A08060; background: none; border: none;
          cursor: pointer; padding: 6px 4px; letter-spacing: 0.02em;
          text-decoration: underline; text-decoration-color: #C0B4A4;
          white-space: nowrap;
        }
        @media (max-width: 480px) {
          .filter-bar { gap: 6px; }
          .filter-search-form { flex: 1 1 100%; min-width: 0; }
          .filter-search-input { min-width: 0; font-size: 12px; padding: 8px 10px; }
          .filter-search-button { font-size: 12px; padding: 8px 10px; }
          .filter-select { min-width: 0; flex: 1 1 calc(50% - 6px); font-size: 12px; padding: 8px 28px 8px 10px; }
        }
      `}</style>
      <div className="filter-bar">
        {searches.map(search => (
          <form
            key={search.key}
            className="filter-search-form"
            onSubmit={(event) => handleSearchSubmit(event, search.key)}
          >
            <input
              name={search.key}
              defaultValue={searchParams.get(search.key) || ''}
              placeholder={search.placeholder}
              className="filter-search-input"
              type="search"
            />
            <button className="filter-search-button" type="submit">搜索</button>
          </form>
        ))}
        {filters.map(f => (
          <select
            key={f.key}
            value={searchParams.get(f.key) || defaultValues?.[f.key] || ''}
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
