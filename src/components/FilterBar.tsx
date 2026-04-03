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

const selectStyle = {
  padding: '8px 12px',
  border: '1px solid #EDE5D8',
  borderRadius: 8,
  background: '#FEFCF9',
  fontSize: 13,
  color: '#655D56',
  outline: 'none',
  cursor: 'pointer',
};

export default function FilterBar({ filters }: { filters: FilterConfig[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  const hasActive = filters.some(f => searchParams.get(f.key));

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 28 }}>
      {filters.map(f => (
        <select
          key={f.key}
          value={searchParams.get(f.key) || ''}
          onChange={e => handleChange(f.key, e.target.value)}
          style={{
            ...selectStyle,
            borderColor: searchParams.get(f.key) ? '#7A6145' : '#EDE5D8',
            color: searchParams.get(f.key) ? '#2E2118' : '#8A8078',
          }}
        >
          <option value="">{f.placeholder}</option>
          {f.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ))}

      {hasActive && (
        <button
          onClick={() => {
            const params = new URLSearchParams();
            router.push(`?${params.toString()}`);
          }}
          style={{
            fontSize: 12,
            color: '#A08060',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
            letterSpacing: '0.02em',
            textDecoration: 'underline',
            textDecorationColor: '#C0B4A4',
          }}
        >
          清除筛选
        </button>
      )}
    </div>
  );
}
