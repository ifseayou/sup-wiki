'use client';

import EntityManager from '@/components/admin/EntityManager';
import { CertificateForm } from '@/components/admin/IndustryAdminForms';
import { useAdminAuth } from '../layout';

const columns = [
  { key: 'professional_id', label: '专业人员ID' },
  { key: 'certificate_name', label: '证书名称' },
  { key: 'certificate_type', label: '类型' },
  { key: 'certificate_level', label: '等级' },
  { key: 'issuer', label: '发证机构' },
  { key: 'verification_status', label: '核验', render: (value: unknown) => ({ verified: '已核验', pending: '核验中', incomplete: '资料不完整', expired: '已过期', unverified: '待核验' }[String(value)] || '待核验') },
];

const defaultFormData = {
  certificate_id: undefined,
  professional_id: '',
  certificate_name: '',
  certificate_type: '',
  certificate_level: '',
  issuer: '',
  issue_date: '',
  expiry_date: '',
  certificate_no_masked: '',
  certificate_image_url: '',
  source_type: 'admin_input',
  verification_status: 'pending',
  remark: '',
  status: 'draft',
};

export default function ProfessionalCertificatesAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="证书资料"
      apiPath="/api/admin/professional-certificates"
      columns={columns}
      FormComponent={CertificateForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索证书 / 机构 / 类型..."
      enableBulkActions
    />
  );
}
