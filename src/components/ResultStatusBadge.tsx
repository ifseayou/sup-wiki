import { getResultStatusLabel, normalizeResultStatusCode } from '@/lib/result-status';

export default function ResultStatusBadge({
  finishTime,
  statusCode,
  statusNote,
  className = '',
}: {
  finishTime: string;
  statusCode?: string | null;
  statusNote?: string | null;
  className?: string;
}) {
  const code = normalizeResultStatusCode(statusCode || finishTime);
  if (!code) return <>{finishTime}</>;
  const label = getResultStatusLabel(code, statusNote);
  return (
    <span
      title={`${code}：${label}`}
      className={`inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ${className}`}
    >
      {code}
    </span>
  );
}
