'use client';

export default function ShareEventButton({ title }: { title: string }) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex h-11 items-center justify-center rounded-lg bg-[#B58A48] px-8 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(138,97,47,0.20)] transition hover:bg-[#8A612F]"
    >
      分享赛事
    </button>
  );
}
