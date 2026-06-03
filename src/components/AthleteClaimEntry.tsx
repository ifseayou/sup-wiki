'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  restore_frontend: '展示主页',
  hide_results_points: '隐藏成绩&积分',
  restore_results_points: '公开成绩与积分',
};

const actionTips: Record<string, string> = {
  hide_athlete: '其他用户不能查看个人主页资料，自己仍可查看资料和成绩，确认后立即生效。',
  restore_frontend: '恢复个人主页展示，其他用户将可以正常查看公开资料和主页成绩。',
  hide_results_points: '其他用户在成绩查询、积分查询和赛事组别中只能看到必要的组别、项目、赛事、队伍或来源信息，其余成绩与积分字段显示为隐藏。',
  restore_results_points: '公开成绩与积分展示，其他用户可在成绩查询、积分查询和赛事组别中正常查看。',
};

export default function AthleteClaimEntry({ athleteId }: { athleteId: number }) {
  const router = useRouter();
  const { token, loading } = useUser();
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [showHideModal, setShowHideModal] = useState(false);
  const [showHideResultsModal, setShowHideResultsModal] = useState(false);
  const [processingAction, setProcessingAction] = useState('');
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

  useEffect(() => {
    if (!status?.is_owner || status.privacy_mode !== 'hidden') return;
    const key = `sup_owner_hidden_refresh_${athleteId}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    router.refresh();
  }, [athleteId, router, status?.is_owner, status?.privacy_mode]);

  async function submitPrivacyAction(requestType: 'hide_athlete' | 'restore_frontend' | 'hide_results_points' | 'restore_results_points') {
    if (!token) return;
    setProcessingAction(requestType);
    setHideError('');
    const isResultsAction = requestType === 'hide_results_points' || requestType === 'restore_results_points';
    try {
      const res = await fetch('/api/user/privacy-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          target_type: 'athlete',
          target_id: athleteId,
          request_type: requestType,
          description: requestType === 'restore_frontend'
            ? '本人确认展示运动员主页'
            : requestType === 'hide_results_points'
              ? '本人确认隐藏成绩与积分'
              : requestType === 'restore_results_points'
                ? '本人确认公开成绩与积分'
                : '本人确认隐藏运动员主页',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (isResultsAction ? '成绩与积分隐私切换失败' : requestType === 'restore_frontend' ? '展示主页失败' : '隐藏主页失败'));
      setShowHideModal(false);
      setShowHideResultsModal(false);
      setStatus((prev) => prev ? {
        ...prev,
        privacy_mode: requestType === 'restore_frontend' ? 'claimed' : requestType === 'hide_athlete' ? 'hidden' : prev.privacy_mode,
        privacy_actions: prev.privacy_actions?.map((action) => {
          if (requestType === 'hide_results_points' && action === 'hide_results_points') return 'restore_results_points';
          if (requestType === 'restore_results_points' && action === 'restore_results_points') return 'hide_results_points';
          if (requestType === 'restore_frontend' && action === 'restore_frontend') return 'hide_athlete';
          return action;
        }),
      } : prev);
      loadStatus();
    } catch (error) {
      setHideError(error instanceof Error ? error.message : isResultsAction ? '成绩与积分隐私切换失败' : requestType === 'restore_frontend' ? '展示主页失败' : '隐藏主页失败');
    } finally {
      setProcessingAction('');
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
        <Tooltip key={action} tip={actionTips[action]} dotted={false} align="end">
          <button
            type="button"
            onClick={() => {
              setHideError('');
              setShowHideModal(true);
            }}
            disabled={Boolean(processingAction)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D8CDBE] bg-white px-4 text-sm font-semibold text-[#6B4A24] transition hover:bg-[#FAF6EF] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {processingAction === action ? '处理中...' : actionLabels[action]}
          </button>
        </Tooltip>
      ) : action === 'restore_frontend' ? (
        <Tooltip key={action} tip={actionTips[action]} dotted={false} align="end">
          <button
            type="button"
            onClick={() => submitPrivacyAction('restore_frontend')}
            disabled={Boolean(processingAction)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D8CDBE] bg-white px-4 text-sm font-semibold text-[#6B4A24] transition hover:bg-[#FAF6EF] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {processingAction === action ? '处理中...' : actionLabels[action]}
          </button>
        </Tooltip>
      ) : action === 'hide_results_points' || action === 'restore_results_points' ? (
        <Tooltip key={action} tip={actionTips[action]} dotted={false} align="end">
          <button
            type="button"
            onClick={() => {
              if (action === 'hide_results_points') {
                setHideError('');
                setShowHideResultsModal(true);
              } else {
                submitPrivacyAction('restore_results_points');
              }
            }}
            disabled={Boolean(processingAction)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D8CDBE] bg-white px-4 text-sm font-semibold text-[#6B4A24] transition hover:bg-[#FAF6EF] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {processingAction === action ? '处理中...' : actionLabels[action]}
          </button>
        </Tooltip>
      ) : (
        <Tooltip key={action} tip={actionTips[action]} dotted={false} align="end">
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
              <button type="button" onClick={() => submitPrivacyAction('hide_athlete')} disabled={Boolean(processingAction)} className="h-10 rounded-lg bg-[#6B4A24] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {processingAction ? '处理中...' : '确认隐藏'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showHideResultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2E2118]/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#E3D6C4] bg-[#FEFCF9] p-6 shadow-[0_30px_90px_rgba(46,33,24,0.28)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A08060]">Privacy</div>
            <h2 className="mt-3 text-2xl font-semibold text-[#2E2118]">确认隐藏成绩&积分？</h2>
            <p className="mt-3 text-sm leading-7 text-[#6F655C]">
              隐藏后，其他用户在成绩查询、积分查询和赛事组别中只能看到组别、项目、赛事、队伍或来源信息，名次、成绩、积分、姓名等会显示为隐藏。你本人登录后仍可完整查看，也可以随时公开成绩与积分。
            </p>
            {hideError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{hideError}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowHideResultsModal(false)} className="h-10 rounded-lg border border-[#D8CDBE] bg-white px-4 text-sm font-semibold text-[#6F5B42]">
                取消
              </button>
              <button type="button" onClick={() => submitPrivacyAction('hide_results_points')} disabled={Boolean(processingAction)} className="h-10 rounded-lg bg-[#6B4A24] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {processingAction ? '处理中...' : '确认隐藏'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
