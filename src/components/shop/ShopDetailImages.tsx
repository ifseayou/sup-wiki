'use client';

import { useState } from 'react';
import type { ShopVariant } from '@/types';
import ShopImageGallery from './ShopImageGallery';
import ColorSelector from './ColorSelector';

interface Props {
  variants: ShopVariant[];
  images: string[];   // 商品公共详情图（fallback）
  name: string;
}

export default function ShopDetailImages({ variants, images, name }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<ShopVariant | null>(
    variants.length > 0 ? variants[0] : null
  );

  // 有变体时展示选中变体的图片，否则用公共 images
  const galleryImages = selectedVariant?.images?.length
    ? selectedVariant.images
    : images;

  return (
    <div>
      <ShopImageGallery images={galleryImages} name={name} />

      {variants.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <ColorSelector variants={variants} onSelect={setSelectedVariant} />
        </div>
      )}
      {variants.length === 1 && variants[0].color && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#8B7355' }}>
          颜色：{variants[0].color}
        </div>
      )}
    </div>
  );
}
