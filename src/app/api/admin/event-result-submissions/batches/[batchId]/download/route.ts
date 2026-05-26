import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import { PassThrough, Readable } from 'stream';
import type { Archiver, ArchiverOptions, Format } from 'archiver';
import { withAdmin } from '@/lib/admin';
import { attachmentHeaders, fetchSubmissionBuffer, getBatchFiles, safeDownloadName } from '@/lib/admin-result-submission-download';

const require = createRequire(import.meta.url);
const createArchive = require('archiver') as (format: Format, options?: ArchiverOptions) => Archiver;

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const batchId = decodeURIComponent(new URL(request.url).pathname.split('/').at(-2) || '').trim();
    if (!batchId) return NextResponse.json({ error: '缺少批次 ID' }, { status: 400 });

    const files = await getBatchFiles(batchId);
    if (files.length === 0) return NextResponse.json({ error: '批次不存在' }, { status: 404 });

    const passThrough = new PassThrough();
    const archive = createArchive('zip', { zlib: { level: 8 } });
    archive.on('error', (error) => {
      passThrough.destroy(error);
    });
    archive.pipe(passThrough);

    void (async () => {
      try {
        for (const file of files) {
          const buffer = await fetchSubmissionBuffer(file);
          const filename = safeDownloadName(
            `${String(file.batch_file_index || 1).padStart(2, '0')}-${file.original_filename}`,
            `${String(file.batch_file_index || 1).padStart(2, '0')}-result-book.pdf`
          );
          archive.append(buffer, { name: filename });
        }
        await archive.finalize();
      } catch (error) {
        archive.destroy();
        passThrough.destroy(error instanceof Error ? error : new Error('批次下载失败'));
      }
    })();

    const zipName = safeDownloadName(`${files[0].event_name || batchId}-成绩册-${batchId}.zip`, `result-books-${batchId}.zip`);
    return new NextResponse(Readable.toWeb(passThrough) as ReadableStream, {
      headers: attachmentHeaders(zipName, 'application/zip'),
    });
  } catch (error) {
    console.error('下载成绩册批次失败:', error);
    return NextResponse.json({ error: '下载成绩册批次失败' }, { status: 500 });
  }
});
