'use client';

import Link from 'next/link';

export default function AthleteResultName({
  athleteId,
  name,
  photo,
  className = '',
}: {
  athleteId?: number | null;
  name: string;
  photo?: string | null;
  bibNumber?: string | null;
  className?: string;
}) {
  const displayName = name || '未命名运动员';
  const avatar = photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={displayName} className="h-full w-full object-cover" />
  ) : (
    <span className="text-sm font-semibold text-[#7A6145]">{displayName.slice(0, 1)}</span>
  );
  const content = (
    <span className={`group/name relative inline-flex items-center gap-2 ${className}`}>
      <span className="font-medium text-[#6F563B] group-hover/name:text-[#4B3927]">{displayName}</span>
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden min-w-44 rounded-lg border border-[#E2D6C5] bg-[#FFFCF7] p-3 shadow-[0_16px_36px_rgba(57,42,28,0.18)] group-hover/name:block">
        <span className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#F1E7D8] ring-1 ring-[#E2D6C5]">
            {avatar}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#2E2118]">{displayName}</span>
          </span>
        </span>
      </span>
    </span>
  );
  if (!athleteId) return content;
  return (
    <Link href={`/athletes/${athleteId}`} className="inline-flex no-underline">
      {content}
    </Link>
  );
}
