'use client';

import ImageUpload, { MultiImageUpload } from '@/components/admin/ImageUpload';
import RegionSelect from '@/components/admin/RegionSelect';

type FormProps = {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  token: string;
};

const inputClass = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-warm-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function StringListEditor({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: unknown;
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const items = toStringList(value);
  return (
    <Field label={label}>
      <textarea
        className={inputClass}
        rows={3}
        value={items.join('\n')}
        onChange={(event) => onChange(event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
        placeholder={placeholder || '每行一个标签'}
      />
    </Field>
  );
}

export function ClubForm({ data, onChange, token }: FormProps) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  const images = toStringList(data.images);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImageUpload value={String(data.logo || '')} onChange={(url) => set('logo', url)} folder="clubs" token={token} label="俱乐部 Logo" />
        <ImageUpload value={String(data.cover_image || '')} onChange={(url) => set('cover_image', url)} folder="clubs" token={token} label="封面图" />
      </div>
      <MultiImageUpload values={images} onChange={(urls) => set('images', urls)} folder="clubs" token={token} label="俱乐部照片" max={12} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="俱乐部名称 *"><input className={inputClass} value={String(data.name || '')} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Slug *"><input className={inputClass} value={String(data.slug || '')} onChange={(e) => set('slug', e.target.value)} placeholder="zhongliu-jishui-sup-club" /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RegionSelect
          idPrefix="club-region"
          province={String(data.province || '')}
          city={String(data.city || '')}
          provinceLabel="省份"
          cityLabel="城市"
          onChange={(value) => onChange({ ...data, province: value.province, city: value.city })}
        />
        <Field label="区县"><input className={inputClass} value={String(data.district || '')} onChange={(e) => set('district', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="训练水域"><input className={inputClass} value={String(data.water_area_name || '')} onChange={(e) => set('water_area_name', e.target.value)} placeholder="余杭塘河" /></Field>
        <Field label="水域类型"><input className={inputClass} value={String(data.water_type || '')} onChange={(e) => set('water_type', e.target.value)} placeholder="城市内河 / 湖泊 / 海边" /></Field>
      </div>
      <Field label="地址"><input className={inputClass} value={String(data.address || '')} onChange={(e) => set('address', e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="纬度"><input className={inputClass} type="number" step="0.0000001" value={String(data.lat || '')} onChange={(e) => set('lat', e.target.value)} /></Field>
        <Field label="经度"><input className={inputClass} type="number" step="0.0000001" value={String(data.lng || '')} onChange={(e) => set('lng', e.target.value)} /></Field>
      </div>
      <Field label="简介"><textarea className={inputClass} rows={4} value={String(data.intro || '')} onChange={(e) => set('intro', e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StringListEditor label="服务项目" value={data.services} onChange={(value) => set('services', value)} />
        <StringListEditor label="安全设施" value={data.safety_facilities} onChange={(value) => set('safety_facilities', value)} />
        <StringListEditor label="训练环境" value={data.training_environment} onChange={(value) => set('training_environment', value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="开放时间"><input className={inputClass} value={String(data.opening_hours || '')} onChange={(e) => set('opening_hours', e.target.value)} /></Field>
        <Field label="联系方式"><input className={inputClass} value={String(data.contact_method || '')} onChange={(e) => set('contact_method', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="认领状态">
          <select className={inputClass} value={String(data.claim_status || 'unclaimed')} onChange={(e) => set('claim_status', e.target.value)}>
            <option value="unclaimed">未认领</option>
            <option value="pending">认领审核中</option>
            <option value="claimed">已认领</option>
            <option value="rejected">认领驳回</option>
          </select>
        </Field>
        <Field label="核验状态">
          <select className={inputClass} value={String(data.verification_status || 'unverified')} onChange={(e) => set('verification_status', e.target.value)}>
            <option value="unverified">待核验</option>
            <option value="pending">核验中</option>
            <option value="verified">已核验</option>
            <option value="expired">已过期</option>
            <option value="incomplete">资料不完整</option>
          </select>
        </Field>
        <Field label="排序"><input className={inputClass} type="number" value={String(data.sort_order || 0)} onChange={(e) => set('sort_order', Number(e.target.value) || 0)} /></Field>
        <Field label="负责人用户 ID"><input className={inputClass} type="number" value={String(data.owner_user_id || '')} onChange={(e) => set('owner_user_id', e.target.value ? Number(e.target.value) : null)} /></Field>
      </div>
      <Field label="资料来源说明"><input className={inputClass} value={String(data.source_note || '')} onChange={(e) => set('source_note', e.target.value)} /></Field>
    </div>
  );
}

export function ProfessionalForm({ data, onChange, token }: FormProps) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  return (
    <div className="space-y-5">
      <ImageUpload value={String(data.avatar || '')} onChange={(url) => set('avatar', url)} folder="professionals" token={token} label="头像" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="姓名 *"><input className={inputClass} value={String(data.name || '')} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="主要身份">
          <select className={inputClass} value={String(data.primary_role || 'coach')} onChange={(e) => set('primary_role', e.target.value)}>
            <option value="coach">教练员</option>
            <option value="referee">裁判员</option>
            <option value="lecturer">讲师</option>
            <option value="organizer">赛事组织者</option>
            <option value="rescue">安全救援</option>
            <option value="club_owner">俱乐部负责人</option>
            <option value="athlete">运动员</option>
          </select>
        </Field>
        <Field label="性别"><input className={inputClass} value={String(data.gender || '')} onChange={(e) => set('gender', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RegionSelect
          idPrefix="professional-region"
          province={String(data.province || '')}
          city={String(data.city || '')}
          provinceLabel="省份"
          cityLabel="城市"
          onChange={(value) => onChange({ ...data, province: value.province, city: value.city })}
        />
        <Field label="俱乐部 ID"><input className={inputClass} type="number" value={String(data.club_id || '')} onChange={(e) => set('club_id', e.target.value ? Number(e.target.value) : null)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="关联用户 ID"><input className={inputClass} type="number" value={String(data.user_id || '')} onChange={(e) => set('user_id', e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="关联运动员 ID"><input className={inputClass} type="number" value={String(data.athlete_id || '')} onChange={(e) => set('athlete_id', e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="排序"><input className={inputClass} type="number" value={String(data.sort_order || 0)} onChange={(e) => set('sort_order', Number(e.target.value) || 0)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StringListEditor label="身份标签" value={data.roles} onChange={(value) => set('roles', value)} placeholder="coach / referee / athlete" />
        <StringListEditor label="擅长方向" value={data.specialties} onChange={(value) => set('specialties', value)} placeholder="零基础入门 / 竞速训练" />
        <StringListEditor label="服务项目" value={data.service_items} onChange={(value) => set('service_items', value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StringListEditor label="可教学等级" value={data.teaching_level} onChange={(value) => set('teaching_level', value)} />
        <StringListEditor label="教学环境" value={data.teaching_environment} onChange={(value) => set('teaching_environment', value)} />
      </div>
      <Field label="一句话介绍"><input className={inputClass} value={String(data.intro_short || '')} onChange={(e) => set('intro_short', e.target.value)} /></Field>
      <Field label="个人简介"><textarea className={inputClass} rows={4} value={String(data.bio || '')} onChange={(e) => set('bio', e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="微信"><input className={inputClass} value={String(data.wechat_contact || '')} onChange={(e) => set('wechat_contact', e.target.value)} /></Field>
        <Field label="脱敏电话"><input className={inputClass} value={String(data.phone_masked || '')} onChange={(e) => set('phone_masked', e.target.value)} /></Field>
        <Field label="是否公开联系方式">
          <select className={inputClass} value={data.contact_visible ? '1' : '0'} onChange={(e) => set('contact_visible', e.target.value === '1')}>
            <option value="0">不公开</option>
            <option value="1">公开</option>
          </select>
        </Field>
        <Field label="核验状态">
          <select className={inputClass} value={String(data.verification_status || 'unverified')} onChange={(e) => set('verification_status', e.target.value)}>
            <option value="unverified">待核验</option>
            <option value="pending">核验中</option>
            <option value="verified">已核验</option>
            <option value="expired">已过期</option>
            <option value="incomplete">资料不完整</option>
          </select>
        </Field>
      </div>
      <Field label="资料来源说明"><input className={inputClass} value={String(data.source_note || '')} onChange={(e) => set('source_note', e.target.value)} /></Field>
    </div>
  );
}

export function CertificateForm({ data, onChange, token }: FormProps) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  return (
    <div className="space-y-4">
      <ImageUpload value={String(data.certificate_image_url || '')} onChange={(url) => set('certificate_image_url', url)} folder="certificates" token={token} label="证书图片（需脱敏）" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="专业人员 ID *"><input className={inputClass} type="number" value={String(data.professional_id || '')} onChange={(e) => set('professional_id', e.target.value ? Number(e.target.value) : '')} /></Field>
        <Field label="证书名称 *"><input className={inputClass} value={String(data.certificate_name || '')} onChange={(e) => set('certificate_name', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="证书类型"><input className={inputClass} value={String(data.certificate_type || '')} onChange={(e) => set('certificate_type', e.target.value)} /></Field>
        <Field label="等级"><input className={inputClass} value={String(data.certificate_level || '')} onChange={(e) => set('certificate_level', e.target.value)} /></Field>
        <Field label="发证机构"><input className={inputClass} value={String(data.issuer || '')} onChange={(e) => set('issuer', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="发证日期"><input className={inputClass} type="date" value={String(data.issue_date || '').slice(0, 10)} onChange={(e) => set('issue_date', e.target.value)} /></Field>
        <Field label="有效期至"><input className={inputClass} type="date" value={String(data.expiry_date || '').slice(0, 10)} onChange={(e) => set('expiry_date', e.target.value)} /></Field>
        <Field label="脱敏证书号"><input className={inputClass} value={String(data.certificate_no_masked || '')} onChange={(e) => set('certificate_no_masked', e.target.value)} /></Field>
        <Field label="核验状态">
          <select className={inputClass} value={String(data.verification_status || 'pending')} onChange={(e) => set('verification_status', e.target.value)}>
            <option value="unverified">待核验</option>
            <option value="pending">核验中</option>
            <option value="verified">已核验</option>
            <option value="expired">已过期</option>
            <option value="incomplete">资料不完整</option>
          </select>
        </Field>
      </div>
      <Field label="备注"><input className={inputClass} value={String(data.remark || '')} onChange={(e) => set('remark', e.target.value)} /></Field>
    </div>
  );
}

export function ClubMemberForm({ data, onChange }: FormProps) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="俱乐部 ID *"><input className={inputClass} type="number" value={String(data.club_id || '')} onChange={(e) => set('club_id', e.target.value ? Number(e.target.value) : '')} /></Field>
        <Field label="专业人员 ID"><input className={inputClass} type="number" value={String(data.professional_id || '')} onChange={(e) => set('professional_id', e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="运动员 ID"><input className={inputClass} type="number" value={String(data.athlete_id || '')} onChange={(e) => set('athlete_id', e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="用户 ID"><input className={inputClass} type="number" value={String(data.user_id || '')} onChange={(e) => set('user_id', e.target.value ? Number(e.target.value) : null)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="成员角色">
          <select className={inputClass} value={String(data.role || 'member')} onChange={(e) => set('role', e.target.value)}>
            <option value="owner">负责人</option>
            <option value="coach">教练员</option>
            <option value="referee">裁判员</option>
            <option value="athlete">运动员</option>
            <option value="member">成员</option>
          </select>
        </Field>
        <Field label="队内标签"><input className={inputClass} value={String(data.team_label || '')} onChange={(e) => set('team_label', e.target.value)} placeholder="精英队 / 青训队" /></Field>
        <Field label="加入状态">
          <select className={inputClass} value={String(data.join_status || 'approved')} onChange={(e) => set('join_status', e.target.value)}>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
        </Field>
        <Field label="公开展示">
          <select className={inputClass} value={data.is_public === false || data.is_public === 0 ? '0' : '1'} onChange={(e) => set('is_public', e.target.value === '1')}>
            <option value="1">公开</option>
            <option value="0">隐藏</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
