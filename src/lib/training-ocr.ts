import { parseGarminTrainingText } from '@/lib/training-parser';

export interface TrainingOcrResult {
  provider: 'aliyun' | 'none';
  configured: boolean;
  text: string;
  raw: unknown;
  warning?: string;
}

function extractTextFromAliyunPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const root = payload as Record<string, unknown>;
  const data = (root.Data || root.data || root.body || root.Body) as unknown;
  const target = data && typeof data === 'object' ? data as Record<string, unknown> : root;
  const direct = target.content || target.text || target.Text || target.ocrText;
  if (typeof direct === 'string') return direct;

  const blocks = target.wordsInfo || target.WordsInfo || target.prism_wordsInfo || target.prism_wordsInfo;
  if (Array.isArray(blocks)) {
    return blocks
      .map(item => {
        if (!item || typeof item !== 'object') return '';
        const record = item as Record<string, unknown>;
        return record.word || record.Word || record.text || record.Text || '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

export async function runTrainingOcr(imageUrl: string): Promise<TrainingOcrResult> {
  const endpoint = process.env.ALIYUN_OCR_ENDPOINT || '';
  const appCode = process.env.ALIYUN_OCR_APPCODE || '';
  const accessToken = process.env.ALIYUN_OCR_TOKEN || '';

  if (!endpoint || (!appCode && !accessToken)) {
    return {
      provider: 'none',
      configured: false,
      text: '',
      raw: null,
      warning: '未配置阿里云 OCR，已进入手动校对模式',
    };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (appCode) headers.Authorization = `APPCODE ${appCode}`;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: imageUrl, image_url: imageUrl }),
  });

  const rawText = await response.text();
  let raw: unknown = rawText;
  try {
    raw = JSON.parse(rawText);
  } catch {
    raw = rawText;
  }

  if (!response.ok) {
    return {
      provider: 'aliyun',
      configured: true,
      text: '',
      raw,
      warning: '阿里云 OCR 返回失败，已进入手动校对模式',
    };
  }

  return {
    provider: 'aliyun',
    configured: true,
    text: extractTextFromAliyunPayload(raw),
    raw,
  };
}

export function parseTrainingOcrText(text: string) {
  return parseGarminTrainingText(text);
}
