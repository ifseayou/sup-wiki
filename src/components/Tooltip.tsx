import type { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  tip: string;
  dotted?: boolean;
}

// 纯 CSS hover 气泡，无需 use client
// 使用命名 group/tooltip 避免与页面卡片 group 冲突
export default function Tooltip({ children, tip, dotted = true }: TooltipProps) {
  return (
    <span className="group/tooltip relative inline-block">
      <span className={dotted
        ? 'cursor-help underline decoration-dotted decoration-current/40 underline-offset-2'
        : 'cursor-help'}>
        {children}
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#2E2118] px-2.5 py-1.5 text-xs text-[#FAF7F2] shadow-md opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100">
        {tip}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#2E2118]" />
      </span>
    </span>
  );
}
