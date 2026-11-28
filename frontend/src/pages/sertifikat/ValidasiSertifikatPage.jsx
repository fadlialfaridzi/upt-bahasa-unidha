import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api.js';
import Icon from '../../components/ui/Icon.jsx';
import QRCameraScanner from '../../components/ui/QRCameraScanner.jsx';

const MIN_INPUT_LEN = 3;
const MAX_INPUT_LEN = 512;

const STATUS_META = {
  valid: {
    badge: 'Terdaftar & Valid',
    badgeClass: 'badge-success',
    title: 'Sertifikat Valid',
    icon: 'checkCircle',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    accent: '#166534',
    subColor: '#15803d',
  },
  dicabut: {
    badge: 'Dicabut',
    badgeClass: 'badge-danger',
    title: 'Sertifikat Telah Dicabut',
    icon: 'alert',
    bg: '#fef2f2',
    border: '#fecaca',
    accent: '#991b1b',
    subColor: '#b91c1c',
  },
  kedaluwarsa: {
    badge: 'Kedaluwarsa',
    badgeClass: 'badge-warning',
    title: 'Sertifikat Kedaluwarsa',
    icon: 'history',
    bg: '#fffbeb',
    border: '#fde68a',
    accent: '#92400e',
    subColor: '#b45309',
  },
  tidak_ditemukan: {
    badge: 'Tidak Ditemukan',
    badgeClass: 'badge-danger',
    title: 'Sertifikat Tidak Valid / Tidak Ditemukan',
    icon: 'alert',
    bg: '#fef2f2',
    border: '#fecaca',
    accent: '#991b1b',
    subColor: '#b91c1c',
  },
};

const formatTanggalTerbit = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(d);
};

const formatTanggalBerlaku = (value) => {
  if (!value) return 'Berlaku selamanya';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
};

const ekstrakInputQr = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      for (const key of ['kode_verifikasi', 'kode', 'no_sertifikat', 'q']) {
        const val = parsed.searchParams.get(key);
        if (val && val.trim()) return val.trim();
      }
      const matchPath = parsed.pathname.match(/\/validasi-sertifikat\/([^/]+)\/?$/i);
      if (matchPath?.[1]) {
        return decodeURIComponent(matchPath[1]).trim();
      }
    } catch {
      // Gunakan nilai trimmed apa adanya jika bukan URL valid
    }
  }
  return trimmed;
};

