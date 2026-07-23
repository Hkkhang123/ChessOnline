'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  // Quản lý trạng thái bằng email thay vì username
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Route Guard: Nếu đã đăng nhập thì tự động đẩy về trang chủ
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Gửi request dạng JSON thô để khớp với Pydantic model (LoginRequest) ở Backend
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Sai tài khoản hoặc mật khẩu');
      }

      // Backend trả về data gồm { access_token, user: { username, elo } }
      // Lưu thông tin user (đầy đủ username và elo) vào AuthContext
      login(data.user, data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Hiển thị màn hình chờ khi hệ thống đang check trạng thái token hoặc đã có user
  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl">
        <h2 className="text-3xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
          ĐĂNG NHẬP CHESS
        </h2>
        
        {error && <p className="mb-4 text-sm text-rose-500 bg-rose-950/30 p-3 rounded-lg border border-rose-900/50 text-center">{error}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Địa chỉ Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:outline-none focus:border-amber-500 text-white"
              placeholder="Email của bạn..."
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:outline-none focus:border-amber-500 text-white"
              placeholder="Mật khẩu của bạn..."
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-gray-950 font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition duration-200"
          >
            {loading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-400">
          Chưa có tài khoản? <Link href="/register" className="text-amber-400 hover:underline">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}