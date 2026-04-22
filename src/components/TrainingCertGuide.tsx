'use client';

const OSS = 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs';
const FORMS = `${OSS}/training-forms/1776851044635`;

function DownloadLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: '#7A6145', fontWeight: 600, textDecoration: 'none',
        borderBottom: '1.5px dashed #C4A882', paddingBottom: 1,
        position: 'relative', cursor: 'pointer',
      }}
      title="点击下载"
    >
      {children}
      <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.7 }}>↓</span>
    </a>
  );
}

function StepCard({ step, color, icon, title, children }: {
  step: number; color: string; icon: string; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${color}22`, boxShadow: `0 2px 12px ${color}10`,
      marginBottom: 28,
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${color}, ${color}CC)`,
        padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{
          width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>{icon}</span>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.05em', marginBottom: 2 }}>
            第 {step} 步
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{title}</div>
        </div>
      </div>
      <div style={{ padding: '20px 24px', fontSize: 14, lineHeight: 1.85, color: '#3D3730' }}>
        {children}
      </div>
    </div>
  );
}

function InfoTable({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, margin: '12px 0' }}>
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} style={{ borderBottom: '1px solid #F0EAE0' }}>
            <td style={{ padding: '8px 12px', color: '#8A8078', whiteSpace: 'nowrap', width: 90, verticalAlign: 'top' }}>{label}</td>
            <td style={{ padding: '8px 12px', color: '#2E2118', fontWeight: 500 }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 12, fontWeight: 600,
      background: bg, color, padding: '3px 10px', borderRadius: 12, marginRight: 6,
    }}>{children}</span>
  );
}

