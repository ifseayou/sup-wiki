import { withAdmin } from '@/lib/admin';
import { professionalCrudConfig } from '@/lib/industry-admin-configs';
import { makeDeleteHandler, makeGetHandler, makeUpdateHandler } from '@/lib/admin-industry-api';

export const GET = withAdmin(makeGetHandler(professionalCrudConfig));
export const PUT = withAdmin(makeUpdateHandler(professionalCrudConfig));
export const DELETE = withAdmin(makeDeleteHandler(professionalCrudConfig));
