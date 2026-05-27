'use client';

import EntityManager from '@/components/admin/EntityManager';
import { ProfessionalForm } from '@/components/admin/IndustryAdminForms';
import { roleLabel } from '@/lib/industry-utils';
import { useAdminAuth } from '../layout';

const columns = [
  { key: 'name', label: '姓名' },
  { key: 'primary_role', label: '主要身份', render: (value: unknown) => roleLabel(value) },
  { key: 'city', label: '城市', render: (_v: unknown, row: Record<string, unknown>) => [row.province, row.city].filter(Boolean).join(' / ') || '—' },
  { key: 'club_id', label: '俱乐部ID', render: (value: unknown) => value ? String(value) : '—' },
  { key: 'verification_status', label: '核验', render: (value: unknown) => ({ verified: '已核验', pending: '核验中', incomplete: '资料不完整', expired: '已过期', unverified: '待核验' }[String(value)] || '待核验') },
  { key: 'claim_status', label: '认领', render: (value: unknown) => ({ claimed: '已认领', pending: '审核中', rejected: '已驳回', unclaimed: '未认领' }[String(value)] || '未认领') },
];

const defaultFormData = {
  professional_id: undefined,
  user_id: '',
  athlete_id: '',
  name: '',
  avatar: '',
  gender: '',
  province: '',
  city: '',
  roles: ['coach'],
  primary_role: 'coach',
  club_id: '',
  bio: '',
  intro_short: '',
  specialties: [],
  service_items: [],
  teaching_level: [],
  teaching_environment: [],
  contact_visible: false,
  wechat_contact: '',
  phone_masked: '',
  claim_status: 'unclaimed',
  verification_status: 'unverified',
  source_type: 'admin_input',
  source_note: '',
  sort_order: 0,
  status: 'draft',
};

export default function ProfessionalsAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="专业人员"
      apiPath="/api/admin/professionals"
      columns={columns}
      FormComponent={ProfessionalForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索姓名 / 城市 / 擅长方向..."
      additionalFilters={[
        {
          key: 'primary_role',
          placeholder: '全部身份',
          options: [
            { label: '教练员', value: 'coach' },
            { label: '裁判员', value: 'referee' },
            { label: '讲师', value: 'lecturer' },
            { label: '赛事组织者', value: 'organizer' },
            { label: '安全救援', value: 'rescue' },
            { label: '俱乐部负责人', value: 'club_owner' },
          ],
        },
      ]}
      enableBulkActions
    />
  );
}
