export interface IndustryOcrParsed {
  certificate_name?: string;
  issuer?: string;
  certificate_no_masked?: string;
  possible_name?: string;
}

export interface IndustryOcrResult {
  provider: 'aliyun' | 'none';
  configured: boolean;
  text: string;
  raw: unknown[];
  parsed: IndustryOcrParsed;
  warning?: string;
}

function extractTextFromAliyunPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const root = payload as Record<string, unknown>;
  const data = (root.Data || root.data || root.body || root.Body) as unknown;
  const target = data && typeof data === 'object' ? data as Record<string, unknown> : root;
  const direct = target.content || target.text || target.Text || target.ocrText;
  if (typeof direct === 'string') return direct;

  const blocks = target.wordsInfo || target.WordsInfo || target.prism_wordsInfo;
  if (Array.isArray(blocks)) {
    return blocks
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const record = item as Record<string, unknown>;
        return record.word || record.Word || record.text || record.Text || '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function maskCertificateNo(value: string) {
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 6) return compact;
  return `${compact.slice(0, 3)}****${compact.slice(-3)}`;
}

export function parseIndustryOcrText(text: string): IndustryOcrParsed {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const joined = lines.join('\n');
  const parsed: IndustryOcrParsed = {};

  const certificateLine = lines.find((line) => /教练员证|裁判员证|社会体育指导员|救生员|资格证|培训证|证书/.test(line));
  if (certificateLine) parsed.certificate_name = certificateLine.slice(0, 80);

  const issuerLine = lines.find((line) => /(体育总局|水上运动|协会|中心|俱乐部|学校|委员会|联合会)/.test(line));
  if (issuerLine) parsed.issuer = issuerLine.slice(0, 80);

  const noMatch = joined.match(/(?:证书编号|编号|证号|No\.?|NO\.?)[:：\s]*([A-Za-z0-9\-]{6,40})/i);
  if (noMatch?.[1]) parsed.certificate_no_masked = maskCertificateNo(noMatch[1]);

  const nameMatch = joined.match(/(?:姓名|持证人|负责人)[:：\s]*([\u4e00-\u9fa5]{2,6})/);
  if (nameMatch?.[1]) parsed.possible_name = nameMatch[1];

  return parsed;
}

async function runSingleOcr(imageUrl: string) {
  const endpoint = process.env.ALIYUN_OCR_ENDPOINT || '';
  const appCode = process.env.ALIYUN_OCR_APPCODE || '';
  const accessToken = process.env.ALIYUN_OCR_TOKEN || '';

  if (!endpoint || (!appCode && !accessToken)) {
    return { configured: false, text: '', raw: null };
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

  if (!response.ok) return { configured: true, text: '', raw, failed: true };
  return { configured: true, text: extractTextFromAliyunPayload(raw), raw };
}

export async function runIndustrySubmissionOcr(imageUrls: string[]): Promise<IndustryOcrResult> {
  if (imageUrls.length === 0) {
    return { provider: 'none', configured: false, text: '', raw: [], parsed: {}, warning: '未提交可识别图片' };
  }

  const results = await Promise.all(imageUrls.slice(0, 8).map((url) => runSingleOcr(url)));
  const configured = results.some((item) => item.configured);
  if (!configured) {
    return {
      provider: 'none',
      configured: false,
      text: '',
      raw: [],
      parsed: {},
      warning: '未配置阿里云 OCR，已进入人工审核模式',
    };
  }

  const text = results.map((item) => item.text).filter(Boolean).join('\n\n');
  const failed = results.some((item) => item.failed);
  return {
    provider: 'aliyun',
    configured: true,
    text,
    raw: results.map((item) => item.raw),
    parsed: parseIndustryOcrText(text),
    warning: failed ? '部分图片 OCR 失败，已保留图片进入人工审核' : undefined,
  };
}
