import { withAdmin } from '@/lib/admin';
import { clubCrudConfig } from '@/lib/industry-admin-configs';
import { makeDeleteHandler, makeGetHandler, makeUpdateHandler } from '@/lib/admin-industry-api';

export const GET = withAdmin(makeGetHandler(clubCrudConfig));
export const PUT = withAdmin(makeUpdateHandler(clubCrudConfig));
export const DELETE = withAdmin(makeDeleteHandler(clubCrudConfig));
