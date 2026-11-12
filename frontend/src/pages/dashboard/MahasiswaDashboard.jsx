import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/ui/Icon.jsx';
import {
  EmptyState, PageHeader, Panel, SoonButton, StatGrid, TempNotice, firstName, greeting,
} from '../../components/dashboard/Widgets.jsx';

const QUICK_ACTIONS = [
  { icon: 'graduation', title: 'Daftar tes TOEFL', text: 'Pilih sesi ujian' },
  { icon: 'book', title: 'Ikut kelas pelatihan', text: 'TOEFL, IELTS, conversation' },
  { icon: 'languages', title: 'Ajukan penerjemahan', text: 'Unggah dokumen' },
];

function MahasiswaDashboard() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        eyebrow="Dashboard / Mahasiswa"
        title={`Selamat ${greeting()}, ${firstName(user.nama_lengkap)}.`}
        subtitle="Hadir hari ini, siap untuk esok. Pantau layanan, tagihan, dan kehadiran Anda di sini."
      />
      <TempNotice />

      <StatGrid
        items={[
          { label: 'Pendaftaran aktif', icon: 'clipboard', hint: 'TOEFL & pelatihan' },
          { label: 'Tagihan belum dibayar', icon: 'wallet', hint: 'Termasuk cicilan' },
          { label: 'Kehadiran pelatihan', icon: 'chart', hint: 'Minimum 75% untuk lulus' },
          { label: 'Sertifikat', icon: 'award', hint: 'Siap diunduh' },
        ]}
      />

      <Panel title="Mulai layanan" subtitle="Pilih layanan yang ingin Anda ikuti" icon="grid">
        <div className="quick-actions">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.title} type="button" className="quick-action" disabled title="Segera hadir">
              <span className="icon-tile icon-tile-accent"><Icon name={a.icon} /></span>
              <span>
                <strong>{a.title}</strong>
                <small>{a.text}</small>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="dash-grid cols-2" style={{ marginTop: 20 }}>
        <Panel
          title="Tagihan saya"
          subtitle="Tagihan aktif dan status pembayaran"
          icon="wallet"
          footer={<SoonButton icon="upload" variant="outline">Unggah bukti bayar</SoonButton>}
        >
          <EmptyState icon="wallet" title="Tidak ada tagihan" text="Tagihan muncul setelah Anda mendaftar layanan." />
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
        <EmptyState icon="history" text="Riwayat layanan yang pernah Anda ikuti akan tampil di sini." />
      </Panel>
    </>
  );
}

export default MahasiswaDashboard;
