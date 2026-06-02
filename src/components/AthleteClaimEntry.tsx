'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserContext';

interface ClaimStatus {
  has_owner?: boolean;
  is_owner?: boolean;
  can_manage_privacy?: boolean;
  privacy_actions?: string[];
}

const actionLabels: Record<string, string> = {
  correction: '资料更正',
  hide_athlete: '隐藏主页',
  anonymize_name: '匿名化展示',
  delete_frontend: '删除前台展示',
};

export default function AthleteClaimEntry({ athleteId }: { athleteId: number }) {
  const { token, loading } = useUser();
  const [status, setStatus] = useState<ClaimStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    fetch(`/api/athletes/${athleteId}/claim-status`, headers ? { headers } : undefined)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId, token]);

  if (loading || !status) return null;

  const showClaim = !status.has_owner || status.is_owner;
  const actions = Array.isArray(status.privacy_actions) ? status.privacy_actions : [];
  if (!showClaim && actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {showClaim && (
        <Link
          href={`/athletes/${athleteId}/claim`}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brown-600 px-5 text-sm font-semibold text-white no-underline shadow-[0_12px_26px_rgba(94,74,51,0.22)] transition hover:bg-brown-700"
        >
          这是我，更新资料
        </Link>
      )}
      {actions.map((action) => (
        <Link
          key={action}
          href={`/privacy-request?target_type=athlete&target_id=${athleteId}&request_type=${action}`}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D8CDBE] bg-white px-4 text-sm font-semibold text-[#6B4A24] no-underline transition hover:bg-[#FAF6EF]"
        >
          {actionLabels[action] || '隐私处理'}
        </Link>
      ))}
    </div>
  );
}
