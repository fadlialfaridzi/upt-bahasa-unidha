import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import Icon from '../../components/ui/Icon.jsx';
import {
  EmptyState, PageHeader, Panel, StatGrid, firstName, greeting,
} from '../../components/dashboard/Widgets.jsx';
import { JENIS_PELATIHAN, formatRupiah, formatTanggal } from '../../config/pelatihan.js';

const STATUS_PENDAFTARAN_BADGE = {
  menunggu_pembayaran: { label: 'Menunggu Pembayaran', badge: 'badge-warning' },
  terverifikasi: { label: 'Terverifikasi (Aktif)', badge: 'badge-success' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

function MahasiswaDashboard() {
  const { user } = useAuth();
  const [pendaftaran, setPendaftaran] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/pelatihan/my-pendaftaran')
      .then((res) => setPendaftaran(res.data.data || []))
      .catch((err) => console.error('Gagal mengambil data pendaftaran:', err))
      .finally(() => setLoading(false));
  }, []);

  // Perhitungan statistik live
  const kelasAktif = pendaftaran.filter((p) => p.status_pendaftaran === 'terverifikasi');
  const tagihanBelumBayar = pendaftaran.filter(
    (p) => p.status_pendaftaran === 'menunggu_pembayaran' || p.tagihan?.status === 'menunggu_pembayaran'
  );
  const menungguValidasi = pendaftaran.filter(
    (p) => p.tagihan?.status === 'menunggu_verifikasi'
  );

  const QUICK_ACTIONS = [
    {
      icon: 'book',
      title: 'Kelas Pelatihan Bahasa',
      text: 'Daftar kelas baru, bayar lunas atau cicilan 3x',
      path: '/dashboard/mahasiswa/pelatihan',
      badge: 'Aktif',
      badgeClass: 'badge-success',
    },
    {
      icon: 'graduation',
      title: 'Jadwal Tes TOEFL',
      text: 'Lihat jadwal dan sesi ujian TOEFL yang dibuka',
      path: '/toefl',
      badge: 'Jadwal Publik',
      badgeClass: 'badge-accent',
    },
    {
      icon: 'languages',
      title: 'Jasa Penerjemahan',
      text: 'Ajukan penerjemahan dokumen resmi & akademik',
      path: '/terjemahan',
      badge: 'Layanan',
      badgeClass: 'badge-muted',
    },
    {
      icon: 'history',
      title: 'Status Penerjemahan',
      text: 'Pantau pesanan dan ajukan revisi hasil',
      path: '/dashboard/mahasiswa/terjemahan',
      badge: 'Pesanan saya',
      badgeClass: 'badge-accent',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Portal Peserta / Ringkasan"
        title={`Selamat ${greeting()}, ${firstName(user?.nama_lengkap || 'Peserta')}.`}
        subtitle="Pantau kelas pelatihan, status pembayaran & cicilan bank, dan riwayat aktivitas Anda."
        action={
          <Link to="/dashboard/mahasiswa/pelatihan" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            <Icon name="book" size={16} /> Daftar Kelas Pelatihan
          </Link>
        }
      />

      <StatGrid
        items={[
          {
            label: 'Kelas Terdaftar',
            icon: 'clipboard',
            value: loading ? '...' : pendaftaran.length,
            hint: `${pendaftaran.length} kelas pelatihan diikuti`,
          },
          {
            label: 'Kelas Aktif',
            icon: 'graduation',
            value: loading ? '...' : kelasAktif.length,
            hint: 'Pendaftaran terverifikasi',
          },
          {
            label: 'Tagihan Menunggu',
            icon: 'wallet',
            value: loading ? '...' : tagihanBelumBayar.length,
            hint: 'Perlu pembayaran via bank',
          },
          {
            label: 'Menunggu Validasi',
            icon: 'award',
            value: loading ? '...' : menungguValidasi.length,
            hint: 'Bukti bayar sedang ditinjau admin',
          },
        ]}
      />

      {/* Panel Layanan Cepat */}
      <Panel title="Layanan UPT Bahasa" subtitle="Pilih layanan bahasa yang ingin Anda ikuti" icon="grid">
        <div className="quick-actions">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.title} to={a.path} className="quick-action" style={{ textDecoration: 'none' }}>
              <span className="icon-tile icon-tile-accent"><Icon name={a.icon} /></span>
              <span style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>{a.title}</strong>
                  {a.badge && <span className={`badge ${a.badgeClass}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>{a.badge}</span>}
                </div>
                <small>{a.text}</small>
              </span>
              <Icon name="arrowRight" size={16} />
            </Link>
          ))}
        </div>
      </Panel>

      <div className="dash-grid cols-2" style={{ marginTop: 20 }}>
        {/* Panel Tagihan & Pembayaran */}
        <Panel
          title="Tagihan & Pembayaran Bank"
          subtitle="Status pembayaran kelas dan cicilan"
          icon="wallet"
          footer={
            <Link
              to="/dashboard/mahasiswa/pelatihan?tab=tagihan"
              className="btn btn-outline"
              style={{ fontSize: '0.82rem', textDecoration: 'none', width: '100%', justifyContent: 'center' }}
            >
              <Icon name="upload" size={14} /> Kelola Tagihan & Unggah Bukti Bayar
            </Link>
          }
        >
          {loading ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Memuat informasi tagihan...</p>
          ) : pendaftaran.length === 0 ? (
            <EmptyState
              icon="wallet"
              title="Belum ada tagihan aktif"
              text="Tagihan muncul setelah Anda mendaftar kelas pelatihan."
            />
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {pendaftaran.slice(0, 3).map((item) => {
                const tagihan = item.tagihan;
                const isCicilan = tagihan?.is_cicilan;
                const statusTagihan = tagihan?.status;

                return (
                  <div
                    key={item.id_pendaftaran}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--brand-900)' }}>
                        {item.kelas.nama_kelas}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                        Kode: <code style={{ color: 'var(--ink-2)' }}>{tagihan?.kode_tagihan}</code> · {isCicilan ? 'Skema Cicilan (Maks. 3x)' : 'Bayar Lunas (1x)'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--brand-800)', display: 'block' }}>
                        {formatRupiah(tagihan?.total_tagihan || item.kelas.tarif)}
                      </strong>
                      <span
                        className={`badge ${
                          statusTagihan === 'lunas'
                            ? 'badge-success'
                            : statusTagihan === 'menunggu_verifikasi'
                            ? 'badge-accent'
                            : 'badge-warning'
                        }`}
                        style={{ fontSize: '0.72rem', marginTop: '2px' }}
                      >
                        {statusTagihan === 'lunas'
                          ? 'Lunas'
                          : statusTagihan === 'menunggu_verifikasi'
                          ? 'Menunggu Validasi Admin'
                          : 'Menunggu Pembayaran'}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div style={{ marginTop: '4px', background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--ink-2)' }}>
                🏦 <strong>Bank Nagari</strong> · No. Rek: <span style={{ fontWeight: 700, color: 'var(--brand-800)' }}>0102.0210.01234-5</span> a.n. UPT Bahasa UNIDHA
              </div>
            </div>
          )}
        </Panel>

        {/* Panel Kelas Pelatihan & Kehadiran */}
        <Panel
          title="Kelas Pelatihan Saya"
          subtitle="Jadwal dan ketentuan kehadiran"
          icon="book"
          footer={
            <Link
              to="/dashboard/mahasiswa/pelatihan"
              className="btn btn-outline"
              style={{ fontSize: '0.82rem', textDecoration: 'none', width: '100%', justifyContent: 'center' }}
            >
              <Icon name="book" size={14} /> Buka Katalog & Manajemen Kelas
            </Link>
          }
        >
          {loading ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Memuat data kelas...</p>
          ) : pendaftaran.length === 0 ? (
            <EmptyState
              icon="book"
              title="Belum terdaftar di kelas manapun"
              text="Pilih dan ikuti kelas pelatihan intensif di UPT Bahasa."
            />
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {pendaftaran.slice(0, 3).map((item) => (
                <div
                  key={item.id_pendaftaran}
                  style={{
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--brand-900)' }}>
                        {item.kelas.nama_kelas}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                        {JENIS_PELATIHAN[item.kelas.jenis_pelatihan] || item.kelas.jenis_pelatihan} · {item.kelas.jumlah_pertemuan} Pertemuan
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        item.status_pendaftaran === 'terverifikasi' ? 'badge-success' : 'badge-warning'
                      }`}
                      style={{ fontSize: '0.72rem' }}
                    >
                      {item.status_pendaftaran === 'terverifikasi' ? 'Aktif' : 'Menunggu Bayar'}
                    </span>
                  </div>

                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: 'var(--ink-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Syarat Kelulusan: Min. 75% Hadir</span>
                    <span style={{ color: 'var(--brand-800)', fontWeight: 600 }}>Presensi QR Saat Kelas</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Panel Riwayat Pendaftaran Lengkap */}
      <Panel
        title="Riwayat Pendaftaran Pelatihan"
        subtitle="Daftar kelas pelatihan yang pernah atau sedang Anda ikuti"
        icon="history"
      >
        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Memuat riwayat pendaftaran...</p>
        ) : pendaftaran.length === 0 ? (
          <EmptyState
            icon="history"
            title="Belum ada riwayat pendaftaran"
            text="Riwayat kelas pelatihan yang Anda ikuti akan tampil di sini."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left', color: 'var(--muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Kelas Pelatihan</th>
                  <th style={{ padding: '10px 12px' }}>Jenis</th>
                  <th style={{ padding: '10px 12px' }}>Tanggal Daftar</th>
                  <th style={{ padding: '10px 12px' }}>Skema Pembayaran</th>
                  <th style={{ padding: '10px 12px' }}>Status Pendaftaran</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pendaftaran.map((item) => {
                  const statusPendaftaran = STATUS_PENDAFTARAN_BADGE[item.status_pendaftaran] || {
                    label: item.status_pendaftaran,
                    badge: 'badge-muted',
                  };
                  const isCicilan = item.tagihan?.is_cicilan;

                  return (
                    <tr key={item.id_pendaftaran} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px' }}>
                        <strong style={{ color: 'var(--brand-900)' }}>{item.kelas.nama_kelas}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {item.kelas.jumlah_pertemuan} Pertemuan
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
                          {JENIS_PELATIHAN[item.kelas.jenis_pelatihan] || item.kelas.jenis_pelatihan}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--muted)' }}>
                        {formatTanggal(item.tanggal_daftar)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span>{isCicilan ? 'Cicilan (Maks. 3x)' : 'Bayar Lunas (1x)'}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--brand-800)', fontWeight: 600 }}>
                          {formatRupiah(item.tagihan?.total_tagihan || item.kelas.tarif)}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={`badge ${statusPendaftaran.badge}`} style={{ fontSize: '0.74rem' }}>
                          {statusPendaftaran.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <Link
                          to="/dashboard/mahasiswa/pelatihan?tab=tagihan"
                          className="btn btn-outline"
                          style={{ fontSize: '0.78rem', padding: '4px 10px', textDecoration: 'none' }}
                        >
                          Detail & Bayar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

export default MahasiswaDashboard;
