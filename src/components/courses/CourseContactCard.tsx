'use client';

import { useState } from 'react';
import { CUSTOMER_SERVICE_WECHAT } from '@/lib/constants';

export default function CourseContactCard() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(CUSTOMER_SERVICE_WECHAT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#CFE7DF] bg-[#F3FFFA] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0E6655] text-sm text-white">微</span>
        <div>
          <div className="text-sm font-semibold text-[#164A3F]">微信咨询课程</div>
          <div className="text-xs text-[#5B7E75]">添加微信后备注课程名称</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-[var(--font-display)] text-2xl text-[#2E2118] tracking-wide">{CUSTOMER_SERVICE_WECHAT}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-[#0E6655] shadow-sm ring-1 ring-[#CFE7DF] transition-all hover:bg-[#E9F7EF]"
        >
          {copied ? '已复制' : '复制微信'}
        </button>
      </div>
    </div>
  );
}
