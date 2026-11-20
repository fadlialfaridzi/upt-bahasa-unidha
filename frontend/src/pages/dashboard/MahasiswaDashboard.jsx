import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import Icon from '../../components/ui/Icon.jsx';
import {
  EmptyState, PageHeader, Panel, SoonButton, StatGrid, TempNotice, firstName, greeting,
} from '../../components/dashboard/Widgets.jsx';

function MahasiswaDashboard() {
  const { user } = useAuth();
  const [pendaftaran, setPendaftaran] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/pelatihan/my-pendaftaran')
      .then((res) => setPendaftaran(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tagihanBelumBayar = pendaftaran.filter((p) => p.status_pendaftaran === 'menunggu_pembayaran');

  const QUICK_ACTIONS = [
    { icon: 'graduation', title: 'Daftar tes TOEFL', text: 'Pilih sesi ujian', disabled: true },
    { icon: 'book', title: 'Ikut kelas pelatihan', text: 'Daftar kelas & cicilan', path: '/dashboard/mahasiswa/pelatihan' },
    { icon: 'languages', title: 'Ajukan penerjemahan', text: 'Unggah dokumen', disabled: true },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Dashboard / Mahasiswa & Peserta"
        title={`Selamat ${greeting()}, ${firstName(user?.nama_lengkap || 'Peserta')}.`}
        subtitle="Hadir hari ini, siap untuk esok. Pantau layanan, tagihan, dan kehadiran Anda di sini."
      />
      <TempNotice />

      <StatGrid
        items={[
          { label: 'Pendaftaran aktif', icon: 'clipboard', value: pendaftaran.length, hint: `${pendaftaran.length} kelas terdaftar` },
          { label: 'Tagihan belum dibayar', icon: 'wallet', value: tagihanBelumBayar.length, hint: `${tagihanBelumBayar.length} tagihan aktif` },
          { label: 'Kehadiran pelatihan', icon: 'chart', hint: 'Minimum 75% untuk lulus' },
          { label: 'Sertifikat', icon: 'award', hint: 'Siap diunduh' },
        ]}
      />

      <Panel title="Mulai layanan" subtitle="Pilih layanan yang ingin Anda ikuti" icon="grid">
        <div className="quick-actions">
          {QUICK_ACTIONS.map((a) => (
            a.path ? (
              <Link key={a.title} to={a.path} className="quick-action" style={{ textDecoration: 'none' }}>
                <span className="icon-tile icon-tile-accent"><Icon name={a.icon} /></span>
                <span>
                  <strong>{a.title}</strong>
                  <small>{a.text}</small>
                </span>
              </Link>
            ) : (
              <button key={a.title} type="button" className="quick-action" disabled title="Segera hadir">
                <span className="icon-tile icon-tile-accent"><Icon name={a.icon} /></span>
                <span>
                  <strong>{a.title}</strong>
                  <small>{a.text}</small>
                </span>
              </button>
            )
          ))}
        </div>
      </Panel>

      <div className="dash-grid cols-2" style={{ marginTop: 20 }}>
        <Panel
          title="Tagihan & Pembayaran"
          subtitle="Tagihan aktif dan status pembayaran pelatihan"
          icon="wallet"
          footer={
            <Link to="/dashboard/mahasiswa/pelatihan" className="btn btn-outline" style={{ fontSize: '0.82rem', textDecoration: 'none' }}>
              <Icon name="upload" size={14} /> Kelola & Unggah Bukti Bayar
            </Link>
          }
        >
          {loading ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Memuat tagihan...</p>
          ) : pendaftaran.length === 0 ? (
            <EmptyState icon="wallet" title="Tidak ada tagihan" text="Tagihan muncul setelah Anda mendaftar kelas pelatihan." />
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {pendaftaran.slice(0, 3).map((item) => (
                <div key={item.id_pendaftaran} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--line)' }}>
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--brand-900)' }}>{item.kelas.nama_kelas}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Kode: {item.tagihan?.kode_tagihan}</div>
                  </div>
                  <span className={`badge ${item.status_pendaftaran === 'terverifikasi' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.74rem' }}>
                    {item.status_pendaftaran === 'terverifikasi' ? 'Aktif' : 'Menunggu Bayar'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Presensi & peringatan dini"
          subtitle="Kehadiran kelas pelatihan Anda"
          icon="qr"
          footer={<SoonButton icon="qr" variant="primary">Pindai QR presensi</SoonButton>}
        >
          <EmptyState icon="chart" text="Rekap kehadiran dan status EWS akan tampil setelah Anda mengikuti kelas." />
        </Panel>
      </div>

      <Panel title="Riwayat pendaftaran" subtitle="TOEFL, pelatihan, dan penerjemahan" icon="history">
        {pendaftaran.length === 0 ? (
          <EmptyState icon="history" text="Riwayat layanan yang pernah Anda ikuti akan tampil di sini." />
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {pendaftaran.map((item) => (
              <div key={item.id_pendaftaran} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                <span>{item.kelas.nama_kelas}</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{item.status_pendaftaran}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

export default MahasiswaDashboard;
