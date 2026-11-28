import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import QRCameraScanner from '../../../components/ui/QRCameraScanner.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { formatTanggal, STATUS_PRESENSI, STATUS_WAKTU } from '../../../config/pelatihan.js';

export default function MahasiswaPresensiEwsPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kelasEws, setKelasEws] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/pelatihan/my-presensi-ews');
      const data = res.data.data || [];
      setKelasEws(data);
      if (data.length > 0 && !selectedKelasId) {
        setSelectedKelasId(data[0].id_kelas);
      }
    } catch {
      toast.error('Gagal memuat data presensi dan status EWS');
    } finally {
      setLoading(false);
    }
  }, [selectedKelasId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler Kirim Presensi Token Manual
  const handleSubmitToken = async (e) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      toast.warning('Silakan masukkan kode token presensi');
      return;
    }

    setSubmittingToken(true);
    try {
      const res = await api.post('/pelatihan/presensi/scan', { token_qr: cleanToken });
      toast.success(res.data.message || 'Presensi berhasil dicatat! Kehadiran Anda telah terverifikasi.');
      setTokenInput('');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kode presensi tidak valid atau sesi presensi telah ditutup.');
    } finally {
      setSubmittingToken(false);
    }
  };

  // Handler Kirim Presensi dari Scan Kamera Handphone
  const handleScanFromCamera = async (decodedText) => {
    let token = (decodedText || '').trim();
    if (token.includes('token=')) {
      token = token.split('token=')[1].split('&')[0];
    }
    setShowCamera(false);
    setSubmittingToken(true);
    try {
      const res = await api.post('/pelatihan/presensi/scan', { token_qr: token });
      toast.success(res.data.message || 'Presensi berhasil dicatat via kamera HP! Kehadiran Anda terverifikasi.');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kode QR tidak valid atau sesi presensi telah ditutup.');
    } finally {
      setSubmittingToken(false);
    }
  };

  // QR dosen berisi tautan ke halaman ini (?token=...). Bila dibuka dari kamera HP biasa,
  // kirim presensi otomatis sekali lalu hapus token dari URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const tokenUrl = searchParams.get('token');
  const tokenTerkirim = useRef(null);
  useEffect(() => {
    if (!tokenUrl || tokenTerkirim.current === tokenUrl) return;
    tokenTerkirim.current = tokenUrl;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('token');
      return next;
    }, { replace: true });
    handleScanFromCamera(tokenUrl);
  }, [tokenUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedKelas = kelasEws.find((k) => k.id_kelas === selectedKelasId) || kelasEws[0];

  return (
    <>
      <PageHeader
        eyebrow="Portal Peserta / Presensi & EWS"
        title="Presensi & Early Warning System (EWS)"
        subtitle="Input token presensi kelas yang sedang berlangsung serta pantau indikator kehadiran Anda."
      />

      {/* Grid Atas: Formulir Input Presensi & Info Ketentuan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Card Input Presensi */}
        <div
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--brand-900)' }}>Pengambilan Absen</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Scan QR dari kamera HP atau masukkan token</span>
            </div>
          </div>

          {showCamera ? (
            <QRCameraScanner
              onScan={handleScanFromCamera}
              onClose={() => setShowCamera(false)}
            />
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Tombol Utama: Buka Kamera HP */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCamera(true)}
                disabled={submittingToken}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(22, 101, 52, 0.2)',
                }}
              >
                <Icon name="camera" size={20} />
                <span>Pindai QR dengan Kamera HP</span>
              </button>

              {/* Garis Pembatas */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--muted)',
                  fontSize: '0.78rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
                <span style={{ padding: '0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Atau Input PIN Manual
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
              </div>

              {/* Form Input PIN Manual */}
              <form onSubmit={handleSubmitToken} style={{ display: 'grid', gap: '10px' }}>
                <input
                  type="text"
                  className="input input-plain"
                  placeholder="Contoh: UPT-QR-12-839201"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '1.05rem',
                    letterSpacing: '1px',
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                  disabled={submittingToken}
                />

                <button
                  type="submit"
                  className="btn btn-outline"
                  disabled={submittingToken}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                  }}
                >
                  <Icon name="check" size={16} />
                  <span>{submittingToken ? 'Memvalidasi...' : 'Kirim Token Presensi'}</span>
                </button>
              </form>
            </div>
          )}

          <p style={{ margin: '14px 0 0', fontSize: '0.76rem', color: 'var(--muted)', textAlign: 'center' }}>
            Sesi presensi hanya dapat dipindai saat dosen membuka pertemuan kelas aktif.
          </p>
        </div>

        {/* Card Info Ketentuan EWS */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '12px',
            border: '1px solid var(--line)',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Icon name="alert" size={20} style={{ color: '#d97706' }} />
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--brand-900)' }}>
                Standar Early Warning System (EWS)
              </h4>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 12px' }}>
              Berdasarkan kebijakan akademik UPT Bahasa UNIDHA, setiap peserta pelatihan wajib mencapai ambang kehadiran minimum:
            </p>

            <div style={{ display: 'grid', gap: '8px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-success" style={{ minWidth: '70px', textAlign: 'center' }}>≥ 75%</span>
                <span><strong>Status Aman:</strong> Berhak mengikuti ujian akhir & memperoleh sertifikat.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-danger" style={{ minWidth: '70px', textAlign: 'center' }}>&lt; 75%</span>
                <span><strong>Peringatan EWS:</strong> Berisiko tidak lulus dan sertifikat tidak dapat diterbitkan.</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '12px', fontSize: '0.76rem', color: 'var(--muted)' }}>
            💡 Pastikan selalu mengisi presensi tepat waktu di setiap pertemuan perkuliahan.
          </div>
        </div>
      </div>

      {/* Bagian Bawah: Rekap Presensi & EWS Per Kelas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
          <p>Memuat rekap kehadiran...</p>
        </div>
      ) : kelasEws.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon="graduation"
            title="Belum ada kelas aktif"
            text="Anda belum terdaftar di kelas pelatihan yang terverifikasi. Silakan mendaftar kelas terlebih dahulu di menu Kelas Pelatihan."
          />
        </section>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Tab Pemilihan Kelas jika lebih dari 1 kelas */}
          {kelasEws.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {kelasEws.map((k) => (
                <button
                  key={k.id_kelas}
                  type="button"
                  onClick={() => setSelectedKelasId(k.id_kelas)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: k.id_kelas === selectedKelas?.id_kelas ? '2px solid var(--brand-700)' : '1px solid var(--line)',
                    background: k.id_kelas === selectedKelas?.id_kelas ? '#fff' : '#f8fafc',
                    color: k.id_kelas === selectedKelas?.id_kelas ? 'var(--brand-900)' : 'var(--ink-2)',
                    fontWeight: k.id_kelas === selectedKelas?.id_kelas ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {k.nama_kelas}
                </button>
              ))}
            </div>
          )}

          {selectedKelas && (
            <section
              style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid var(--line)',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {/* Header Kelas & Kartu EWS */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '16px',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: '18px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem', color: 'var(--brand-900)', fontWeight: 700 }}>
                    {selectedKelas.nama_kelas}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Total {selectedKelas.total_pertemuan} Pertemuan Perkuliahan
                  </p>
                </div>

                {/* EWS Status Badge & Summary */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block' }}>Tingkat Kehadiran</span>
                    <strong style={{ fontSize: '1.4rem', color: selectedKelas.status_ews === 'peringatan' ? '#dc2626' : '#16a34a' }}>
                      {selectedKelas.persentase_kehadiran}%
                    </strong>
                    <span style={{ fontSize: '0.74rem', color: 'var(--ink-2)', display: 'block' }}>
                      {selectedKelas.hadir_count} dari {selectedKelas.total_pertemuan} hadir
                    </span>
                  </div>

                  <div>
                    {selectedKelas.status_ews === 'peringatan' ? (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          color: '#b91c1c',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Icon name="alert" size={16} />
                        <span>Peringatan EWS (&lt; 75%)</span>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          color: '#15803d',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Icon name="checkCircle" size={16} />
                        <span>Kehadiran Aman (≥ 75%)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Peringatan Early Warning jika status peringatan */}
              {selectedKelas.status_ews === 'peringatan' && selectedKelas.hadir_count > 0 && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '0.85rem',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <Icon name="alert" size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Perhatian:</strong> Kehadiran Anda saat ini berada di bawah batas kelulusan 75%. Mohon tidak melewatkan sesi perkuliahan berikutnya agar dapat memenuhi syarat penerbitan sertifikat.
                  </div>
                </div>
              )}

              {/* Tabel Rincian Pertemuan */}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="col-ke" style={{ width: '60px' }}>Ke</th>
                      <th>Tanggal & Hari</th>
                      <th>Waktu Sesi</th>
                      <th>Status Kelas</th>
                      <th>Sesi Presensi</th>
                      <th>Kehadiran Saya</th>
                      <th>Waktu Absen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedKelas.pertemuan?.map((p) => {
                      const isHadir = p.status_kehadiran_saya === 'hadir';
                      const isIzin = p.status_kehadiran_saya === 'izin';
                      const isSelesai = p.status_pertemuan === 'selesai';

                      return (
                        <tr key={p.id_pertemuan} className={isSelesai ? 'is-muted' : ''}>
                          <td className="col-ke">
                            <span className="ke-badge">{p.pertemuan_ke}</span>
                          </td>
                          <td className="nowrap">
                            <p className="cell-title">{formatTanggal(p.tanggal)}</p>
                          </td>
                          <td className="nowrap">
                            {p.jam_mulai} – {p.jam_selesai} WIB
                          </td>
                          <td className="nowrap">
                            <span className={`badge ${STATUS_WAKTU[p.status_pertemuan]?.badge || 'badge-muted'}`}>
                              {STATUS_WAKTU[p.status_pertemuan]?.label || p.status_pertemuan}
                            </span>
                          </td>
                          <td className="nowrap">
                            <span className={`badge ${STATUS_PRESENSI[p.status_presensi_pertemuan]?.badge || 'badge-muted'}`}>
                              {STATUS_PRESENSI[p.status_presensi_pertemuan]?.label || 'Belum Dibuka'}
                            </span>
                          </td>
                          <td className="nowrap">
                            {isHadir ? (
                              <span className="badge badge-success" style={{ fontWeight: 700 }}>
                                Hadir
                              </span>
                            ) : isIzin ? (
                              <span className="badge badge-accent">
                                Izin
                              </span>
                            ) : isSelesai ? (
                              <span className="badge badge-danger">
                                Alpha
                              </span>
                            ) : (
                              <span className="badge badge-muted">
                                Belum Sesi
                              </span>
                            )}
                          </td>
                          <td className="nowrap" style={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>
                            {p.waktu_scan
                              ? new Date(p.waktu_scan).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
