import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';

function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Login berhasil!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '2.5rem', width: '100%', maxWidth: '420px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', color: '#1e3a5f', marginBottom: '2rem' }}>Masuk</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Email</label>
            <input
              type="email" name="email" value={form.email} onChange={handleChange} required
              style={{ width: '100%', padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Password</label>
            <input
              type="password" name="password" value={form.password} onChange={handleChange} required
              style={{ width: '100%', padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem' }}
            />
          </div>
          <button
            type="submit" disabled={loading}
            style={{ background: '#1e3a5f', color: 'white', padding: '0.8rem', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#64748b' }}>
          Belum punya akun?{' '}
          <Link to="/register" style={{ color: '#1e3a5f', fontWeight: 'bold' }}>Daftar sekarang</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
