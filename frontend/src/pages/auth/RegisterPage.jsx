import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';

function RegisterPage() {
  const [form, setForm] = useState({ nama: '', email: '', password: '', noHp: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form.nama, form.email, form.password, form.noHp);
      toast.success('Registrasi berhasil! Silakan login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '2.5rem', width: '100%', maxWidth: '420px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', color: '#1e3a5f', marginBottom: '2rem' }}>Daftar Akun</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { label: 'Nama Lengkap', name: 'nama', type: 'text' },
            { label: 'Email', name: 'email', type: 'email' },
            { label: 'No. HP', name: 'noHp', type: 'tel' },
            { label: 'Password', name: 'password', type: 'password' },
          ].map(({ label, name, type }) => (
            <div key={name}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>{label}</label>
              <input
                type={type} name={name} value={form[name]} onChange={handleChange}
                required={name !== 'noHp'}
                style={{ width: '100%', padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem' }}
              />
            </div>
          ))}
          <button
            type="submit" disabled={loading}
            style={{ background: '#1e3a5f', color: 'white', padding: '0.8rem', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            {loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#64748b' }}>
          Sudah punya akun?{' '}
          <Link to="/login" style={{ color: '#1e3a5f', fontWeight: 'bold' }}>Masuk</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
