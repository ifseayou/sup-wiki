'use client';

import { useState } from 'react';
import { useAdminAuth } from '../layout';

const entityOptions = [
  { value: 'brands', label: '品牌', apiPath: '/api/admin/brands' },
  { value: 'products', label: '产品', apiPath: '/api/admin/products' },
  { value: 'athletes', label: '运动员', apiPath: '/api/admin/athletes' },
  { value: 'creators', label: '博主', apiPath: '/api/admin/creators' },
  { value: 'events', label: '赛事', apiPath: '/api/admin/events' },
];

interface ImportResult {
  index: number;
  name: string;
  success: boolean;
  error?: string;
  id?: number;
}

export default function BatchImportPage() {
  const { token } = useAdminAuth();
  const [entityType, setEntityType] = useState('events');
  const [jsonText, setJsonText] = useState('');
  const [parsed, setParsed] = useState<Record<string, unknown>[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  function handleParse() {
    setParseError('');
    setParsed(null);
    setResults(null);
    try {
      const raw = JSON.parse(jsonText);
      const arr = Array.isArray(raw) ? raw : [raw];
      setParsed(arr);
      setSelected(new Set(arr.map((_, i) => i)));
    } catch {
      setParseError('JSON 格式有误，请检查');
    }
  }

  function toggleSelect(i: number) {
    const s = new Set(selected);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelected(s);
  }

  function getNameKey(entity: string): string {
    const map: Record<string, string> = { brands: 'name', products: 'model', athletes: 'name', creators: 'nickname', events: 'name' };
    return map[entity] || 'name';
  }

  async function handleImport(status: 'draft' | 'published') {
    if (!parsed) return;
    setImporting(true);
    setResults(null);

    const entity = entityOptions.find(e => e.value === entityType)!;
    const nameKey = getNameKey(entityType);
    const items = parsed.filter((_, i) => selected.has(i));
    const resultList: ImportResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = { ...items[i], status };
      try {
        const res = await fetch(entity.apiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(item),
        });
        const data = await res.json();
        if (res.ok) {
          resultList.push({ index: i, name: String((item as Record<string, unknown>)[nameKey] || `#${i + 1}`), success: true, id: data[`${entityType.slice(0, -1)}_id`] });
        } else {
          resultList.push({ index: i, name: String((item as Record<string, unknown>)[nameKey] || `#${i + 1}`), success: false, error: data.error });
        }
      } catch {
        resultList.push({ index: i, name: String((item as Record<string, unknown>)[nameKey] || `#${i + 1}`), success: false, error: '网络错误' });
      }
    }

    setResults(resultList);
    setImporting(false);
  }

  const successCount = results?.filter(r => r.success).length ?? 0;
  const failCount = results?.filter(r => !r.success).length ?? 0;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brown-800">批量 JSON 导入</h1>
        <p className="text-warm-gray-400 text-sm mt-1">将 Claude Code 生成的 JSON 数据粘贴到下方，解析预览后批量导入</p>
      </div>

      {/* Step 1: Select entity */}
      <div className="bg-cream-50 border border-cream-200 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-6 h-6 rounded-full bg-brown-500 text-white text-xs flex items-center justify-center font-medium">1</span>
          <span className="font-medium text-brown-800">选择实体类型</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {entityOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setEntityType(opt.value); setParsed(null); setResults(null); }}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${entityType === opt.value ? 'bg-brown-500 text-white' : 'border border-cream-300 text-warm-gray-600 hover:border-brown-500'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Paste JSON */}
      <div className="bg-cream-50 border border-cream-200 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-6 h-6 rounded-full bg-brown-500 text-white text-xs flex items-center justify-center font-medium">2</span>
          <span className="font-medium text-brown-800">粘贴 JSON 数据</span>
        </div>
        <p className="text-xs text-warm-gray-400 mb-3">支持单个对象 <code className="bg-cream-200 px-1 rounded">{'{}'}</code> 或对象数组 <code className="bg-cream-200 px-1 rounded">{'[{}, {}]'}</code></p>
        <textarea
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setParsed(null); setResults(null); }}
          rows={12}
          className="w-full font-mono text-xs px-3 py-2.5 border border-cream-300 rounded-lg focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-100 text-brown-800"
          placeholder={`[\n  {\n    "name": "赛事名称",\n    "slug": "event-slug",\n    ...\n  }\n]`}
          spellCheck={false}
        />
        {parseError && <p className="text-red-500 text-xs mt-1">{parseError}</p>}
        <button
          onClick={handleParse}
          disabled={!jsonText.trim()}
          className="mt-3 px-5 py-2 bg-brown-500 text-white rounded-lg text-sm hover:bg-brown-600 transition-all disabled:opacity-40"
        >
          解析预览 →
        </button>
      </div>

      {/* Step 3: Preview & select */}
      {parsed && (
        <div className="bg-cream-50 border border-cream-200 rounded-xl p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-6 h-6 rounded-full bg-brown-500 text-white text-xs flex items-center justify-center font-medium">3</span>
            <span className="font-medium text-brown-800">预览并选择导入项（{selected.size}/{parsed.length}）</span>
          </div>

          <div className="space-y-2 mb-5 max-h-64 overflow-y-auto pr-1">
            {parsed.map((item, i) => {
              const nameKey = getNameKey(entityType);
              const name = String(item[nameKey] || `条目 ${i + 1}`);
              return (
                <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selected.has(i) ? 'border-brown-500 bg-[#FAF5EF]' : 'border-cream-200'}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleSelect(i)}
                    className="mt-0.5 accent-brown-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-brown-800 truncate">{name}</div>
                    <div className="text-xs text-warm-gray-400 font-mono truncate">{JSON.stringify(item).slice(0, 80)}...</div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set(parsed.map((_, i) => i)))} className="text-xs text-brown-500 hover:text-brown-700">全选</button>
            <span className="text-warm-gray-300">|</span>
            <button onClick={() => setSelected(new Set())} className="text-xs text-warm-gray-400 hover:text-warm-gray-600">取消全选</button>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleImport('draft')}
              disabled={importing || selected.size === 0}
              className="px-5 py-2 border border-cream-300 text-warm-gray-600 rounded-lg text-sm hover:border-brown-500 transition-all disabled:opacity-40"
            >
              {importing ? '导入中...' : '导入为草稿'}
            </button>
            <button
              onClick={() => handleImport('published')}
              disabled={importing || selected.size === 0}
              className="px-5 py-2 bg-brown-500 text-white rounded-lg text-sm hover:bg-brown-600 transition-all disabled:opacity-40"
            >
              {importing ? '导入中...' : '导入并发布'}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-cream-50 border border-cream-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">✓</span>
            <span className="font-medium text-brown-800">
              导入完成：{successCount} 成功，{failCount} 失败
            </span>
          </div>
          <div className="space-y-1.5">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm ${r.success ? 'text-green-700' : 'text-red-600'}`}>
                <span>{r.success ? '✓' : '✗'}</span>
                <span className="flex-1 truncate">{r.name}</span>
                {r.error && <span className="text-xs">{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
