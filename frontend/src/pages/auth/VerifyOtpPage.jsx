import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/ui/Icon.jsx';

function VerifyOtpPage() {
  const { forgotPassword, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const email = sessionStorage.getItem('reset_email') || '';

  // 6 kotak OTP terpisah — input refs
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputs = useRef([]);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Redirect jika tidak ada email (akses langsung)
  useEffect(() => {
    if (!email) {
      toast.error('Sesi tidak valid. Mulai dari halaman lupa password.');
      navigate('/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  // Countdown resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Handle input per kotak
  const handleDigit = (idx, val) => {
    // Hanya angka
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[idx]   = digit;
    setDigits(next);
    // Fokus kotak berikutnya
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  // Handle paste seluruh kode
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const kode = digits.join('');
    if (kode.length < 6) {
      toast.error('Masukkan 6 digit kode OTP');
      return;
    }
    setLoading(true);
    try {
      const { reset_token } = await verifyOtp(email, kode);
      sessionStorage.setItem('reset_token', reset_token);
      sessionStorage.removeItem('reset_email');
      toast.success('OTP valid! Buat password baru.');
      navigate('/reset-password');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kode OTP tidak valid atau sudah kadaluarsa.');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await forgotPassword(email);
      toast.success('Kode OTP baru telah dikirim!');
      setDigits(['', '', '', '', '', '']);
      setCountdown(60);
      inputs.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim ulang OTP.');
    } finally {
      setResending(false);
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
          <p className="hero-eyebrow">Verifikasi OTP</p>
          <h1>Masukkan kode yang dikirim ke email Anda.</h1>
          <p className="auth-aside-lead">
            Kode OTP berlaku 10 menit. Jika tidak menerima, periksa folder <strong>spam</strong> atau minta kode baru.
          </p>
        </div>
        <p className="auth-aside-foot">© {new Date().getFullYear()} UPT Bahasa · Universitas Dharma Andalas</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Link to="/forgot-password" className="back-link">
            <Icon name="arrowLeft" size={16} /> Ganti email
          </Link>

          <h2>Verifikasi Kode OTP</h2>
          <p className="auth-card-sub">
            Kode 6 digit telah dikirim ke <strong>{email}</strong>
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {/* 6 kotak OTP */}
            <div
              style={{
                display: 'flex', gap: '10px', justifyContent: 'center',
                margin: '1.5rem 0',
              }}
              onPaste={handlePaste}
            >
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  style={{
                    width: '48px', height: '56px',
                    textAlign: 'center', fontSize: '1.5rem', fontWeight: '700',
                    border: `2px solid ${d ? 'var(--primary, #1e3a5f)' : '#cbd5e1'}`,
                    borderRadius: '10px', outline: 'none',
                    background: d ? '#f0f4ff' : '#fff',
                    transition: 'border-color .15s, background .15s',
                  }}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Memverifikasi...' : 'Verifikasi OTP'}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
          </form>

          <p className="auth-switch" style={{ marginTop: '1rem' }}>
            Tidak menerima kode?{' '}
            {countdown > 0 ? (
              <span style={{ color: '#94a3b8' }}>Kirim ulang dalam {countdown}d</span>
            ) : (
              <button
                type="button"
                className="link-btn"
                onClick={handleResend}
                disabled={resending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary, #1e3a5f)', fontWeight: '600', padding: 0 }}
              >
                {resending ? 'Mengirim...' : 'Kirim ulang OTP'}
              </button>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}

export default VerifyOtpPage;
