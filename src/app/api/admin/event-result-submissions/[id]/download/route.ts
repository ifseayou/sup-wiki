import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { attachmentHeaders, fetchSubmissionBuffer, getSubmissionFile, safeDownloadName } from '@/lib/admin-result-submission-download';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const segments = new URL(request.url).pathname.split('/');
    const id = Number(segments.at(-2));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效提交 ID' }, { status: 400 });
    }

    const file = await getSubmissionFile(id);
    if (!file) return NextResponse.json({ error: '提交记录不存在' }, { status: 404 });

    const buffer = await fetchSubmissionBuffer(file);
    const filename = safeDownloadName(file.original_filename, `result-book-${id}.pdf`);
    return new NextResponse(buffer, {
      headers: attachmentHeaders(filename, 'application/pdf'),
    });
  } catch (error) {
    console.error('下载成绩册 PDF 失败:', error);
    return NextResponse.json({ error: '下载成绩册 PDF 失败' }, { status: 500 });
  }
});
