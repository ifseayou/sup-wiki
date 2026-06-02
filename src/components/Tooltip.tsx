import type { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  tip: string;
  dotted?: boolean;
  align?: 'center' | 'end';
}

// 纯 CSS hover 气泡，无需 use client
// 使用命名 group/tooltip 避免与页面卡片 group 冲突
export default function Tooltip({ children, tip, dotted = true, align = 'center' }: TooltipProps) {
  const positionClass = align === 'end'
    ? 'right-0'
    : 'left-1/2 -translate-x-1/2';
  const arrowClass = align === 'end'
    ? 'right-6'
    : 'left-1/2 -translate-x-1/2';

  return (
    <span className="group/tooltip relative inline-block">
      <span className={dotted
        ? 'cursor-help underline decoration-dotted decoration-current/40 underline-offset-2'
        : 'cursor-help'}>
        {children}
      </span>
      <span className={`pointer-events-none absolute bottom-full z-[80] mb-2 w-72 max-w-[calc(100vw-32px)] whitespace-normal break-words rounded-md bg-[#2E2118] px-3 py-2 text-left text-xs leading-5 text-[#FAF7F2] shadow-md opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100 ${positionClass}`}>
        {tip}
        <span className={`absolute top-full border-4 border-transparent border-t-[#2E2118] ${arrowClass}`} />
      </span>
    </span>
  );
}
