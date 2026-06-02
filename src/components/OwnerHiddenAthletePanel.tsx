'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AthleteResultsPanel from '@/components/AthleteResultsPanel';
import { useUser } from '@/components/UserContext';

interface ClaimStatus {
  is_owner?: boolean;
  privacy_mode?: string;
}

export default function OwnerHiddenAthletePanel({
  athleteId,
  athleteName,
}: {
  athleteId: number;
  athleteName: string;
}) {
  const { token, loading } = useUser();
  const [status, setStatus] = useState<ClaimStatus | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    fetch(`/api/athletes/${athleteId}/claim-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId, token]);

  if (loading || !status?.is_owner || status.privacy_mode !== 'hidden') return null;

  return (
    <section className="mb-8 rounded-xl border border-cream-300 bg-[#FEFCF9] p-5 shadow-[0_16px_46px_rgba(68,51,35,0.06)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brown-400">Owner View</div>
          <h2 className="mt-2 text-xl font-semibold text-brown-800">你正在查看自己的隐藏主页</h2>
          <p className="mt-2 text-sm leading-6 text-warm-gray-500">
            其他用户只能看到主页已隐藏的提示；你本人仍可以查看成绩并继续更新资料。
          </p>
        </div>
        <Link
          href={`/athletes/${athleteId}/claim`}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brown-600 px-5 text-sm font-semibold text-white no-underline shadow-[0_12px_26px_rgba(94,74,51,0.22)] transition hover:bg-brown-700"
        >
          更新资料
        </Link>
      </div>
      <div className="mt-6">
        <AthleteResultsPanel athleteId={athleteId} athleteName={athleteName} />
      </div>
    </section>
  );
}