function ValidasiSertifikatPage() {
  const { kode: pathKode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQueryKode = pathKode
    || searchParams.get('kode')
    || searchParams.get('kode_verifikasi')
    || searchParams.get('no_sertifikat')
    || searchParams.get('q')
    || '';

  const [kode, setKode] = useState(initialQueryKode);
  const [loading, setLoading] = useState(false);
  const [inputError, setInputError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [hasil, setHasil] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const lastAutoValidatedRef = useRef('');

  const jalankanValidasi = useCallback(async (rawValue) => {
    const cleaned = ekstrakInputQr(rawValue);

    if (!cleaned) {
      setInputError('Nomor sertifikat atau kode verifikasi wajib diisi.');
      setRequestError('');
      setHasil(null);
      return;
    }

    if (cleaned.length < MIN_INPUT_LEN) {
      setInputError(`Nomor sertifikat atau kode verifikasi minimal ${MIN_INPUT_LEN} karakter.`);
      setRequestError('');
      setHasil(null);
      return;
    }

    if (cleaned.length > MAX_INPUT_LEN) {
      setInputError('Input terlalu panjang. Periksa kembali nomor sertifikat atau kode verifikasi.');
      setRequestError('');
      setHasil(null);
      return;
    }

    setInputError('');
    setRequestError('');
    setLoading(true);
    setShowScanner(false);

    try {
      const res = await api.get('/sertifikat/validasi', {
        params: { kode: cleaned },
      });
      setHasil(res.data);
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;

      if (status === 404 && body?.status === 'tidak_ditemukan') {
        setHasil({
          valid: false,
          status: 'tidak_ditemukan',
          message: body.message || 'Sertifikat tidak ditemukan atau tidak valid.',
          data: null,
        });
      } else if (status === 400 && body?.message) {
        setInputError(body.message);
        setHasil(null);
      } else {
        setRequestError(
          body?.message || 'Tidak dapat terhubung ke server validasi. Silakan coba beberapa saat lagi.',
        );
        setHasil(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Validasi otomatis jika halaman dibuka langsung dengan parameter URL / QR link
  useEffect(() => {
    const target = initialQueryKode.trim();
    if (!target || lastAutoValidatedRef.current === target) return;
    lastAutoValidatedRef.current = target;
    setKode(target);
    jalankanValidasi(target);
  }, [initialQueryKode, jalankanValidasi]);

  const handleSubmit = (e) => {
    e.preventDefault();
    jalankanValidasi(kode);
  };

  const handleScanQr = (decodedText) => {
    const extracted = ekstrakInputQr(decodedText);
    setShowScanner(false);
    setKode(extracted);
    jalankanValidasi(extracted);
  };

  const handleReset = () => {
    setKode('');
    setInputError('');
    setRequestError('');
    setHasil(null);
    setShowScanner(false);
    lastAutoValidatedRef.current = '';
    if (pathKode) {
      navigate('/validasi-sertifikat', { replace: true });
    } else if (searchParams.toString()) {
      setSearchParams({}, { replace: true });
    }
  };

  const statusMeta = hasil ? (STATUS_META[hasil.status] || STATUS_META.tidak_ditemukan) : null;
  const cert = hasil?.data || null;
  const hasAnyState = Boolean(kode || inputError || requestError || hasil || showScanner);

  return (
    <div className="container" style={{ maxWidth: '880px', paddingTop: '28px', paddingBottom: '56px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="arrowLeft" size={16} /> Kembali ke Beranda
        </Link>
      </div>

      {/* Header Publik */}
      <section
        className="hero"
        style={{
          borderRadius: 'var(--radius-xl)',
          padding: '32px 32px',
          marginBottom: '24px',
        }}
      >
        <p className="hero-eyebrow" style={{ marginBottom: '8px' }}>
          UPT Bahasa · Universitas Dharma Andalas
        </p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', margin: '0 0 10px', lineHeight: 1.2 }}>
          Validasi Keaslian Sertifikat
        </h1>
        <p style={{ margin: 0, maxWidth: '640px', opacity: 0.92, fontSize: '0.96rem', lineHeight: 1.55 }}>
          Periksa keaslian sertifikat resmi TOEFL maupun Pelatihan Bahasa terbitan UPT Bahasa UNIDHA
          menggunakan nomor sertifikat atau kode verifikasi dari QR Code tanpa perlu login.
        </p>
      </section>

      {/* Card Formulir Validasi */}
      <section className="card" style={{ padding: '26px 28px', marginBottom: '20px' }}>
        <form onSubmit={handleSubmit} noValidate>
          <label
            htmlFor="input-validasi-sertifikat"
            className="field-label"
            style={{ display: 'block', marginBottom: '8px', fontSize: '0.92rem' }}
          >
            Nomor Sertifikat atau Kode Verifikasi QR
          </label>

          <div className="verify-form" style={{ alignItems: 'stretch' }}>
            <div className="input-wrap" style={{ flex: 1 }}>
              <Icon name="search" size={18} className="input-icon" />
              <input
                id="input-validasi-sertifikat"
                type="text"
                className="input"
                value={kode}
                onChange={(e) => {
                  setKode(e.target.value);
                  if (inputError) setInputError('');
                }}
                placeholder="Contoh: 001/UPT-BHS/TOEFL/2026 atau kode verifikasi QR"
                aria-label="Nomor sertifikat atau kode verifikasi"
                aria-invalid={Boolean(inputError)}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Icon name="shield" size={17} />
              <span>{loading ? 'Memvalidasi...' : 'Validasi Sertifikat'}</span>
            </button>
          </div>

          {inputError && (
            <p className="field-error" role="alert" style={{ marginTop: '8px', marginBottom: 0 }}>
              {inputError}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '14px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowScanner((v) => !v)}
                disabled={loading}
              >
                <Icon name={showScanner ? 'x' : 'camera'} size={15} />
                <span>{showScanner ? 'Tutup Pemindai QR' : 'Pindai QR Code'}</span>
              </button>

              {hasAnyState && (
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={handleReset}
                  disabled={loading}
                >
                  <Icon name="refresh" size={15} />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Dapat diakses publik tanpa akun · mendukung input manual &amp; pemindaian QR
            </span>
          </div>
        </form>

        {/* Pemindai QR opsional (memakai komponen existing QRCameraScanner) */}
        {showScanner && (
          <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--line)' }}>
            <QRCameraScanner
              onScan={handleScanQr}
              onClose={() => setShowScanner(false)}
              showManualHint
            />
          </div>
        )}
      </section>

      {/* Loading state */}
      {loading && (
        <section
          className="card"
          role="status"
          aria-live="polite"
          style={{
            padding: '28px',
            textAlign: 'center',
            color: 'var(--muted)',
            marginBottom: '20px',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500 }}>
            Memeriksa keaslian sertifikat pada database resmi UPT Bahasa UNIDHA...
          </p>
        </section>
      )}

      {/* Error jaringan / server */}
      {!loading && requestError && (
        <div className="alert alert-danger" role="alert" style={{ marginBottom: '20px' }}>
          <Icon name="alert" size={20} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Gagal Memproses Validasi</strong>
            <p style={{ margin: '0 0 10px' }}>{requestError}</p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => jalankanValidasi(kode)}
            >
              <Icon name="refresh" size={14} /> Coba Lagi
            </button>
          </div>
        </div>
      )}

      {/* Hasil Validasi */}
      {!loading && hasil && statusMeta && (
        <section
          className="card"
          role={hasil.valid ? 'status' : 'alert'}
          aria-live="polite"
          style={{
            overflow: 'hidden',
            borderColor: statusMeta.border,
            marginBottom: '20px',
          }}
        >
          {/* Banner Status */}
          <div
            style={{
              background: statusMeta.bg,
              borderBottom: `1px solid ${statusMeta.border}`,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: '1 1 280px' }}>
              <span
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fff',
                  border: `1px solid ${statusMeta.border}`,
                  color: statusMeta.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name={statusMeta.icon} size={22} />
              </span>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '1.18rem', color: statusMeta.accent }}>
                  {statusMeta.title}
                </h2>
                <p style={{ margin: 0, fontSize: '0.9rem', color: statusMeta.subColor, lineHeight: 1.5 }}>
                  {hasil.message}
                </p>
              </div>
            </div>

            <span className={`badge ${statusMeta.badgeClass}`} style={{ fontWeight: 700 }}>
              {statusMeta.badge}
            </span>
          </div>

          {/* Detail Sertifikat jika ditemukan (valid / dicabut / kedaluwarsa) */}
          {cert ? (
            <div style={{ padding: '22px 24px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px 24px',
                }}
              >
                <DetailField label="Nomor Sertifikat" value={cert.no_sertifikat || '—'} highlight />
                <DetailField label="Nama Pemilik" value={cert.nama_pemilik || '—'} highlight />
                <DetailField label="Jenis Layanan" value={cert.jenis_layanan || '—'} />
                <DetailField label="Program" value={cert.program || '—'} />
                <DetailField label="Hasil Ringkas" value={cert.hasil_ringkas || '—'} />
                <DetailField label="Tanggal Terbit" value={formatTanggalTerbit(cert.tanggal_terbit)} />
                <DetailField
                  label="Masa Berlaku"
                  value={formatTanggalBerlaku(cert.berlaku_sampai)}
                  danger={hasil.status === 'kedaluwarsa'}
                />
                <DetailField
                  label="Status Sertifikat"
                  value={cert.status_sertifikat === 'dicabut' ? 'Dicabut' : 'Aktif'}
                  danger={cert.status_sertifikat === 'dicabut'}
                />
              </div>

              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  fontSize: '0.8rem',
                  color: 'var(--muted)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="award" size={15} />
                  Data diverifikasi langsung dari basis data resmi UPT Bahasa UNIDHA.
                </span>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleReset}>
                  Periksa Sertifikat Lain
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px 24px', fontSize: '0.88rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 10px' }}>
                Pastikan nomor sertifikat atau kode verifikasi yang dimasukkan sudah sesuai dengan dokumen asli:
              </p>
              <ul style={{ margin: '0 0 16px', paddingLeft: '20px' }}>
                <li>Periksa kembali huruf, angka, dan tanda garis miring (<code>/</code>) pada nomor sertifikat.</li>
                <li>Jika menggunakan QR Code, pastikan pemindaian dilakukan dalam pencahayaan yang cukup.</li>
                <li>Jika sertifikat seharusnya terdaftar, silakan hubungi UPT Bahasa Universitas Dharma Andalas.</li>
              </ul>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleReset}>
                <Icon name="refresh" size={14} /> Coba Periksa Ulang
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function DetailField({ label, value, highlight = false, danger = false }) {
  return (
    <div style={{ display: 'grid', gap: '4px' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </span>
      <strong
        style={{
          fontSize: highlight ? '1rem' : '0.94rem',
          fontWeight: highlight ? 700 : 600,
          color: danger ? '#b91c1c' : 'var(--brand-900)',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export default ValidasiSertifikatPage;
