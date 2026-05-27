import { withAdmin } from '@/lib/admin';
import { clubMemberCrudConfig } from '@/lib/industry-admin-configs';
import { makeBulkHandler, makeCreateHandler, makeListHandler } from '@/lib/admin-industry-api';

export const GET = withAdmin(makeListHandler(clubMemberCrudConfig));
export const POST = withAdmin(makeCreateHandler(clubMemberCrudConfig));
export const PATCH = withAdmin(makeBulkHandler(clubMemberCrudConfig));
