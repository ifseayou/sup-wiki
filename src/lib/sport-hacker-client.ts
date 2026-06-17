/**
 * 反向内部客户端：sup-wiki 后台 → sport_hacker 内部接口（同机 127.0.0.1:3002）。
 * 用于赛事提报的 AI 抽取与录入（AI 与多表写入都在 sport_hacker）。
 */
const BASE = process.env.SPORT_HACKER_INTERNAL_BASE_URL || 'http://127.0.0.1:3002';
const TOKEN = process.env.INTERNAL_API_TOKEN || '';

export async function callSportHackerInternal(
  apiPath: string,
  body: unknown = {},
  timeoutMs = 130000
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  if (!TOKEN) {
    return { ok: false, status: 500, data: { error: '未配置 INTERNAL_API_TOKEN' } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE}${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': TOKEN },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data: Record<string, unknown> = {};
    try { data = (await resp.json()) as Record<string, unknown>; } catch { data = {}; }
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    return { ok: false, status: 502, data: { error: (e as Error)?.message || '内部调用失败' } };
  } finally {
    clearTimeout(timer);
  }
}
