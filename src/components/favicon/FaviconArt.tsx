function Frame({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: 'public' | 'admin';
}) {
  const isPublic = variant === 'public';

  return (
    <div
      className="relative overflow-hidden rounded-[26px] border shadow-[0_24px_60px_rgba(46,34,19,0.12)]"
      style={{
        width: 180,
        height: 180,
        borderColor: isPublic ? 'rgba(122, 99, 74, 0.14)' : 'rgba(223, 193, 151, 0.16)',
        background: isPublic
          ? 'linear-gradient(180deg, #fcf7ef 0%, #f3e6d5 100%)'
          : 'linear-gradient(180deg, #1f1a15 0%, #14100d 100%)',
      }}
    >
      {children}
    </div>
  );
}

export function PublicFaviconLarge() {
  return (
    <Frame variant="public">
      <div className="absolute inset-x-0 top-0 h-[54%] bg-[radial-gradient(circle_at_24%_18%,rgba(243,201,128,0.84),transparent_24%)]" />
      <div className="absolute inset-x-[-8%] bottom-0 h-[36%] rounded-t-[44%] bg-[#2f817f]" />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[56%] text-[52px] uppercase tracking-[-0.04em] text-[#3b2d22]"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
      >
        SUP
      </div>
      <div className="absolute left-[42px] bottom-[36px] h-[2px] w-[96px] rounded-full bg-white/76" />
    </Frame>
  );
}

export function AdminFaviconLarge() {
  return (
    <Frame variant="admin">
      <div className="absolute inset-[16px] rounded-[24px] border border-[#8f6a42]/30" />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[56%] text-[42px] uppercase tracking-[0.08em] text-[#f3e8d8]"
        style={{ fontFamily: 'var(--font-sans)', fontWeight: 700 }}
      >
        SUP
      </div>
      <div className="absolute left-[42px] bottom-[42px] h-[8px] w-[96px] rounded-full bg-[#2f8c8b]" />
      <div className="absolute left-[42px] bottom-[28px] h-[2px] w-[64px] rounded-full bg-[#8f6a42]" />
    </Frame>
  );
}

export function PublicFaviconMini() {
  return (
    <div className="relative h-8 w-8 overflow-hidden rounded-[10px] border border-[#cdbca7]/45 bg-[#f6efe4]">
      <div className="absolute inset-x-[-3px] bottom-0 h-[10px] rounded-t-[100%] bg-[#2f817f]" />
      <div
        className="absolute inset-x-0 top-[6px] text-center text-[10px] uppercase tracking-[0.02em] text-[#3b2d22]"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
      >
        SUP
      </div>
    </div>
  );
}

export function AdminFaviconMini() {
  return (
    <div className="relative h-8 w-8 overflow-hidden rounded-[10px] border border-[#8f6a42]/35 bg-[#1b1713]">
      <div className="absolute inset-[4px] rounded-[7px] border border-[#8f6a42]/22" />
      <div
        className="absolute inset-x-0 top-[8px] text-center text-[8px] uppercase tracking-[0.08em] text-[#f3e8d8]"
        style={{ fontFamily: 'var(--font-sans)', fontWeight: 800 }}
      >
        SUP
      </div>
      <div className="absolute left-[6px] bottom-[5px] h-[3px] w-[20px] rounded-full bg-[#2f8c8b]" />
    </div>
  );
}
