import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Bootstrap: cek token tersimpan ─────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/profile')
        .then((res) => setUser(res.data.data))
        .catch(() => {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ─── Simpan token ke storage + axios header ──────────────────────────────
  const saveToken = useCallback((token) => {
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  // ─── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, data } = res.data;
    saveToken(token);
    setUser(data);
    return data;
  }, [saveToken]);

  // ─── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (formData) => {
    const res = await api.post('/auth/register', formData);
    return res.data;
  }, []);

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);

  // ─── Lupa password: kirim OTP ────────────────────────────────────────────
  const forgotPassword = useCallback(async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  }, []);

  // ─── Verifikasi OTP ───────────────────────────────────────────────────────
  const verifyOtp = useCallback(async (email, kode) => {
    const res = await api.post('/auth/verify-otp', { email, kode });
    return res.data; // { message, reset_token }
  }, []);

  // ─── Reset password ───────────────────────────────────────────────────────
  const resetPassword = useCallback(async (reset_token, password_baru) => {
    const res = await api.post('/auth/reset-password', { reset_token, password_baru });
    return res.data;
  }, []);

  // ─── Switch Role ──────────────────────────────────────────────────────────
  const switchRole = useCallback(async (target_role) => {
    const res = await api.post('/auth/switch-role', { target_role });
    const { token, data } = res.data;
    saveToken(token);
    setUser(data);
    return data;
  }, [saveToken]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      forgotPassword,
      verifyOtp,
      resetPassword,
      switchRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
