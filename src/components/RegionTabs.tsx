'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface RegionTabsProps {
  region: string;
}

export default function RegionTabs({ region }: RegionTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchRegion(r: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('region', r);
    // 切换地区时清空平台筛选（各地区平台不同）
    params.delete('platform');
    router.push(`/creators?${params.toString()}`);
  }

  const tabs = [
    { value: 'domestic', label: '国内' },
    { value: 'international', label: '国外' },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {tabs.map(tab => {
        const active = region === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => switchRegion(tab.value)}
            style={{
              padding: '6px 20px',
              borderRadius: 20,
              border: active ? '1.5px solid #7A6145' : '1.5px solid #EDE5D8',
              background: active ? '#7A6145' : 'transparent',
              color: active ? '#fff' : '#655D56',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
