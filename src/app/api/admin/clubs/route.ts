import { withAdmin } from '@/lib/admin';
import { clubCrudConfig } from '@/lib/industry-admin-configs';
import { makeBulkHandler, makeCreateHandler, makeListHandler } from '@/lib/admin-industry-api';

export const GET = withAdmin(makeListHandler(clubCrudConfig));
export const POST = withAdmin(makeCreateHandler(clubCrudConfig));
export const PATCH = withAdmin(makeBulkHandler(clubCrudConfig));
