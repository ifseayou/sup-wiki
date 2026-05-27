'use client';

import EntityManager from '@/components/admin/EntityManager';
import { ClubMemberForm } from '@/components/admin/IndustryAdminForms';
import { clubRoleLabels } from '@/lib/industry-utils';
import { useAdminAuth } from '../layout';

const columns = [
  { key: 'club_id', label: '俱乐部ID' },
  { key: 'role', label: '角色', render: (value: unknown) => clubRoleLabels[String(value)] || String(value || '成员') },
  { key: 'professional_id', label: '专业人员ID', render: (value: unknown) => value ? String(value) : '—' },
  { key: 'athlete_id', label: '运动员ID', render: (value: unknown) => value ? String(value) : '—' },
  { key: 'team_label', label: '队内标签', render: (value: unknown) => value ? String(value) : '—' },
  { key: 'join_status', label: '加入状态', render: (value: unknown) => ({ approved: '已通过', pending: '待审核', rejected: '已拒绝' }[String(value)] || '待审核') },
  { key: 'is_public', label: '公开', render: (value: unknown) => (value === 0 || value === false ? '隐藏' : '公开') },
];

const defaultFormData = {
  member_id: undefined,
  club_id: '',
  professional_id: '',
  athlete_id: '',
  user_id: '',
  role: 'member',
  team_label: '',
  join_status: 'approved',
  is_public: true,
  status: 'published',
};

export default function ClubMembersAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="俱乐部成员"
      apiPath="/api/admin/club-members"
      columns={columns}
      FormComponent={ClubMemberForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索角色 / 队内标签..."
      enableBulkActions
    />
  );
}
