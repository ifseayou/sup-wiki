'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserContext';

export default function AthleteClaimEntry({ athleteId }: { athleteId: number }) {
  const { token, loading } = useUser();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    fetch(`/api/athletes/${athleteId}/claim-status`, headers ? { headers } : undefined)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setVisible(!data.has_owner || data.is_owner);
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId, token]);

  if (loading || !visible) return null;

  return (
    <Link
      href={`/athletes/${athleteId}/claim`}
      className="inline-flex h-11 items-center justify-center rounded-lg bg-brown-600 px-5 text-sm font-semibold text-white no-underline shadow-[0_12px_26px_rgba(94,74,51,0.22)] transition hover:bg-brown-700"
    >
      这是我，更新资料
    </Link>
  );
}
