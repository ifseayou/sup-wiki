'use client';

import EntityManager from '@/components/admin/EntityManager';
import { ClubForm } from '@/components/admin/IndustryAdminForms';
import { useAdminAuth } from '../layout';

const columns = [
  { key: 'name', label: '俱乐部名称' },
  { key: 'city', label: '城市', render: (_v: unknown, row: Record<string, unknown>) => [row.province, row.city].filter(Boolean).join(' / ') || '—' },
  { key: 'water_area_name', label: '水域' },
  { key: 'water_type', label: '类型' },
  { key: 'verification_status', label: '核验', render: (value: unknown) => ({ verified: '已核验', pending: '核验中', incomplete: '资料不完整', expired: '已过期', unverified: '待核验' }[String(value)] || '待核验') },
  { key: 'claim_status', label: '认领', render: (value: unknown) => ({ claimed: '已认领', pending: '审核中', rejected: '已驳回', unclaimed: '未认领' }[String(value)] || '未认领') },
];

const defaultFormData = {
  club_id: undefined,
  slug: '',
  name: '',
  logo: '',
  cover_image: '',
  images: [],
  province: '',
  city: '',
  district: '',
  address: '',
  water_area_name: '',
  water_type: '',
  lat: '',
  lng: '',
  intro: '',
  services: [],
  safety_facilities: [],
  training_environment: [],
  opening_hours: '',
  contact_method: '',
  owner_user_id: '',
  claim_status: 'unclaimed',
  verification_status: 'unverified',
  source_type: 'admin_input',
  source_note: '',
  sort_order: 0,
  status: 'draft',
};

export default function ClubsAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="俱乐部"
      apiPath="/api/admin/clubs"
      columns={columns}
      FormComponent={ClubForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索俱乐部 / 城市 / 水域..."
      enableBulkActions
    />
  );
}
