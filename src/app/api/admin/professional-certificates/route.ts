import { withAdmin } from '@/lib/admin';
import { certificateCrudConfig } from '@/lib/industry-admin-configs';
import { makeBulkHandler, makeCreateHandler, makeListHandler } from '@/lib/admin-industry-api';

export const GET = withAdmin(makeListHandler(certificateCrudConfig));
export const POST = withAdmin(makeCreateHandler(certificateCrudConfig));
export const PATCH = withAdmin(makeBulkHandler(certificateCrudConfig));
