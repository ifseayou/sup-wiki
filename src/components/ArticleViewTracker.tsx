'use client';

import { useEffect } from 'react';

export default function ArticleViewTracker({ contentType, contentId }: { contentType: string; contentId: number }) {
  useEffect(() => {
    if (!contentType || !contentId) return;
    const body = JSON.stringify({ content_type: contentType, content_id: contentId, path: window.location.pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/content-views', new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch('/api/content-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [contentId, contentType]);

  return null;
}
