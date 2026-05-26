import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export interface ResultSubmissionFile extends RowDataPacket {
  submission_id: number;
  batch_id: string;
  batch_file_index: number;
  batch_total: number;
  event_name: string;
  file_url: string;
  original_filename: string;
  size_bytes: number;
}

export function safeDownloadName(name: string, fallback: string) {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return cleaned || fallback;
}

export function attachmentHeaders(filename: string, contentType: string) {
  const ascii = safeDownloadName(filename, 'download').replace(/[^\x20-\x7E]+/g, '-');
  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Cache-Control': 'private, no-store',
  };
}

export async function getSubmissionFile(id: number) {
  const [rows] = await pool.execute<ResultSubmissionFile[]>(
    `SELECT submission_id, COALESCE(batch_id, CONCAT('legacy-', submission_id)) AS batch_id,
            COALESCE(batch_file_index, 1) AS batch_file_index,
            COALESCE(batch_total, 1) AS batch_total,
            event_name, file_url, original_filename, size_bytes
     FROM sup_event_result_submissions
     WHERE submission_id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function getBatchFiles(batchId: string) {
  const [rows] = await pool.execute<ResultSubmissionFile[]>(
    `SELECT submission_id, COALESCE(batch_id, CONCAT('legacy-', submission_id)) AS batch_id,
            COALESCE(batch_file_index, 1) AS batch_file_index,
            COALESCE(batch_total, 1) AS batch_total,
            event_name, file_url, original_filename, size_bytes
     FROM sup_event_result_submissions
     WHERE COALESCE(batch_id, CONCAT('legacy-', submission_id)) = ?
     ORDER BY COALESCE(batch_file_index, 1) ASC, submission_id ASC`,
    [batchId]
  );
  return rows;
}

export async function fetchSubmissionBuffer(file: ResultSubmissionFile) {
  const response = await fetch(file.file_url);
  if (!response.ok) {
    throw new Error(`下载 ${file.original_filename} 失败`);
  }
  return Buffer.from(await response.arrayBuffer());
}
