'use client';

import { useState, useEffect } from 'react';

interface Contribution {
  contribution_id: number;
  entity_type: string;
  action: string;
  status: string;
  created_at: string;
  payload: Record<string, unknown>;
  user_nickname: string | null;
}

const entityLabels: Record<string, string> = {
  brand: '品牌',
  product: '产品',
  athlete: '运动员',
  creator: '博主',
};

const actionLabels: Record<string, string> = {
  create: '新增',
  update: '修改',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};

export default function AdminPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // Simple password protection for demo
  const checkAuth = () => {
    if (password === 'admin123') {
      setIsAuthenticated(true);
      localStorage.setItem('admin_auth', 'true');
    } else {
      alert('密码错误');
    }
  };

  useEffect(() => {
    if (localStorage.getItem('admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchContributions = async () => {
      setLoading(true);
      try {
        // In real implementation, this would call the API with auth token
        // For now, just show empty state
        setContributions([]);
      } catch (error) {
        console.error('获取贡献列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContributions();
  }, [isAuthenticated, selectedStatus]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            管理后台
          </h1>
          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入管理密码"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && checkAuth()}
            />
            <button
              onClick={checkAuth}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">管理后台</h1>
          <p className="text-gray-600">审核用户提交的贡献内容</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('admin_auth');
            setIsAuthenticated(false);
          }}
          className="text-gray-500 hover:text-gray-700"
        >
          退出登录
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-3xl font-bold text-yellow-600">0</div>
          <div className="text-gray-600">待审核</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-3xl font-bold text-green-600">0</div>
          <div className="text-gray-600">今日通过</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-3xl font-bold text-blue-600">0</div>
          <div className="text-gray-600">总贡献数</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-3xl font-bold text-purple-600">0</div>
          <div className="text-gray-600">活跃用户</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div className="flex gap-4">
          {['pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Contributions List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">加载中...</div>
        ) : contributions.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-6xl block mb-4">📭</span>
            <p className="text-gray-600">暂无{statusLabels[selectedStatus]}的贡献</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">类型</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">操作</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">提交人</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">时间</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">状态</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contributions.map((c) => (
                <tr key={c.contribution_id}>
                  <td className="px-6 py-4">{entityLabels[c.entity_type]}</td>
                  <td className="px-6 py-4">{actionLabels[c.action]}</td>
                  <td className="px-6 py-4">{c.user_nickname || '未知'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(c.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[c.status]}`}>
                      {statusLabels[c.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
