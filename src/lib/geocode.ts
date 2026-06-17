/**
 * 高德 Web 服务地理编码（服务端调用，key 不出浏览器）。
 * 用于赛事保存时把地址文本解析为经纬度。缺 key/失败均返回 null，不抛异常。
 * key 配置在 .env.local 的 AMAP_WEB_KEY。
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
}

export interface GeocodeParts {
  venue?: string | null;
  location?: string | null;
  city?: string | null;
  province?: string | null;
}

/** 拼出尽量精确的地址文本（场馆/地点优先，叠加省市做消歧）。 */
export function buildGeocodeAddress(parts: GeocodeParts): string {
  const head = [parts.venue, parts.location].map((v) => String(v || '').trim()).filter(Boolean)[0] || '';
  const region = [parts.province, parts.city].map((v) => String(v || '').trim()).filter(Boolean).join('');
  // 地址里若已含省市则不重复叠加
  if (!head) return region;
  return head.includes(region) || !region ? head : `${region}${head}`;
}

export async function geocodeAddress(parts: GeocodeParts): Promise<GeocodeResult | null> {
  const key = process.env.AMAP_WEB_KEY || '';
  const address = buildGeocodeAddress(parts);
  if (!key || !address) return null;
  try {
    const url = new URL('https://restapi.amap.com/v3/geocode/geo');
    url.searchParams.set('key', key);
    url.searchParams.set('address', address);
    const city = String(parts.city || parts.province || '').trim();
    if (city) url.searchParams.set('city', city);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      status?: string;
      geocodes?: Array<{ location?: string; formatted_address?: string }>;
    };
    if (data.status !== '1' || !data.geocodes?.length) return null;
    const loc = String(data.geocodes[0].location || '');
    const [lngStr, latStr] = loc.split(',');
    const lng = Number(lngStr);
    const lat = Number(latStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, formatted: String(data.geocodes[0].formatted_address || address) };
  } catch {
    return null;
  }
}
