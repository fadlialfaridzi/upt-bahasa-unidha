import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/ui/Icon.jsx';

function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [form, setForm] = useState({
    nama_lengkap:  '',
    email:         '',
    password:      '',
    konfirmasi:    '',
    no_hp:         '',
    nim:           '',
    program_studi: '',
    tipe_pengguna: 'mahasiswa',
  });
  const [showPass, setShowPass]   = useState(false);
  const [showKonf, setShowKonf]   = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.konfirmasi) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password minimal 8 karakter');
      return;
    }

    setLoading(true);
    try {
      const { nama_lengkap, email, password, no_hp, nim, program_studi, tipe_pengguna } = form;
      await register({ nama_lengkap, email, password, no_hp, nim, program_studi, tipe_pengguna });
      toast.success('Registrasi berhasil! Silakan login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registrasi gagal. Coba lagi.');
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
          <p className="hero-eyebrow">Daftar akun baru</p>
          <h1>Mulai akses layanan UPT Bahasa hari ini.</h1>
          <p className="auth-aside-lead">
            Satu akun untuk mendaftar tes TOEFL, mengikuti pelatihan, dan mengajukan jasa penerjemahan dokumen.
          </p>
          <ul className="check-list">
            <li><Icon name="checkCircle" size={18} />Pendaftaran tes TOEFL online</li>
            <li><Icon name="checkCircle" size={18} />Kelas pelatihan TOEFL &amp; IELTS</li>
            <li><Icon name="checkCircle" size={18} />Jasa penerjemahan dokumen resmi</li>
          </ul>
        </div>

        <p className="auth-aside-foot">© {new Date().getFullYear()} UPT Bahasa · Universitas Dharma Andalas</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card" style={{ maxWidth: '480px' }}>
          <Link to="/login" className="back-link">
            <Icon name="arrowLeft" size={16} /> Sudah punya akun? Masuk
          </Link>

          <h2>Buat akun baru</h2>
          <p className="auth-card-sub">Isi data diri Anda. Semua layanan dapat diakses setelah akun aktif.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {/* Nama lengkap */}
            <div className="field">
              <label className="field-label" htmlFor="nama_lengkap">Nama Lengkap <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
              <div className="input-wrap">
                <Icon name="user" size={18} className="input-icon" />
                <input
                  id="nama_lengkap" name="nama_lengkap" type="text"
                  className="input" placeholder="Nama sesuai KTP / KTM"
                  value={form.nama_lengkap} onChange={handleChange} required
                />
              </div>
            </div>

            {/* Email */}
            <div className="field">
              <label className="field-label" htmlFor="email">Email <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
              <div className="input-wrap">
                <Icon name="mail" size={18} className="input-icon" />
                <input
                  id="email" name="email" type="email"
                  className="input" placeholder="nama@email.com"
                  autoComplete="email" value={form.email} onChange={handleChange} required
                />
              </div>
            </div>

            {/* No HP */}
            <div className="field">
              <label className="field-label" htmlFor="no_hp">No. HP / WhatsApp</label>
              <div className="input-wrap">
                <Icon name="phone" size={18} className="input-icon" />
                <input
                  id="no_hp" name="no_hp" type="tel"
                  className="input" placeholder="08xxxxxxxxxx"
                  value={form.no_hp} onChange={handleChange}
                />
              </div>
            </div>

            {/* Tipe Pengguna */}
            <div className="field">
              <label className="field-label" htmlFor="tipe_pengguna">Tipe Pengguna <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
              <div className="input-wrap">
                <Icon name="users" size={18} className="input-icon" />
                <select
                  id="tipe_pengguna" name="tipe_pengguna"
                  className="input" value={form.tipe_pengguna} onChange={handleChange}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="mahasiswa">Mahasiswa Unidha</option>
                  <option value="umum">Umum / Luar Kampus</option>
                  <option value="internal">Staf / Dosen Internal</option>
                </select>
              </div>
            </div>

            {/* NIM & Prodi — tampil hanya untuk mahasiswa */}
            {form.tipe_pengguna === 'mahasiswa' && (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="nim">NIM</label>
                  <div className="input-wrap">
                    <Icon name="hash" size={18} className="input-icon" />
                    <input
                      id="nim" name="nim" type="text"
                      className="input" placeholder="Nomor Induk Mahasiswa"
                      value={form.nim} onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="program_studi">Program Studi</label>
                  <div className="input-wrap">
                    <Icon name="book" size={18} className="input-icon" />
                    <input
                      id="program_studi" name="program_studi" type="text"
                      className="input" placeholder="mis. Sistem Informasi"
                      value={form.program_studi} onChange={handleChange}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Password */}
            <div className="field">
              <label className="field-label" htmlFor="password">Kata Sandi <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
              <div className="input-wrap">
                <Icon name="lock" size={18} className="input-icon" />
                <input
                  id="password" name="password"
                  type={showPass ? 'text' : 'password'}
                  className="input input-has-action" placeholder="Min. 8 karakter"
                  autoComplete="new-password" value={form.password} onChange={handleChange} required
                />
                <button type="button" className="input-action" onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Sembunyikan' : 'Tampilkan'}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            {/* Konfirmasi Password */}
            <div className="field">
              <label className="field-label" htmlFor="konfirmasi">Konfirmasi Kata Sandi <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
              <div className="input-wrap">
                <Icon name="lock" size={18} className="input-icon" />
                <input
                  id="konfirmasi" name="konfirmasi"
                  type={showKonf ? 'text' : 'password'}
                  className="input input-has-action" placeholder="Ulangi kata sandi"
                  autoComplete="new-password" value={form.konfirmasi} onChange={handleChange} required
                />
                <button type="button" className="input-action" onClick={() => setShowKonf((v) => !v)}
                  aria-label={showKonf ? 'Sembunyikan' : 'Tampilkan'}>
                  <Icon name={showKonf ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Memproses...' : 'Buat Akun'}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            Sudah punya akun? <Link to="/login">Masuk sekarang</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default RegisterPage;
