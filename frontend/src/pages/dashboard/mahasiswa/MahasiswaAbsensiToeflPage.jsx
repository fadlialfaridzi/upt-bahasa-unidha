import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import QRCameraScanner from '../../../components/ui/QRCameraScanner.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';

const STATUS_PENDAFTARAN = {
  menunggu_pembayaran: { label: 'Menunggu Pembayaran', badge: 'badge-warning' },
  terverifikasi: { label: 'Terverifikasi', badge: 'badge-success' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const STATUS_SESI = {
  terbuka: { label: 'Pendaftaran dibuka', badge: 'badge-muted' },
  menunggu_override: { label: 'Menunggu persetujuan', badge: 'badge-warning' },
  ujian_dibuka: { label: 'Ujian dibuka', badge: 'badge-accent' },
  dijadwalkan: { label: 'Terjadwal', badge: 'badge-success' },
  selesai: { label: 'Selesai', badge: 'badge-muted' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const STATUS_KEHADIRAN = {
  hadir: { label: 'Hadir', badge: 'badge-success' },
  izin: { label: 'Izin', badge: 'badge-warning' },
  sakit: { label: 'Sakit', badge: 'badge-accent' },
  alpha: { label: 'Alpa', badge: 'badge-danger' },
  alpa: { label: 'Alpa', badge: 'badge-danger' },
};

const formatTanggal = (value) => {
  if (!value) return 'Belum ditentukan';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Belum ditentukan';
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
};

const formatJamSesi = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 5);
  return d.toISOString().slice(11, 16);
};

const formatJamWib = (iso) => (
  iso
    ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    : '-'
);

const formatWaktuLengkap = (iso) => (
  iso
    ? new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
    : '—'
);

const formatSisa = (detik) => {
  const aman = Math.max(0, Number(detik || 0));
  const jam = Math.floor(aman / 3600);
  const menit = Math.floor((aman % 3600) / 60);
  const sisa = aman % 60;
  const dd = String(sisa).padStart(2, '0');
  return jam ? `${jam}:${String(menit).padStart(2, '0')}:${dd}` : `${String(menit).padStart(2, '0')}:${dd}`;
};

const ekstrakTokenQr = (raw) => {
  let token = String(raw || '').trim();
  if (!token) return '';
  if (token.includes('token=')) {
    const param = token.split('token=')[1]?.split('&')[0] || '';
    try {
      token = decodeURIComponent(param).trim();
    } catch {
      token = param.trim();
    }
  }
  return token;
};

export default function MahasiswaAbsensiToeflPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const serverOffsetRef = useRef(0);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setErrorMsg('');
    }
    try {
      const res = await api.get('/toefl/absensi/saya');
      const list = res.data?.data || [];
      const sampleServerIso = list.find((row) => row.sesi?.waktu_server)?.sesi?.waktu_server;
      if (sampleServerIso) {
        const parsed = Date.parse(sampleServerIso);
        if (!Number.isNaN(parsed)) {
          serverOffsetRef.current = parsed - Date.now();
        }
      }
      setItems(list);
      setNowTick(Date.now());
      setErrorMsg('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memuat data absensi TOEFL Anda.';
      if (!silent) setErrorMsg(msg);
      toast.error(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const adaSesiDibuka = useMemo(
    () => items.some((row) => row.sesi?.sedang_dibuka && row.sesi?.waktu_tutup_presensi),
    [items],
  );

  // Perbarui countdown sisa waktu setiap detik saat ada sesi absensi yang dibuka
  useEffect(() => {
    if (!adaSesiDibuka) return undefined;
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [adaSesiDibuka]);

  const hitungSisaDetik = useCallback((sesi) => {
    if (!sesi?.sedang_dibuka || !sesi?.waktu_tutup_presensi) return 0;
    const batasMs = Date.parse(sesi.waktu_tutup_presensi);
    if (Number.isNaN(batasMs)) return 0;
    const serverNow = nowTick + serverOffsetRef.current;
    return Math.max(0, Math.ceil((batasMs - serverNow) / 1000));
  }, [nowTick]);

  const daftarTerverifikasi = useMemo(
    () => items.filter((row) => row.status_pendaftaran === 'terverifikasi'),
    [items],
  );

  const sesiTerverifikasiDibuka = useMemo(
    () => daftarTerverifikasi.filter((row) => hitungSisaDetik(row.sesi) > 0),
    [daftarTerverifikasi, hitungSisaDetik],
  );

  const handleScanFromCamera = async (decodedText) => {
    const token = ekstrakTokenQr(decodedText);
    setShowCamera(false);

    if (!token) {
      const msg = 'QR Code tidak berisi kode absensi yang valid.';
      setScanFeedback({ type: 'error', message: msg });
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    setScanFeedback(null);
    try {
      const res = await api.post('/toefl/absensi/scan', { token_qr: token });
      const hasil = res.data?.data || {};
      const message = res.data?.message || 'Presensi TOEFL berhasil dicatat sebagai hadir.';
      setScanFeedback({
        type: 'success',
        message,
        detail: hasil,
      });
      toast.success(message);
      await loadData({ silent: true });
    } catch (err) {
      const message = err.response?.data?.message || 'QR Code tidak valid atau absensi sesi TOEFL sudah ditutup.';
      setScanFeedback({
        type: 'error',
        message,
      });
      toast.error(message);
      await loadData({ silent: true });
    } finally {
      setSubmitting(false);
    }
  };

  const mulaiPindai = () => {
    if (submitting) return;
    setScanFeedback(null);
    setShowCamera(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Portal Peserta / Absensi TOEFL"
        title="Absensi Ujian TOEFL"
        subtitle="Pindai QR Code dari layar pengawas untuk mencatat kehadiran serta pantau status absensi sesi TOEFL Anda."
        action={
          <button type="button" className="btn btn-soft btn-sm" onClick={() => loadData()} disabled={loading || submitting}>
            <Icon name="refresh" size={15} /> Muat ulang
          </button>
        }
      />

      {/* Grid Atas: Panel Scan QR & Panduan Absensi TOEFL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '22px' }}>
        {/* Card Scan QR Absensi TOEFL */}
        <section
          style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid var(--line)',
            padding: '22px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'var(--brand-50, #f0fdf4)',
                color: 'var(--brand-800)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="qr" size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.08rem', color: 'var(--brand-900)' }}>Scan QR Absensi TOEFL</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Pindai menggunakan kamera HP atau ambil foto QR Code
              </span>
            </div>
          </div>

          {/* Feedback hasil scan */}
          {scanFeedback && (
            <div
              role={scanFeedback.type === 'error' ? 'alert' : 'status'}
              style={{
                marginBottom: '16px',
                padding: '12px 14px',
                borderRadius: '10px',
                border: `1px solid ${scanFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                background: scanFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                color: scanFeedback.type === 'success' ? '#166534' : '#991b1b',
                fontSize: '0.86rem',
                display: 'grid',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Icon
                  name={scanFeedback.type === 'success' ? 'checkCircle' : 'alert'}
                  size={18}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <div>
                  <strong style={{ display: 'block', marginBottom: 2 }}>
                    {scanFeedback.type === 'success' ? 'Absensi Berhasil Tercatat' : 'Absensi Gagal Diproses'}
                  </strong>
                  <span>{scanFeedback.message}</span>
                  {scanFeedback.type === 'success' && scanFeedback.detail?.nama_sesi && (
                    <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#15803d' }}>
                      <div><strong>Sesi:</strong> {scanFeedback.detail.nama_sesi}</div>
                      {scanFeedback.detail.tanggal && (
                        <div>
                          <strong>Jadwal:</strong> {formatTanggal(scanFeedback.detail.tanggal)} ·{' '}
                          {formatJamSesi(scanFeedback.detail.jam_mulai)}–{formatJamSesi(scanFeedback.detail.jam_selesai)} WIB
                        </div>
                      )}
                      {scanFeedback.detail.ruang && (
                        <div><strong>Ruangan:</strong> {scanFeedback.detail.ruang}</div>
                      )}
                      {scanFeedback.detail.waktu_presensi && (
                        <div><strong>Waktu presensi:</strong> {formatWaktuLengkap(scanFeedback.detail.waktu_presensi)} WIB</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {scanFeedback.type === 'error' && !showCamera && (
                <div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={mulaiPindai}
                    disabled={submitting}
                  >
                    <Icon name="refresh" size={14} /> Pindai ulang
                  </button>
                </div>
              )}
            </div>
          )}

          {showCamera ? (
            <QRCameraScanner
              onScan={handleScanFromCamera}
              onClose={() => setShowCamera(false)}
              showManualHint={false}
            />
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {!loading && daftarTerverifikasi.length === 0 && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '0.83rem',
                  }}
                >
                  Anda belum memiliki pendaftaran TOEFL yang <strong>terverifikasi</strong>. Pastikan pembayaran telah diverifikasi admin sebelum mengikuti ujian.
                </div>
              )}

              {!loading && sesiTerverifikasiDibuka.length > 0 && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    fontSize: '0.83rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span className="live-dot" aria-hidden="true" />
                  <span>
                    Absensi QR sedang dibuka untuk <strong>{sesiTerverifikasiDibuka[0].sesi?.nama_sesi}</strong>
                    {sesiTerverifikasiDibuka.length > 1 ? ` (+${sesiTerverifikasiDibuka.length - 1} sesi lainnya)` : ''}.
                  </span>
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                onClick={mulaiPindai}
                disabled={submitting || loading || daftarTerverifikasi.length === 0}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700,
                }}
              >
                <Icon name="camera" size={20} />
                <span>{submitting ? 'Memverifikasi QR...' : 'Pindai QR Absensi TOEFL'}</span>
              </button>

              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>
                Jika browser tidak mendukung kamera langsung, Anda dapat menggunakan tombol <strong>Ambil foto QR</strong> di dalam pemindai.
              </p>
            </div>
          )}
        </section>

        {/* Card Panduan Absensi TOEFL */}
        <section
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '12px',
            border: '1px solid var(--line)',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Icon name="graduation" size={20} style={{ color: 'var(--brand-700)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--brand-900)' }}>
                Ketentuan Absensi Ujian TOEFL
              </h3>
            </div>

            <ol style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '8px', fontSize: '0.84rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <li>Hanya peserta dengan status pendaftaran <strong>Terverifikasi</strong> yang dapat melakukan absensi pada sesi ujiannya.</li>
              <li>Absensi QR hanya aktif ketika pengawas / admin UPT Bahasa membuka absensi untuk sesi berstatus <strong>Terjadwal</strong>.</li>
              <li>Scan QR yang valid akan langsung mencatat status kehadiran Anda sebagai <strong>Hadir</strong> beserta waktu presensi.</li>
              <li>Jika mengalami kendala perangkat, segera hubungi pengawas ruangan agar kehadiran dicatat secara manual.</li>
            </ol>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Perlu mencetak kartu ujian atau mendaftar sesi baru?
            </span>
            <Link to="/dashboard/mahasiswa/toefl?mode=lanjut" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
              Buka Menu Tes TOEFL <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        </section>
      </div>

      {/* Daftar Sesi TOEFL Saya */}
      <section className="panel" style={{ padding: '20px' }}>
        <header className="panel-head" style={{ marginBottom: 14, alignItems: 'center' }}>
          <div>
            <h2 className="panel-title">Daftar TOEFL Saya</h2>
            <p className="panel-sub">
              {loading
                ? 'Memuat daftar sesi TOEFL...'
                : `${items.length} sesi TOEFL terdaftar · pantau jadwal, status absensi, dan kehadiran Anda`}
            </p>
          </div>
          {!loading && daftarTerverifikasi.length > 0 && (
            <span className="badge badge-success">{daftarTerverifikasi.length} terverifikasi</span>
          )}
        </header>

        <div className="panel-body">
          {loading ? (
            <p className="table-message">Memuat data absensi sesi TOEFL...</p>
          ) : errorMsg ? (
            <div className="table-message" role="alert">
              <p>{errorMsg}</p>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => loadData()}>
                <Icon name="refresh" size={15} /> Coba lagi
              </button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon="graduation"
              title="Belum ada sesi TOEFL terdaftar"
              text="Anda belum mendaftar pada sesi ujian TOEFL. Silakan daftar terlebih dahulu melalui menu Tes TOEFL."
              action={
                <Link to="/dashboard/mahasiswa/toefl" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  Daftar Tes TOEFL
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sesi TOEFL</th>
                    <th>Tanggal &amp; Jam</th>
                    <th>Ruangan</th>
                    <th>Pendaftaran</th>
                    <th>Status Absensi</th>
                    <th>Kehadiran Saya</th>
                    <th className="nowrap">Waktu Presensi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const sesi = item.sesi || {};
                    const daftarMeta = STATUS_PENDAFTARAN[item.status_pendaftaran] || {
                      label: item.status_pendaftaran || '-',
                      badge: 'badge-muted',
                    };
                    const sesiMeta = STATUS_SESI[sesi.status] || {
                      label: sesi.status || '-',
                      badge: 'badge-muted',
                    };
                    const sisaDetik = hitungSisaDetik(sesi);
                    const absensiDibuka = sesi.sedang_dibuka && sisaDetik > 0;
                    const absensiDitutup = sesi.status_presensi === 'ditutup'
                      || (sesi.status_presensi === 'dibuka' && sisaDetik === 0);

                    const hadirMeta = item.status_kehadiran
                      ? (STATUS_KEHADIRAN[item.status_kehadiran] || { label: item.status_kehadiran, badge: 'badge-muted' })
                      : { label: 'Belum tercatat', badge: 'badge-muted' };

                    return (
                      <tr key={item.id_pendaftaran}>
                        <td>
                          <p className="cell-title">{sesi.nama_sesi || 'Sesi TOEFL'}</p>
                          <span className={`badge ${sesiMeta.badge}`} style={{ fontSize: '0.7rem', marginTop: 4 }}>
                            {sesiMeta.label}
                          </span>
                        </td>
                        <td className="nowrap">
                          <p className="cell-title">{formatTanggal(sesi.tanggal)}</p>
                          <p className="cell-sub">
                            {formatJamSesi(sesi.jam_mulai)}–{formatJamSesi(sesi.jam_selesai)} WIB
                          </p>
                        </td>
                        <td>
                          <p>{sesi.ruang || 'Belum ditentukan'}</p>
                        </td>
                        <td className="nowrap">
                          <span className={`badge ${daftarMeta.badge}`}>{daftarMeta.label}</span>
                        </td>
                        <td className="nowrap">
                          {absensiDibuka ? (
                            <div style={{ display: 'grid', gap: '4px' }}>
                              <span className="badge badge-success">
                                <span className="live-dot" aria-hidden="true" /> Dibuka
                              </span>
                              <span className="cell-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                Sisa {formatSisa(sisaDetik)} (s.d. {formatJamWib(sesi.waktu_tutup_presensi)} WIB)
                              </span>
                            </div>
                          ) : absensiDitutup ? (
                            <span className="badge badge-muted">Ditutup</span>
                          ) : (
                            <span className="badge badge-muted">Belum dibuka</span>
                          )}
                        </td>
                        <td className="nowrap">
                          <span className={`badge ${hadirMeta.badge}`}>{hadirMeta.label}</span>
                        </td>
                        <td className="nowrap cell-sub">
                          {item.waktu_presensi ? `${formatWaktuLengkap(item.waktu_presensi)} WIB` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
