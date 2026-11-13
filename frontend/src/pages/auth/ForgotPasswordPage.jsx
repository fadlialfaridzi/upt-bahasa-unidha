import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/ui/Icon.jsx';

function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const navigate           = useNavigate();
  const [email, setEmail]  = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      toast.success('Kode OTP telah dikirim ke email Anda. Cek inbox / spam.');
      // Simpan email ke sessionStorage supaya halaman OTP tahu
      sessionStorage.setItem('reset_email', email);
      navigate('/verify-otp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim OTP. Coba lagi.');
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
          <p className="hero-eyebrow">Reset kata sandi</p>
          <h1>Lupa kata sandi? Tenang, kami bantu.</h1>
          <p className="auth-aside-lead">
            Masukkan email terdaftar Anda. Kami akan mengirimkan kode OTP untuk memverifikasi identitas Anda.
          </p>
          <ul className="check-list">
            <li><Icon name="checkCircle" size={18} />Kode OTP berlaku 10 menit</li>
            <li><Icon name="checkCircle" size={18} />Cek folder spam jika tidak masuk</li>
            <li><Icon name="checkCircle" size={18} />Setelah verifikasi, buat password baru</li>
          </ul>
        </div>
        <p className="auth-aside-foot">© {new Date().getFullYear()} UPT Bahasa · Universitas Dharma Andalas</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Link to="/login" className="back-link">
            <Icon name="arrowLeft" size={16} /> Kembali ke login
          </Link>

          <h2>Lupa Kata Sandi</h2>
          <p className="auth-card-sub">
            Masukkan email akun Anda. Kami akan mengirim kode OTP 6 digit ke email tersebut.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="email">Email Terdaftar</label>
              <div className="input-wrap">
                <Icon name="mail" size={18} className="input-icon" />
                <input
                  id="email" type="email"
                  className="input" placeholder="nama@email.com"
                  autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Mengirim OTP...' : 'Kirim Kode OTP'}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            Ingat kata sandi? <Link to="/login">Masuk sekarang</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default ForgotPasswordPage;
