'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@/components/UserContext';
import Tooltip from '@/components/Tooltip';

interface ClaimStatus {
  has_owner?: boolean;
  is_owner?: boolean;
  can_claim?: boolean;
  viewer_has_owned_athlete?: boolean;
  can_manage_privacy?: boolean;
  privacy_actions?: string[];
  privacy_mode?: string;
}

const actionLabels: Record<string, string> = {
  hide_athlete: '隐藏主页',
  anonymize_name: '匿名化展示',
  delete_frontend: '删除前台展示',
};

const actionTips: Record<string, string> = {
  hide_athlete: '其他用户不能查看个人主页资料，自己仍可查看资料和成绩，确认后立即生效。',
  anonymize_name: '公开成绩中的姓名进入匿名或隐藏展示，需要提交隐私处理。',
  delete_frontend: '从前台移除运动员主页展示，影响较大，需要提交隐私处理。',
};

export default function AthleteClaimEntry({ athleteId }: { athleteId: number }) {
  const { token, loading } = useUser();
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [showHideModal, setShowHideModal] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [hideError, setHideError] = useState('');

  const loadStatus = useCallback(() => {
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

  useEffect(() => {
    return loadStatus();
  }, [loadStatus]);

  async function hideHomepage() {
    if (!token) return;
    setHiding(true);
    setHideError('');
    try {
      const res = await fetch('/api/user/privacy-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          target_type: 'athlete',
          target_id: athleteId,
          request_type: 'hide_athlete',
          description: '本人确认隐藏运动员主页',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '隐藏主页失败');
      setShowHideModal(false);
      setStatus((prev) => prev ? { ...prev, privacy_mode: 'hidden' } : prev);
      loadStatus();
    } catch (error) {
      setHideError(error instanceof Error ? error.message : '隐藏主页失败');
    } finally {
      setHiding(false);
    }
  }

  if (loading || !status) return null;

  const showClaim = Boolean(status.can_claim || (!status.has_owner && !status.viewer_has_owned_athlete));
  const actions = (Array.isArray(status.privacy_actions) ? status.privacy_actions : []).filter((action) => actionLabels[action]);
  if (!showClaim && actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {showClaim && (
        <Link
          href={`/athletes/${athleteId}/claim`}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brown-600 px-5 text-sm font-semibold text-white no-underline shadow-[0_12px_26px_rgba(94,74,51,0.22)] transition hover:bg-brown-700"
        >
          {status.is_owner ? '更新资料' : '我是本人，认领该运动员'}
        </Link>
      )}
      {actions.map((action) => action === 'hide_athlete' ? (
        <Tooltip key={action} tip={actionTips[action]} dotted={false}>
          <button
            type="button"
            onClick={() => setShowHideModal(true)}
            disabled={status.privacy_mode === 'hidden'}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D8CDBE] bg-white px-4 text-sm font-semibold text-[#6B4A24] transition hover:bg-[#FAF6EF] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {status.privacy_mode === 'hidden' ? '已隐藏主页' : actionLabels[action]}
          </button>
        </Tooltip>
      ) : (
        <Tooltip key={action} tip={actionTips[action]} dotted={false}>
          <Link
            href={`/privacy-request?target_type=athlete&target_id=${athleteId}&request_type=${action}`}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D8CDBE] bg-white px-4 text-sm font-semibold text-[#6B4A24] no-underline transition hover:bg-[#FAF6EF]"
          >
            {actionLabels[action]}
          </Link>
        </Tooltip>
      ))}
      {showHideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2E2118]/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#E3D6C4] bg-[#FEFCF9] p-6 shadow-[0_30px_90px_rgba(46,33,24,0.28)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A08060]">Privacy</div>
            <h2 className="mt-3 text-2xl font-semibold text-[#2E2118]">确认隐藏主页？</h2>
            <p className="mt-3 text-sm leading-7 text-[#6F655C]">
              隐藏后，其他用户进入该运动员主页时将只能看到“运动员已隐藏主页”的提示，不再展示照片、简介、个人资料和主页成绩。你本人登录后仍可以查看自己的资料和成绩，也可以继续提交更新资料。
            </p>
            {hideError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{hideError}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowHideModal(false)} className="h-10 rounded-lg border border-[#D8CDBE] bg-white px-4 text-sm font-semibold text-[#6F5B42]">
                取消
              </button>
              <button type="button" onClick={hideHomepage} disabled={hiding} className="h-10 rounded-lg bg-[#6B4A24] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {hiding ? '处理中...' : '确认隐藏'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
