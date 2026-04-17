'use client';

import { useState } from 'react';

interface Props {
  images: string[];
  name: string;
}

export default function ProductImageGallery({ images, name }: Props) {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) {
    return (
      <div className="bg-gray-100 rounded-2xl aspect-square flex items-center justify-center overflow-hidden">
        <span className="text-8xl text-cream-300">🏄</span>
      </div>
    );
  }

  return (
    <div>
      {/* 主图 */}
      <div className="bg-cream-100 rounded-2xl aspect-square flex items-center justify-center overflow-hidden p-4">
        <img
          src={images[current]}
          alt={`${name} 图片 ${current + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* 缩略图 */}
      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                padding: 4,
                background: '#F8F1E5',
                border: `2px solid ${i === current ? '#8B7355' : 'transparent'}`,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={img}
                alt={`缩略图 ${i + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
