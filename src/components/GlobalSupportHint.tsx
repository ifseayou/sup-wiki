'use client';

import { useState } from 'react';

export default function GlobalSupportHint() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-5 sm:right-5">
      {open && (
        <div className="mb-3 w-[min(320px,calc(100vw-32px))] rounded-lg border border-[#E0D8CC] bg-[#FEFCF9] p-4 shadow-[0_18px_42px_rgba(46,33,24,0.18)]">
          <div className="text-sm font-semibold text-[#2E2118]">问题反馈</div>
          <p className="mt-1 text-sm leading-6 text-[#75695F]">
            遇到问题或发现 bug，可联系客服微信：
            <span className="font-semibold text-[#6B3E1E]">i_add_u</span>
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-[#C4A882] bg-[#6B3E1E] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(107,62,30,0.25)] transition hover:bg-[#563018]"
        aria-expanded={open}
      >
        客服微信：i_add_u
      </button>
    </div>
  );
}
