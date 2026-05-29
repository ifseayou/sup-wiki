'use client';

import { useEffect, useMemo, useState } from 'react';

export default function AthletePhotoCarousel({
  name,
  images,
}: {
  name: string;
  images: string[];
}) {
  const gallery = useMemo(() => Array.from(new Set(images.filter(Boolean))), [images]);
  const [index, setIndex] = useState(0);
  const current = gallery[index];
  const hasMany = gallery.length > 1;

  useEffect(() => {
    if (!hasMany) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % gallery.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [gallery.length, hasMany]);

  if (!current) {
    return (
      <div className="flex aspect-[4/5] min-h-[320px] w-full items-center justify-center rounded-lg bg-cream-100 font-[var(--font-display)] text-7xl text-cream-300">
        {name.slice(0, 1)}
      </div>
    );
  }

  function go(delta: number) {
    setIndex((value) => (value + delta + gallery.length) % gallery.length);
  }

  return (
    <div className="relative aspect-[4/5] min-h-[320px] overflow-hidden rounded-lg bg-[#F3E8DA] shadow-inner">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current} alt={name} className="relative z-10 h-full w-full object-contain" />
      <div className="absolute bottom-3 right-3 z-20 rounded-full bg-brown-800/75 px-3 py-1 text-xs font-semibold text-white">
        {hasMany ? `${index + 1}/${gallery.length}` : '公开头像'}
      </div>
      {hasMany && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/82 text-[#6B4A24] shadow-md transition hover:bg-white"
            aria-label="上一张照片"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/82 text-[#6B4A24] shadow-md transition hover:bg-white"
            aria-label="下一张照片"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-3 z-20 flex max-w-[70%] gap-1.5 overflow-hidden rounded-full bg-white/78 px-2 py-1.5 shadow-sm backdrop-blur">
            {gallery.map((url, itemIndex) => (
              <button
                type="button"
                key={`${url}-${itemIndex}`}
                onClick={() => setIndex(itemIndex)}
                className={`h-2 rounded-full transition-all ${itemIndex === index ? 'w-6 bg-[#7A4B22]' : 'w-2 bg-[#D6C5AE]'}`}
                aria-label={`查看第 ${itemIndex + 1} 张照片`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
