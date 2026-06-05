'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

type Section = { title: string; body: string };

export default function PrivacyPolicyPage() {
  const { token } = useAdminAuth();
  const [title, setTitle] = useState('数据与隐私说明');
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch('/api/admin/privacy-policy', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setTitle(data.title || '数据与隐私说明');
        setSections(Array.isArray(data.sections) ? data.sections : []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function updateSection(index: number, patch: Partial<Section>) {
    setSections(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function addSection() {
    setSections(prev => [...prev, { title: '', body: '' }]);
  }
  function removeSection(index: number) {
    setSections(prev => prev.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    setSections(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/privacy-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, sections }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || '保存失败');
        return;
      }
      setTitle(data.title || title);
      setSections(Array.isArray(data.sections) ? data.sections : sections);
      alert('已保存，小程序「数据与隐私说明」将读取最新内容。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: '#2A2118' }}>数据与隐私说明</h1>
        <p style={{ margin: '6px 0 0', color: '#8B8580', fontSize: 13 }}>
          小程序「我的 - 数据与隐私说明」页读取此处内容；按段落维护，每段含小标题和正文。
        </p>
      </div>

      <div style={{ background: '#FEFCF9', border: '1px solid #E0D8CC', borderRadius: 14, padding: 18 }}>
        <label style={labelStyle}>页面标题</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="数据与隐私说明" />

        <div style={{ margin: '18px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ ...labelStyle, margin: 0 }}>说明段落（{sections.length}）</label>
          <button onClick={addSection} style={buttonGhost}>+ 新增段落</button>
        </div>

        {loading ? (
          <div style={{ color: '#8B8580', fontSize: 13 }}>加载中...</div>
        ) : (
          sections.map((section, index) => (
            <div key={index} style={{ border: '1px solid #E0D8CC', borderRadius: 12, padding: 14, marginBottom: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <span style={{ color: '#8B8580', fontSize: 12 }}>第 {index + 1} 段</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => move(index, -1)} style={miniBtn} disabled={index === 0}>↑</button>
                  <button onClick={() => move(index, 1)} style={miniBtn} disabled={index === sections.length - 1}>↓</button>
                  <button onClick={() => removeSection(index)} style={miniBtn}>删除</button>
                </div>
              </div>
              <input
                value={section.title}
                onChange={e => updateSection(index, { title: e.target.value })}
                style={inputStyle}
                placeholder="段落小标题，如：我们收录哪些数据"
              />
              <textarea
                value={section.body}
                onChange={e => updateSection(index, { body: e.target.value })}
                style={{ ...inputStyle, height: 92, paddingTop: 10, lineHeight: 1.6, marginTop: 8 }}
                placeholder="段落正文"
              />
            </div>
          ))
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={save} style={buttonPrimary} disabled={saving}>{saving ? '保存中...' : '保存生效'}</button>
          <button onClick={load} style={buttonGhost}>重置</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', margin: '12px 0 6px', color: '#6F5B42', fontSize: 13, fontWeight: 700 };
const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: '1px solid #D8CDBE', borderRadius: 8, padding: '8px 10px', background: '#fff' };
const buttonPrimary = { height: 36, border: 0, borderRadius: 8, padding: '0 14px', background: '#8B7355', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const buttonGhost = { height: 32, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 12px', background: '#fff', color: '#6F5B42', fontWeight: 700, cursor: 'pointer' };
const miniBtn = { height: 28, border: '1px solid #D8CDBE', borderRadius: 6, padding: '0 8px', background: '#fff', color: '#6F5B42', fontSize: 12, cursor: 'pointer' };
