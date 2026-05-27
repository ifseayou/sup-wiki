import { withAdmin } from '@/lib/admin';
import { certificateCrudConfig } from '@/lib/industry-admin-configs';
import { makeDeleteHandler, makeGetHandler, makeUpdateHandler } from '@/lib/admin-industry-api';

export const GET = withAdmin(makeGetHandler(certificateCrudConfig));
export const PUT = withAdmin(makeUpdateHandler(certificateCrudConfig));
export const DELETE = withAdmin(makeDeleteHandler(certificateCrudConfig));
