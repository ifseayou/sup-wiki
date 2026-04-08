'use client';

import { useState } from 'react';

interface Props {
  images: string[];
  name: string;
}

export default function ShopImageGallery({ images, name }: Props) {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) {
    return (
      <div style={{
        height: 400,
        background: '#F0E8DB',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 64, opacity: 0.3 }}>🏄</span>
      </div>
    );
  }

  return (
    <div>
      {/* 主图 */}
      <div style={{
        height: 620,
        background: '#F5F1EB',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}>
        <img
          src={images[current]}
          alt={`${name} 图片 ${current + 1}`}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* 缩略图 */}
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                overflow: 'hidden',
                border: i === current ? '2px solid #8B7355' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0,
                background: 'none',
                flexShrink: 0,
                transition: 'border-color 0.15s',
              }}
            >
              <img src={img} alt={`缩略图 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
