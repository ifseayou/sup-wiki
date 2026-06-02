export async function readAdminResponse(res: Response) {
  const text = await res.text();
  let data: Record<string, unknown> = {};

  if (text) {
    try {
      const parsed = JSON.parse(text);
      data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { raw: parsed };
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const message = String(data.error || data.detail || data.message || data.raw || `请求失败（${res.status}）`);
    console.error('Admin API request failed', {
      url: res.url,
      status: res.status,
      body: data,
    });
    throw new Error(message);
  }

  return data;
}

