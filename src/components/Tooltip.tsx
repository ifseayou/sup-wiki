'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  tip: string;
  dotted?: boolean;
  align?: 'center' | 'end';
}

export default function Tooltip({ children, tip, dotted = true, align = 'center' }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 288;
    let left = align === 'end' ? rect.right : rect.left + rect.width / 2;
    if (align === 'end') {
      left = Math.min(Math.max(left, width + 16), window.innerWidth - 16);
    } else {
      left = Math.min(Math.max(left, width / 2 + 16), window.innerWidth - width / 2 - 16);
    }
    const nextPlacement = rect.top < 96 ? 'bottom' : 'top';
    setPlacement(nextPlacement);
    setPosition({ top: nextPlacement === 'top' ? rect.top - 8 : rect.bottom + 8, left });
  }, [align]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  const transform = `${align === 'end' ? 'translateX(-100%)' : 'translateX(-50%)'} ${placement === 'top' ? 'translateY(-100%)' : ''}`.trim();
  const arrowPositionClass = placement === 'top'
    ? 'top-full border-t-[#2E2118]'
    : 'bottom-full border-b-[#2E2118]';
  const arrowAlignClass = align === 'end' ? 'right-6' : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={() => {
        updatePosition();
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {
        updatePosition();
        setOpen(true);
      }}
      onBlur={() => setOpen(false)}
    >
      <span className={dotted
        ? 'cursor-help underline decoration-dotted decoration-current/40 underline-offset-2'
        : 'cursor-help'}>
        {children}
      </span>
      {open && typeof document !== 'undefined' && createPortal(
        <span
          className="pointer-events-none fixed z-[9999] w-72 max-w-[calc(100vw-32px)] whitespace-normal break-words rounded-md bg-[#2E2118] px-3 py-2 text-left text-xs leading-5 text-[#FAF7F2] shadow-[0_10px_28px_rgba(46,33,24,0.28)]"
          style={{ top: position.top, left: position.left, transform }}
        >
          {tip}
          <span className={`absolute border-4 border-transparent ${arrowPositionClass} ${arrowAlignClass}`} />
        </span>,
        document.body,
      )}
    </span>
  );
}
