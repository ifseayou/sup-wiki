import type { ReactNode } from 'react';
import {
  AdminFaviconLarge,
  AdminFaviconMini,
  PublicFaviconLarge,
  PublicFaviconMini,
} from '@/components/favicon/FaviconArt';

function BrowserStrip({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: 'public' | 'admin';
  icon: ReactNode;
}) {
  const isPublic = tone === 'public';

  return (
    <div
      className="rounded-[22px] border p-4 shadow-[0_14px_30px_rgba(45,33,22,0.08)]"
      style={{
        borderColor: isPublic ? '#e7dccc' : '#4b3a2a',
        background: isPublic ? '#fffaf4' : '#1a1511',
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#d89b8b]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5bf79]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#86b28c]" />
      </div>
      <div
        className="flex items-center gap-3 rounded-2xl border px-3 py-3"
        style={{
          borderColor: isPublic ? '#eadfce' : '#3b2d22',
          background: isPublic ? '#f9f2e9' : '#231c16',
        }}
      >
        {icon}
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.24em]"
            style={{ color: isPublic ? '#8f7d69' : '#9f8a71' }}
          >
            {label}
          </div>
          <div
            className="mt-1 text-sm"
            style={{ color: isPublic ? '#3e3024' : '#f4eadc' }}
          >
            SUP Wiki
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FaviconPreviewPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f1e7_0%,#efe4d4_52%,#f9f4ec_100%)] px-6 py-12 text-[#382a1f]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-3xl">
          <div className="mb-4 inline-flex rounded-full border border-[#d8c8b3] bg-white/55 px-4 py-1 text-[11px] uppercase tracking-[0.28em] text-[#8a7762]">
            Favicon Preview
          </div>
          <h1
            className="text-5xl leading-none sm:text-6xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            前后台分离的标签图标方案
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6f5e50]">
            前台改成更有桨板识别度的编辑式标记，后台则改成深色工具徽章。这里是本地审批页，不会直接上线。
          </p>
        </div>

        <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[34px] border border-[#dccdbb] bg-white/52 p-8 shadow-[0_24px_80px_rgba(88,59,31,0.08)] backdrop-blur-sm">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.26em] text-[#8d7a64]">Public</div>
                <h2 className="mt-2 text-3xl" style={{ fontFamily: 'var(--font-display)' }}>
                  前台 favicon
                </h2>
              </div>
              <div className="rounded-full border border-[#decdb8] bg-[#fbf5ed] px-4 py-2 text-sm text-[#7f6d59]">
                编辑感 / 水面 / 桨板
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
              <PublicFaviconLarge />
              <div className="space-y-4">
                <p className="text-sm leading-7 text-[#6e5d4f]">
                  前台改成纯字母方案，用更有编辑感的高对比 `SUP` 字标，底部只留一条浅水线。整体更像内容品牌，而不是系统按钮。
                </p>
                <BrowserStrip label="Front Site" tone="public" icon={<PublicFaviconMini />} />
              </div>
            </div>
          </div>

          <div className="rounded-[34px] border border-[#4f3d2d] bg-[#1c1713] p-8 text-[#f4eadc] shadow-[0_24px_80px_rgba(18,12,8,0.24)]">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.26em] text-[#a89376]">Admin</div>
                <h2 className="mt-2 text-3xl" style={{ fontFamily: 'var(--font-display)' }}>
                  后台 favicon
                </h2>
              </div>
              <div className="rounded-full border border-[#594634] bg-[#241d17] px-4 py-2 text-sm text-[#bea47f]">
                控制台 / 深色 / 管理感
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
              <AdminFaviconLarge />
              <div className="space-y-4">
                <p className="text-sm leading-7 text-[#cabaa6]">
                  后台也用 `SUP` 字母，但换成更硬朗的无衬线字形、深色控制台底和状态条。这样和前台同源，但管理感明显更强。
                </p>
                <BrowserStrip label="Admin Panel" tone="admin" icon={<AdminFaviconMini />} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
