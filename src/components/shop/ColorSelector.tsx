'use client';

import { useState } from 'react';
import type { ShopVariant } from '@/types';

interface Props {
  variants: ShopVariant[];
  onSelect: (variant: ShopVariant) => void;
}

export default function ColorSelector({ variants, onSelect }: Props) {
  const [selected, setSelected] = useState(0);

  if (variants.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A08060', marginBottom: 10 }}>
        颜色 / 款式
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {variants.map((v, i) => (
          <button
            key={i}
            onClick={() => { setSelected(i); onSelect(v); }}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: selected === i ? '2px solid #8B7355' : '2px solid #EDE5D8',
              background: selected === i ? '#F5EFE6' : '#FAF7F2',
              color: selected === i ? '#3D3226' : '#655D56',
              fontSize: 13,
              fontWeight: selected === i ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {v.color}
            {v.extra_note && (
              <span style={{ fontSize: 10, color: '#A08060', fontWeight: 400 }}>{v.extra_note}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
