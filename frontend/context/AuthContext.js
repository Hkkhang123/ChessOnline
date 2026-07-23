'use client';

import { createContext, useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Kiểm tra xem đã có token lưu trong localStorage chưa
    const savedToken = localStorage.getItem('chess_token');
    const savedUser = localStorage.getItem('chess_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('chess_token', accessToken);
    localStorage.setItem('chess_user', JSON.stringify(userData));
    router.push('/'); // Đăng nhập xong đẩy về trang chủ sảnh chờ
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);