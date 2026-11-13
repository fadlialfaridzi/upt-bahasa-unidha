import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/ui/Icon.jsx';

function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate          = useNavigate();

  const resetToken = sessionStorage.getItem('reset_token') || '';

  const [form, setForm] = useState({ password_baru: '', konfirmasi: '' });
  const [show, setShow] = useState({ baru: false, konf: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resetToken) {
      toast.error('Sesi tidak valid. Mulai dari halaman lupa password.');
      navigate('/forgot-password', { replace: true });
    }
  }, [resetToken, navigate]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const strength = (() => {
    const p = form.password_baru;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Lemah', 'Cukup', 'Baik', 'Kuat'][strength];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password_baru !== form.konfirmasi) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    if (form.password_baru.length < 8) {
      toast.error('Password minimal 8 karakter');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(resetToken, form.password_baru);
      sessionStorage.removeItem('reset_token');
      toast.success('Password berhasil diubah! Silakan login.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mereset password. Ulangi proses dari awal.');
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
          <p className="hero-eyebrow">Buat password baru</p>
          <h1>Hampir selesai! Buat kata sandi yang kuat.</h1>
          <p className="auth-aside-lead">
            Password yang kuat mengandung huruf besar, angka, dan karakter khusus.
          </p>
          <ul className="check-list">
            <li><Icon name="checkCircle" size={18} />Minimal 8 karakter</li>
            <li><Icon name="checkCircle" size={18} />Kombinasi huruf &amp; angka</li>
            <li><Icon name="checkCircle" size={18} />Tambah karakter khusus untuk keamanan ekstra</li>
          </ul>
        </div>
        <p className="auth-aside-foot">© {new Date().getFullYear()} UPT Bahasa · Universitas Dharma Andalas</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Link to="/login" className="back-link">
            <Icon name="arrowLeft" size={16} /> Kembali ke login
          </Link>

          <h2>Buat Kata Sandi Baru</h2>
          <p className="auth-card-sub">Kata sandi baru harus berbeda dari yang lama.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {/* Password baru */}
            <div className="field">
              <label className="field-label" htmlFor="password_baru">Kata Sandi Baru</label>
              <div className="input-wrap">
                <Icon name="lock" size={18} className="input-icon" />
                <input
                  id="password_baru" name="password_baru"
                  type={show.baru ? 'text' : 'password'}
                  className="input input-has-action" placeholder="Min. 8 karakter"
                  autoComplete="new-password" value={form.password_baru}
                  onChange={handleChange} required
                />
                <button type="button" className="input-action"
                  onClick={() => setShow((s) => ({ ...s, baru: !s.baru }))}>
                  <Icon name={show.baru ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              {/* Strength bar */}
              {form.password_baru && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} style={{
                        flex: 1, height: '4px', borderRadius: '2px',
                        background: n <= strength ? strengthColor : '#e2e8f0',
                        transition: 'background .2s',
                      }} />
                    ))}
                  </div>
                  <small style={{ color: strengthColor, fontWeight: '600' }}>{strengthLabel}</small>
                </div>
              )}
            </div>

            {/* Konfirmasi */}
            <div className="field">
              <label className="field-label" htmlFor="konfirmasi">Konfirmasi Kata Sandi</label>
              <div className="input-wrap">
                <Icon name="lock" size={18} className="input-icon" />
                <input
                  id="konfirmasi" name="konfirmasi"
                  type={show.konf ? 'text' : 'password'}
                  className="input input-has-action" placeholder="Ulangi kata sandi"
                  autoComplete="new-password" value={form.konfirmasi}
                  onChange={handleChange} required
                />
                <button type="button" className="input-action"
                  onClick={() => setShow((s) => ({ ...s, konf: !s.konf }))}>
                  <Icon name={show.konf ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              {/* Match indicator */}
              {form.konfirmasi && (
                <small style={{
                  color: form.password_baru === form.konfirmasi ? '#22c55e' : '#ef4444',
                  fontWeight: '600', marginTop: '4px', display: 'block',
                }}>
                  {form.password_baru === form.konfirmasi ? '✓ Password cocok' : '✗ Password tidak cocok'}
                </small>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default ResetPasswordPage;
