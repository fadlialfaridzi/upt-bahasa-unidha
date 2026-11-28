import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { Meter } from '../../../components/dashboard/Pelatihan.jsx';

const INTERVAL_PANTAU = 5000;
const PRESET_BERLAKU = [15, 30, 60, 120];

const STATUS_SESI = {
  terbuka: { label: 'Pendaftaran dibuka', badge: 'badge-success' },
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

const PILIHAN_KEHADIRAN = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'izin', label: 'Izin' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'alpa', label: 'Alpa' },
];

const toSelectStatus = (status) => {
  if (!status) return '';
  return status === 'alpha' ? 'alpa' : status;
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

function useQrDataUrl(token) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let batal = false;
    if (!token) {
      setUrl(null);
      return undefined;
    }
    QRCode.toDataURL(token, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      .then((u) => {
        if (!batal) setUrl(u);
      })
      .catch(() => {
        if (!batal) setUrl(null);
      });
    return () => {
      batal = true;
    };
  }, [token]);
  return url;
}

/**
 * Countdown tersinkron dengan waktu server (memakai offset `waktu_server` dari API backend).
 * Memanggil `onHabis` satu kali saat sisa waktu mencapai 0 agar state disinkronkan ke backend.
 */
function useServerCountdown(batasIso, serverIso, aktif, onHabis) {
  const offsetRef = useRef(0);
  const habisRef = useRef(onHabis);
  habisRef.current = onHabis;

  const hitung = useCallback(() => {
    if (!aktif || !batasIso) return 0;
    const batasMs = Date.parse(batasIso);
    if (Number.isNaN(batasMs)) return 0;
    const serverNow = Date.now() + offsetRef.current;
    return Math.max(0, Math.ceil((batasMs - serverNow) / 1000));
  }, [aktif, batasIso]);

  const [sisa, setSisa] = useState(0);

  useEffect(() => {
    if (serverIso) {
      const serverMs = Date.parse(serverIso);
      if (!Number.isNaN(serverMs)) {
        offsetRef.current = serverMs - Date.now();
      }
    }
    if (!aktif || !batasIso) {
      setSisa(0);
      return undefined;
    }

    const awal = hitung();
    setSisa(awal);
    if (awal === 0) return undefined;

    let sudah = false;
    const timer = window.setInterval(() => {
      const nilai = hitung();
      setSisa(nilai);
      if (nilai === 0 && !sudah) {
        sudah = true;
        habisRef.current?.();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [aktif, batasIso, serverIso, hitung]);

  return sisa;
}

function LayarQrFullscreen({ data, qrUrl, sisa, onClose }) {
  const { sesi, ringkasan } = data;
  const containerRef = useRef(null);

  const keluar = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    const el = containerRef.current;
    el?.requestFullscreen?.().catch(() => {});

    const onKey = (e) => {
      if (e.key === 'Escape') keluar();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [keluar]);

  return (
    <div ref={containerRef} className="qr-layar" role="dialog" aria-modal="true" aria-label="QR Absensi TOEFL layar penuh">
      <button type="button" className="icon-btn qr-layar-tutup" onClick={keluar} aria-label="Keluar layar penuh">
        <Icon name="x" />
      </button>
      <p className="eyebrow">Absensi QR TOEFL · {formatTanggal(sesi.tanggal)}</p>
      <h2>{sesi.nama_sesi}</h2>
      <p className="qr-layar-info" style={{ marginTop: 0 }}>
        {formatJamSesi(sesi.jam_mulai)}–{formatJamSesi(sesi.jam_selesai)} WIB · {sesi.ruang || 'Ruang belum ditentukan'}
      </p>
      {qrUrl && <img src={qrUrl} alt="QR Absensi TOEFL" />}
      <p className="qr-layar-info">
        Pindai QR Code untuk mencatat kehadiran · sisa waktu <strong className="qr-sisa">{formatSisa(sisa)}</strong> (berlaku sampai {formatJamWib(sesi.waktu_tutup_presensi)} WIB)
      </p>
      <p className="qr-layar-hitung">
        <strong>{ringkasan.hadir}</strong> / {ringkasan.total} peserta hadir
      </p>
    </div>
  );
}

function ToeflAbsensiQrPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  // Modal & Fullscreen
  const [modalBuka, setModalBuka] = useState(false);
  const [menitBerlaku, setMenitBerlaku] = useState(30);
  const [modalTutup, setModalTutup] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setErrorMsg('');
    }
    try {
      const res = await api.get(`/toefl/sesi/${id}/absensi`);
      setData(res.data.data);
      setErrorMsg('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memuat data absensi QR sesi TOEFL.';
      if (!silent) setErrorMsg(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    setFullscreen(false);
    setModalBuka(false);
    setModalTutup(false);
    setUpdatingId(null);
    load();
  }, [load]);

  const sesi = data?.sesi ?? null;
  const ringkasan = data?.ringkasan ?? { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, belum: 0 };
  const peserta = data?.peserta ?? [];

  const sedangDibuka = sesi?.status_presensi === 'dibuka' && Boolean(sesi?.token_qr);

  const sisaDetik = useServerCountdown(
    sesi?.waktu_tutup_presensi,
    sesi?.waktu_server,
    sedangDibuka,
    () => {
      setFullscreen(false);
      load({ silent: true });
    },
  );

  const qrAktif = sedangDibuka && sisaDetik > 0;
  const qrUrl = useQrDataUrl(qrAktif ? sesi?.token_qr : null);

  // Auto-refresh daftar kehadiran selama QR aktif dan tab terlihat
  useEffect(() => {
    if (!qrAktif) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ silent: true });
      }
    }, INTERVAL_PANTAU);
    return () => window.clearInterval(timer);
  }, [qrAktif, load]);

  const openModalBuka = () => {
    if (busy || !sesi?.bisa_buka) return;
    setMenitBerlaku(sesi?.berlaku?.default ?? 30);
    setModalBuka(true);
  };

  const minMenit = sesi?.berlaku?.min ?? 1;
  const maksMenit = sesi?.berlaku?.maks ?? 240;
  const durasiValid = Number.isInteger(menitBerlaku) && menitBerlaku >= minMenit && menitBerlaku <= maksMenit;

  const handleBukaAbsensi = async (e) => {
    e?.preventDefault();
    if (busy || !durasiValid) return;
    setBusy(true);
    try {
      const res = await api.post(`/toefl/sesi/${id}/absensi/buka`, {
        berlaku_menit: menitBerlaku,
      });
      setData(res.data.data);
      setModalBuka(false);
      toast.success(res.data.message || 'QR absensi TOEFL berhasil dibuka');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuka absensi QR TOEFL');
      await load({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const handleTutupAbsensi = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post(`/toefl/sesi/${id}/absensi/tutup`);
      setData(res.data.data);
      setModalTutup(false);
      setFullscreen(false);
      toast.success(res.data.message || 'Absensi QR sesi TOEFL berhasil ditutup');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menutup absensi QR TOEFL');
      await load({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const handleUbahKehadiran = async (item, statusBaru) => {
    if (!statusBaru || updatingId !== null) return;
    if (toSelectStatus(item.status_kehadiran) === statusBaru) return;

    setUpdatingId(item.id_pendaftaran);
    try {
      const res = await api.patch(`/toefl/sesi/${id}/absensi/${item.id_pendaftaran}`, {
        status_kehadiran: statusBaru,
      });
      setData(res.data.data);
      toast.success(res.data.message || `Status kehadiran ${item.nama_lengkap} diperbarui`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui status kehadiran peserta');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && !data) {
    return (
      <>
        <Link to="/dashboard/admin/toefl/sesi" className="back-link dash-back">
          <Icon name="arrowLeft" size={16} /> Kembali ke Kelola Sesi TOEFL
        </Link>
        <PageHeader eyebrow="TOEFL / Administrasi ujian / Absensi QR" title="QR Absensi TOEFL" />
        <p className="table-message">Memuat data absensi sesi TOEFL...</p>
      </>
    );
  }

  if (errorMsg && !data) {
    return (
      <>
        <Link to="/dashboard/admin/toefl/sesi" className="back-link dash-back">
          <Icon name="arrowLeft" size={16} /> Kembali ke Kelola Sesi TOEFL
        </Link>
        <PageHeader eyebrow="TOEFL / Administrasi ujian / Absensi QR" title="QR Absensi TOEFL" />
        <div className="table-message" role="alert">
          <p>{errorMsg}</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => load()}>
            <Icon name="refresh" size={15} /> Coba lagi
          </button>
        </div>
      </>
    );
  }

  if (!sesi) return null;

  const statusSesiMeta = STATUS_SESI[sesi.status] || { label: sesi.status, badge: 'badge-muted' };
  const statusAbsensiMeta = qrAktif
    ? { label: 'Absensi QR Dibuka', badge: 'badge-success' }
    : sesi.status_presensi === 'dibuka' && sisaDetik === 0
      ? { label: 'QR Kedaluwarsa', badge: 'badge-warning' }
      : sesi.status_presensi === 'ditutup'
        ? { label: 'Absensi Ditutup', badge: 'badge-muted' }
        : { label: 'Belum Dibuka', badge: 'badge-muted' };

  const totalDurasiDetik = (sesi.waktu_buka_presensi && sesi.waktu_tutup_presensi)
    ? Math.max(1, (Date.parse(sesi.waktu_tutup_presensi) - Date.parse(sesi.waktu_buka_presensi)) / 1000)
    : 1;

  return (
    <>
      <Link to="/dashboard/admin/toefl/sesi" className="back-link dash-back">
        <Icon name="arrowLeft" size={16} /> Kembali ke Kelola Sesi TOEFL
      </Link>

      <PageHeader
        eyebrow="TOEFL / Administrasi ujian / Absensi QR"
        title={sesi.nama_sesi}
        subtitle={`${formatTanggal(sesi.tanggal)} · ${formatJamSesi(sesi.jam_mulai)}–${formatJamSesi(sesi.jam_selesai)} WIB · ${sesi.ruang || 'Ruang belum ditentukan'}`}
        action={
          <div className="action-group">
            <span className={`badge ${statusSesiMeta.badge}`}>{statusSesiMeta.label}</span>
            <span className={`badge ${statusAbsensiMeta.badge}`}>{statusAbsensiMeta.label}</span>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => load()} disabled={loading || busy}>
              <Icon name="refresh" size={15} /> Muat ulang
            </button>
          </div>
        }
      />

      <div
        className="summary-row"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}
      >
        <div className="summary-item"><strong>{ringkasan.total}</strong><span>Total peserta</span></div>
        <div className="summary-item"><strong>{ringkasan.hadir}</strong><span>Hadir</span></div>
        <div className="summary-item"><strong>{ringkasan.izin}</strong><span>Izin</span></div>
        <div className="summary-item"><strong>{ringkasan.sakit ?? 0}</strong><span>Sakit</span></div>
        <div className="summary-item"><strong>{ringkasan.alpha}</strong><span>Alpa</span></div>
        <div className="summary-item"><strong>{ringkasan.belum}</strong><span>Belum tercatat</span></div>
      </div>

      <div className="presensi-layout">
        {/* Kiri: Daftar Kehadiran Peserta & Absensi Manual */}
        <section className="panel" style={{ padding: '18px 20px' }}>
          <header className="panel-head" style={{ marginBottom: 14, alignItems: 'center' }}>
            <div>
              <h2 className="panel-title">Daftar kehadiran peserta</h2>
              <p className="panel-sub">{ringkasan.total} peserta terverifikasi · ubah status secara manual bila diperlukan</p>
            </div>
            <span className="badge badge-muted">{ringkasan.hadir}/{ringkasan.total} hadir</span>
          </header>

          <div className="panel-body">
            {peserta.length === 0 ? (
              <EmptyState
                icon="users"
                title="Belum ada peserta terverifikasi"
                text="Peserta yang pembayarannya telah terverifikasi pada sesi TOEFL ini akan tampil di sini."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama peserta</th>
                      <th>NIM / ID peserta</th>
                      <th>Program studi</th>
                      <th>Status kehadiran</th>
                      <th className="nowrap">Waktu presensi</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peserta.map((item) => {
                      const hadirMeta = item.status_kehadiran
                        ? (STATUS_KEHADIRAN[item.status_kehadiran] || { label: item.status_kehadiran, badge: 'badge-muted' })
                        : { label: 'Belum tercatat', badge: 'badge-muted' };
                      const isRowBusy = updatingId === item.id_pendaftaran;

                      return (
                        <tr key={item.id_pendaftaran}>
                          <td>
                            <p className="cell-title">{item.nama_lengkap || '—'}</p>
                            <p className="cell-sub">{item.email || '—'}</p>
                          </td>
                          <td className="nowrap">
                            <p>{item.nim || `ID #${item.id_pendaftaran}`}</p>
                          </td>
                          <td>
                            <p className="cell-sub">{item.program_studi || '—'}</p>
                          </td>
                          <td className="nowrap">
                            <span className={`badge ${hadirMeta.badge}`}>{hadirMeta.label}</span>
                          </td>
                          <td className="nowrap cell-sub">
                            {formatWaktuLengkap(item.waktu_presensi)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <select
                                className="input input-plain select-sm"
                                aria-label={`Ubah kehadiran ${item.nama_lengkap}`}
                                value={toSelectStatus(item.status_kehadiran)}
                                onChange={(e) => handleUbahKehadiran(item, e.target.value)}
                                disabled={updatingId !== null}
                                style={{ minWidth: '132px' }}
                              >
                                <option value="" disabled>— Pilih status —</option>
                                {PILIHAN_KEHADIRAN.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              {isRowBusy && <span className="cell-sub">Menyimpan...</span>}
                            </div>
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

        {/* Kanan: Panel QR Code Absensi */}
        <section className={`panel qr-panel${qrAktif ? ' is-dibuka' : ''}`}>
          <header className="panel-head">
            <div>
              <h2 className="panel-title">QR Code Absensi</h2>
              <p className="panel-sub">
                {qrAktif
                  ? `Berlaku sampai ${formatJamWib(sesi.waktu_tutup_presensi)} WIB`
                  : sesi.status_presensi === 'ditutup'
                    ? `Ditutup ${formatWaktuLengkap(sesi.waktu_tutup_presensi)} WIB`
                    : 'Pindai QR untuk presensi otomatis'}
              </p>
            </div>
            <span className={`badge ${statusAbsensiMeta.badge}`}>
              {qrAktif && <span className="live-dot" aria-hidden="true" />} {statusAbsensiMeta.label}
            </span>
          </header>

          {qrAktif ? (
            <>
              <div className="qr-box">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Absensi TOEFL" />
                ) : (
                  <p className="table-message">Membuat gambar QR...</p>
                )}
              </div>

              <div className="qr-hitung-mundur" role="timer" aria-live="off">
                <span>Sisa waktu</span>
                <strong className={sisaDetik <= 60 ? 'is-hampir' : ''}>{formatSisa(sisaDetik)}</strong>
              </div>

              <Meter
                value={sisaDetik}
                max={totalDurasiDetik}
                tone={sisaDetik <= 60 ? 'danger' : 'brand'}
                label="Sisa masa berlaku QR absensi TOEFL"
              />

              <p className="qr-hitung" aria-live="polite">
                <strong>{ringkasan.hadir}</strong> dari {ringkasan.total} peserta sudah hadir
              </p>

              <div className="qr-actions">
                <button type="button" className="btn btn-primary btn-block" onClick={() => setFullscreen(true)}>
                  <Icon name="eye" size={16} /> Tampilkan layar penuh
                </button>
                <button type="button" className="btn btn-soft btn-sm" onClick={openModalBuka} disabled={busy}>
                  <Icon name="refresh" size={15} /> Buat ulang QR
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setModalTutup(true)} disabled={busy}>
                  <Icon name="lock" size={15} /> Tutup absensi
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="qr-box qr-box-kosong">
                <Icon name={sesi.status_presensi === 'ditutup' ? 'lock' : 'qr'} size={44} />
              </div>

              {sesi.status_presensi === 'dibuka' && sisaDetik === 0 ? (
                <p className="qr-hitung">Masa berlaku QR telah habis (kedaluwarsa). QR tidak lagi aktif.</p>
              ) : sesi.status_presensi === 'ditutup' ? (
                <p className="qr-hitung">
                  Absensi QR ditutup pada {formatWaktuLengkap(sesi.waktu_tutup_presensi)} WIB. Peserta yang belum hadir tetap berstatus <strong>Belum tercatat</strong>.
                </p>
              ) : sesi.bisa_buka ? (
                <p className="qr-hitung">Belum ada QR absensi aktif untuk sesi TOEFL ini.</p>
              ) : (
                <p className="qr-hitung">{sesi.alasan_buka || 'Absensi QR belum dapat dibuka untuk sesi ini.'}</p>
              )}

              {sesi.bisa_buka && (
                <button type="button" className="btn btn-primary btn-block" onClick={openModalBuka} disabled={busy}>
                  <Icon name="qr" size={16} />
                  {sesi.qr_pernah_dibuat ? 'Buka ulang absensi QR' : 'Buka absensi QR'}
                </button>
              )}

              <p className="field-hint">
                {sesi.bisa_buka
                  ? 'Admin dapat membuka atau membuka ulang QR kapan saja selama sesi berstatus Terjadwal. QR lama otomatis dinonaktifkan saat QR baru dibuat.'
                  : 'Pastikan jadwal sesi TOEFL sudah dirilis (berstatus Terjadwal) sebelum membuka absensi QR.'}
              </p>
            </>
          )}
        </section>
      </div>

      {/* Mode Layar Penuh / Proyektor */}
      {fullscreen && qrAktif && (
        <LayarQrFullscreen
          data={data}
          qrUrl={qrUrl}
          sisa={sisaDetik}
          onClose={() => setFullscreen(false)}
        />
      )}

      {/* Modal: Buka / Buka Ulang Absensi QR */}
      {modalBuka && (
        <Modal
          title={sesi.qr_pernah_dibuat ? 'Buka Ulang Absensi QR' : 'Buka Absensi QR TOEFL'}
          subtitle={sesi.nama_sesi}
          size="sm"
          busy={busy}
          onClose={() => !busy && setModalBuka(false)}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setModalBuka(false)} disabled={busy}>
                Batal
              </button>
              <button type="submit" form="buka-qr-toefl-form" className="btn btn-primary" disabled={busy || !durasiValid}>
                <Icon name="qr" size={16} />
                {busy ? 'Membuka...' : 'Buat & Buka QR'}
              </button>
            </>
          }
        >
          <form id="buka-qr-toefl-form" className="qr-form" onSubmit={handleBukaAbsensi}>
            <p className="field-label">Durasi masa berlaku QR (menit)</p>
            <div className="preset-group" role="group" aria-label="Pilihan cepat masa berlaku">
              {PRESET_BERLAKU.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`preset-btn${menitBerlaku === m ? ' active' : ''}`}
                  onClick={() => setMenitBerlaku(m)}
                  disabled={busy}
                >
                  {m} mnt
                </button>
              ))}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="durasi-qr-toefl">Atau isi sendiri ({minMenit}–{maksMenit} menit)</label>
              <input
                id="durasi-qr-toefl"
                type="number"
                className="input input-plain"
                min={minMenit}
                max={maksMenit}
                value={Number.isNaN(menitBerlaku) ? '' : menitBerlaku}
                onChange={(e) => setMenitBerlaku(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                disabled={busy}
              />
            </div>

            {!durasiValid && (
              <p className="field-error">Durasi wajib bilangan bulat {minMenit}–{maksMenit} menit.</p>
            )}

            {sesi.qr_pernah_dibuat && (
              <p className="qr-peringatan">
                <Icon name="alert" size={15} />
                <span>Membuka ulang absensi akan membuat <strong>QR Code baru</strong> dan menonaktifkan QR sebelumnya.</span>
              </p>
            )}
          </form>
        </Modal>
      )}

      {/* Modal: Konfirmasi Tutup Absensi */}
      {modalTutup && (
        <Modal
          title="Tutup Absensi QR?"
          subtitle={sesi.nama_sesi}
          size="sm"
          busy={busy}
          onClose={() => !busy && setModalTutup(false)}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setModalTutup(false)} disabled={busy}>
                Batal
              </button>
              <button type="button" className="btn btn-danger" onClick={handleTutupAbsensi} disabled={busy}>
                <Icon name="lock" size={15} />
                {busy ? 'Menutup...' : 'Ya, Tutup Absensi'}
              </button>
            </>
          }
        >
          <p>
            QR absensi akan langsung dinonaktifkan dan tidak lagi ditampilkan sebagai QR aktif.{' '}
            {ringkasan.belum > 0
              ? `${ringkasan.belum} peserta yang belum hadir tetap berstatus Belum tercatat (tidak diubah menjadi alpa).`
              : 'Seluruh peserta terverifikasi sudah tercatat.'}
          </p>
        </Modal>
      )}
    </>
  );
}

export default ToeflAbsensiQrPage;
