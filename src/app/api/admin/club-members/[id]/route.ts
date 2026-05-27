import { withAdmin } from '@/lib/admin';
import { clubMemberCrudConfig } from '@/lib/industry-admin-configs';
import { makeDeleteHandler, makeGetHandler, makeUpdateHandler } from '@/lib/admin-industry-api';

export const GET = withAdmin(makeGetHandler(clubMemberCrudConfig));
export const PUT = withAdmin(makeUpdateHandler(clubMemberCrudConfig));
export const DELETE = withAdmin(makeDeleteHandler(clubMemberCrudConfig));
