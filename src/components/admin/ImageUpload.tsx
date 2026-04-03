'use client';

import { useState, useRef, useCallback } from 'react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  token: string;
  label?: string;
}

export default function ImageUpload({ value, onChange, folder = 'misc', token, label = '照片' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        onChange(data.url);
      } else {
        setError(data.error || '上传失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setUploading(false);
    }
  }, [folder, token, onChange]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) upload(file);
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#8A8078', marginBottom: 6 }}>{label}</label>

      {value ? (
        /* ── Has image ── */
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid #EDE5D8',
              flexShrink: 0,
              background: '#FAF7F2',
            }}
          >
            <img
              src={value}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                fontSize: 12,
                color: '#7A6145',
                background: 'none',
                border: '1px solid #EDE5D8',
                borderRadius: 6,
                padding: '5px 12px',
                cursor: 'pointer',
              }}
            >
              {uploading ? '上传中...' : '更换图片'}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              style={{
                fontSize: 12,
                color: '#A08060',
                background: 'none',
                border: 'none',
                padding: '5px 12px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              移除
            </button>
          </div>
        </div>
      ) : (
        /* ── No image ── */
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? '#7A6145' : '#DDD1C0'}`,
            borderRadius: 8,
            padding: '24px 16px',
            textAlign: 'center',
            cursor: uploading ? 'wait' : 'pointer',
            background: dragOver ? '#F5F0E8' : '#FEFCF9',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          {uploading ? (
            <div style={{ fontSize: 13, color: '#8A8078' }}>上传中...</div>
          ) : (
            <>
              <div style={{ fontSize: 24, color: '#C0B4A4', marginBottom: 8 }}>+</div>
              <div style={{ fontSize: 12, color: '#8A8078' }}>
                点击或拖拽图片到这里
              </div>
              <div style={{ fontSize: 11, color: '#C0B4A4', marginTop: 4 }}>
                JPG / PNG / WebP，最大 5MB
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#c0392b', marginTop: 6 }}>{error}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}
