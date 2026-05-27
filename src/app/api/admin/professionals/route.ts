import { withAdmin } from '@/lib/admin';
import { professionalCrudConfig } from '@/lib/industry-admin-configs';
import { makeBulkHandler, makeCreateHandler, makeListHandler } from '@/lib/admin-industry-api';

export const GET = withAdmin(makeListHandler(professionalCrudConfig));
export const POST = withAdmin(makeCreateHandler(professionalCrudConfig));
export const PATCH = withAdmin(makeBulkHandler(professionalCrudConfig));