export default function TrainingCertGuide() {
  return (
    <div>
      {/* 总览时间线 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        margin: '0 0 32px', padding: '20px', background: '#FEFCF9',
        borderRadius: 12, border: '1px solid #EDE5D8',
      }}>
        {[
          { step: '①', title: '中心备案', time: '~10 个工作日', color: '#0E6655' },
          { step: '②', title: '开班申请', time: '~5 个工作日', color: '#B7470A' },
          { step: '③', title: '申请证书', time: '~7 天 + 制证 ~1 月', color: '#6C3483' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: s.color,
              color: '#fff', fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>{s.step}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2E2118', marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: '#8A8078' }}>{s.time}</div>
          </div>
        ))}
      </div>

      <div style={{
        background: '#F0EAE0', borderRadius: 10, padding: '12px 16px',
        fontSize: 13, color: '#5E4A33', marginBottom: 28, textAlign: 'center',
      }}>
        统一联系邮箱：<strong style={{ color: '#2E2118' }}>chinasup@sports.cn</strong>
      </div>

      {/* Step 1 */}
      <StepCard step={1} color="#0E6655" icon="📋" title="中心备案">
        <p style={{ margin: '0 0 12px', color: '#655D56' }}>
          发邮件到 <code style={{ background: '#F0EAE0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>chinasup@sports.cn</code>，附以下材料：
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
          <li>俱乐部营业执照（经营范围须含<strong>体育培训</strong>）</li>
          <li>法人和负责人姓名 + 联系方式</li>
          <li>参与培训教练员的<strong>教练员证书</strong></li>
          <li><strong>水域使用证明</strong>（行政部门/私人机构盖章证明，或俱乐部盖章情况说明）</li>
        </ul>

        <div style={{
          background: '#F8F6F2', borderRadius: 10, padding: '14px 18px',
          border: '1px solid #EDE5D8',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2E2118', marginBottom: 8 }}>水域标准</div>
          <InfoTable rows={[
            ['水质', '≥ 3 类'],
            ['水深', '平均 > 2m'],
            ['流速', '≤ 0.3m/s'],
            ['涌浪', '≤ 0.2m'],
            ['面积', '长 ≥ 250m，宽 ≥ 50m'],
          ]} />
          <p style={{ fontSize: 12, color: '#8A8078', margin: '8px 0 0' }}>
            水域须有固定下水区域，非航道，无垂钓，不与其他项目混用。
          </p>
        </div>
      </StepCard>

      {/* Step 2 */}
      <StepCard step={2} color="#B7470A" icon="📨" title="开班申请">
        <p style={{ margin: '0 0 4px' }}>
          <Badge bg="#FDF2E9" color="#B7470A">前提</Badge>备案已通过
        </p>
        <p style={{ margin: '8px 0 12px', color: '#655D56' }}>
          邮件标题：<code style={{ background: '#F0EAE0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>
            xx俱乐部 + 申请办理全国桨板运动水平等级培训班 Lx-Lx
          </code>
        </p>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2E2118', marginBottom: 6 }}>附件：</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>本次带班教练员的<strong>教练员证书</strong></li>
            <li>保险证明</li>
            <li>盖章<DownloadLink href={`${FORMS}-apply-form.xls`}>申请表</DownloadLink></li>
          </ul>
        </div>

        <div style={{
          background: '#FDF8F4', borderRadius: 10, padding: '12px 16px',
          border: '1px solid #F5E6D8', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2E2118', marginBottom: 6 }}>教练员等级要求</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span>L1-L4 → 初级教练员</span>
            <span>L5-L6 → <strong style={{ color: '#B7470A' }}>中级教练员</strong></span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8A8078', marginBottom: 8 }}>邮件格式参考</div>
          <img
            src={`${OSS}/1776850105679-t2frbw-open-class-email.png`}
            alt="开班申请邮件格式"
            style={{ width: '100%', borderRadius: 8, border: '1px solid #EDE5D8' }}
          />
        </div>
      </StepCard>

      {/* Step 3 */}
      <StepCard step={3} color="#6C3483" icon="🎓" title="培训结束后申请证书">
        <p style={{ margin: '0 0 12px', color: '#655D56' }}>
          邮件标题：<code style={{ background: '#F0EAE0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>
            俱乐部名称 + 学员证书申请
          </code>
        </p>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2E2118', marginBottom: 6 }}>附件：</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>转账记录截图（须能看清<strong>转账单位</strong>和<strong>金额</strong>）</li>
            <li>盖章<strong>考核表</strong></li>
            <li><strong>学员信息表</strong></li>
            <li>收件地址</li>
          </ul>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{
            background: '#F9F5FF', borderRadius: 10, padding: '12px 16px',
            border: '1px solid #E8DAEF',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2E2118', marginBottom: 6 }}>制证费用</div>
            <div style={{ fontSize: 13 }}>L1：50 元/人</div>
            <div style={{ fontSize: 13 }}>L2-L6：100 元/人</div>
          </div>
          <div style={{
            background: '#F9F5FF', borderRadius: 10, padding: '12px 16px',
            border: '1px solid #E8DAEF',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2E2118', marginBottom: 6 }}>收款账户</div>
            <div style={{ fontSize: 11, color: '#655D56', lineHeight: 1.6 }}>
              国家体育总局水上运动管理中心<br />
              工行体育馆路支行<br />
              0200008109026407839
            </div>
          </div>
        </div>

        <details style={{
          background: '#F8F6F2', borderRadius: 10, padding: '0',
          border: '1px solid #EDE5D8', marginBottom: 16,
        }}>
          <summary style={{
            padding: '12px 16px', cursor: 'pointer', fontSize: 13,
            fontWeight: 600, color: '#655D56', listStyle: 'none',
          }}>
            <span style={{ marginRight: 6 }}>▸</span>收款账户完整信息
          </summary>
          <div style={{ padding: '0 16px 14px' }}>
            <InfoTable rows={[
              ['名称', '国家体育总局水上运动管理中心'],
              ['税号', '121000004000097925'],
              ['地址', '北京市东城区天坛东里中区甲14号航管中心院内西办公楼'],
              ['电话', '67103408'],
              ['开户行', '中国工商银行北京体育馆路支行'],
              ['账号', '0200008109026407839'],
            ]} />
          </div>
        </details>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8A8078', marginBottom: 8 }}>邮件格式参考</div>
          <img
            src={`${OSS}/1776850105679-d8kgmg-cert-email.png`}
            alt="证书申请邮件格式"
            style={{ width: '100%', borderRadius: 8, border: '1px solid #EDE5D8' }}
          />
        </div>
      </StepCard>

      {/* 附件下载区 */}
      <div style={{
        background: '#FEFCF9', borderRadius: 14, padding: '20px 24px',
        border: '1px solid #EDE5D8',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2E2118', marginBottom: 16 }}>
          📎 附件下载
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7A6145', marginBottom: 8 }}>开班申请表</div>
          <a href={`${FORMS}-apply-form.xls`} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', background: '#F0EAE0', borderRadius: 8,
              fontSize: 13, color: '#5E4A33', textDecoration: 'none', fontWeight: 500,
            }}>
            📄 全国桨板运动水平等级培训班申请表.xls
            <span style={{ fontSize: 11, color: '#8A8078' }}>↓</span>
          </a>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7A6145', marginBottom: 8 }}>考核表（盖章后随邮件提交）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: '一星 L1', file: 'L1-exam-form.docx' },
              { label: '一星 L2', file: 'L2-exam-form.docx' },
              { label: '二星 L3', file: 'L3-exam-form.docx' },
              { label: '二星 L4', file: 'L4-exam-form.docx' },
              { label: '三星 L5', file: 'L5-exam-form.docx' },
              { label: '三星 L6', file: 'L6-exam-form.docx' },
            ].map(({ label, file }) => (
              <a key={file} href={`${FORMS}-${file}`} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', background: '#F5F0E8', borderRadius: 8,
                  fontSize: 12, color: '#5E4A33', textDecoration: 'none', fontWeight: 500,
                  border: '1px solid #EDE5D8',
                }}>
                📝 {label}
                <span style={{ fontSize: 10, color: '#8A8078' }}>↓</span>
              </a>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7A6145', marginBottom: 8 }}>学员信息表</div>
          <a href={`${FORMS}-student-info-template.xlsx`} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', background: '#F0EAE0', borderRadius: 8,
              fontSize: 13, color: '#5E4A33', textDecoration: 'none', fontWeight: 500,
            }}>
            📊 学员信息表模板.xlsx
            <span style={{ fontSize: 11, color: '#8A8078' }}>↓</span>
          </a>
        </div>

        <p style={{ fontSize: 12, color: '#8A8078', margin: '14px 0 0' }}>
          考核格式统一：序号、姓名、技术考核、笔试考核（≥85 分合格）、备注。技术动作考核共两次机会，两次未通过需重新上课。
        </p>
      </div>
    </div>
  );
}
