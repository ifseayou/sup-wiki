import type { RowDataPacket } from 'mysql2';

export interface TechniqueItem {
  technique_id: number;
  source_code: string | null;
  name: string;
  cover_image?: string | null;
  images?: string[];
  stage: number;
  stage_label: string;
  level: string;
  category: string | null;
  points: number;
  key_points: string | null;
  common_errors: string | null;
  sort_order: number;
  status: string;
}

export function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    return JSON.parse(String(value));
  } catch {
    return [];
  }
}

export function normalizeTechniqueIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
}

export function parseTechniqueJson(value: unknown): TechniqueItem[] {
  const list = parseJsonArray(value);
  return list
    .filter((item): item is TechniqueItem => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      ...item,
      images: parseJsonArray((item as TechniqueItem).images).filter((url): url is string => typeof url === 'string'),
    })) as TechniqueItem[];
}

export function getTechniqueIdsFromRows(rows: RowDataPacket[]): number[] {
  return rows.map((row) => Number(row.technique_id)).filter((id) => Number.isInteger(id) && id > 0);
}
