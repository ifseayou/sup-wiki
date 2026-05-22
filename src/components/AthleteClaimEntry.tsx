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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 34,
        border: '1px solid #CDBA9F',
        borderRadius: 8,
        padding: '7px 12px',
        color: '#6B3E1E',
        background: '#FFF8EA',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      这是我，更新资料
    </Link>
  );
}
