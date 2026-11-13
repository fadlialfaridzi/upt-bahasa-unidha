import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardPathFor } from '../../config/roles.js';
import Icon from '../../components/ui/Icon.jsx';

// SEMENTARA: shortcut akun demo (lihat backend/prisma/seed.js). Hanya tampil saat development.
const SHOW_DEMO = import.meta.env.DEV;
const DEMO_ACCOUNTS = [
  { key: 'superadmin', label: 'Super Admin', icon: 'shield', email: 'superadmin@uptbahasa.ac.id' },
  { key: 'admin', label: 'Admin UPT', icon: 'grid', email: 'admin@uptbahasa.ac.id' },
  { key: 'dosen', label: 'Dosen', icon: 'graduation', email: 'dosen@uptbahasa.ac.id' },
  { key: 'mahasiswa', label: 'Mahasiswa', icon: 'user', email: 'mahasiswa@uptbahasa.ac.id' },
];
const DEMO_PASSWORD = 'password123';

function LoginPage() {
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!authLoading && user) return <Navigate to={dashboardPathFor(user.role)} replace />;

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setSelectedDemo(null);
  };

  const fillDemo = (akun) => {
    setForm({ email: akun.email, password: DEMO_PASSWORD });
    setSelectedDemo(akun.key);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      toast.success(`Selamat datang, ${data.nama_lengkap}!`);
      navigate(dashboardPathFor(data.role), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal masuk. Periksa koneksi ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="brand" aria-label="UPT Bahasa Unidha - Beranda">
          <span className="logo-mark">u.</span>
          <span className="brand-text">
            <strong>UPT Bahasa Unidha</strong>
            <small>Universitas Dharma Andalas</small>
          </span>
        </Link>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className="hero-eyebrow">Portal layanan terpusat</p>
          <h1>Satu akun untuk seluruh layanan UPT Bahasa.</h1>
          <p className="auth-aside-lead">
            Mahasiswa, dosen, dan staf UPT masuk dari halaman yang sama. Dashboard menyesuaikan peran Anda.
          </p>
          <ul className="check-list">
            <li><Icon name="checkCircle" size={18} />Pendaftaran tes TOEFL & kelas pelatihan</li>
            <li><Icon name="checkCircle" size={18} />Presensi QR dan peringatan dini kehadiran</li>
            <li><Icon name="checkCircle" size={18} />Penerjemahan dokumen dengan estimasi biaya</li>
          </ul>
        </div>

        <p className="auth-aside-foot">© {new Date().getFullYear()} UPT Bahasa · Universitas Dharma Andalas</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Link to="/" className="back-link">
            <Icon name="arrowLeft" size={16} /> Kembali ke beranda
          </Link>

          <h2>Masuk ke portal</h2>
          <p className="auth-card-sub">Gunakan email dan kata sandi akun Anda.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="email">Email</label>
              <div className="input-wrap">
                <Icon name="mail" size={18} className="input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="nama@email.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">Kata sandi</label>
              <div className="input-wrap">
                <Icon name="lock" size={18} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input input-has-action"
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--primary, #1e3a5f)' }}>
                Lupa kata sandi?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            Belum punya akun? <Link to="/register">Daftar sekarang</Link>
          </p>

          {SHOW_DEMO && (
            <section className="demo-box" aria-label="Akun demo">
              <div className="demo-box-head">
                <strong>Isi otomatis akun demo</strong>
                <span className="badge badge-warning">Sementara</span>
              </div>
              <div className="demo-grid">
                {DEMO_ACCOUNTS.map((akun) => (
                  <button
                    key={akun.key}
                    type="button"
                    className={`demo-btn ${selectedDemo === akun.key ? 'selected' : ''}`}
                    onClick={() => fillDemo(akun)}
                    aria-pressed={selectedDemo === akun.key}
                  >
                    <span className="icon-tile"><Icon name={akun.icon} size={16} /></span>
                    <span>
                      <strong>{akun.label}</strong>
                      <small>{akun.email}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="demo-note">Kata sandi semua akun demo: <code>{DEMO_PASSWORD}</code>. Hanya tampil di mode development.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
