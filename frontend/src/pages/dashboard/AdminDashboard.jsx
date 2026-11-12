import { useAuth } from '../../context/AuthContext.jsx';
import {
  EmptyState, PageHeader, Panel, SoonButton, StatGrid, TempNotice, firstName, greeting,
} from '../../components/dashboard/Widgets.jsx';

function AdminDashboard() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        eyebrow="Ruang kerja terpusat"
        title={`Selamat ${greeting()}, ${firstName(user.nama_lengkap)}.`}
        subtitle="Kelola layanan bahasa, verifikasi pembayaran, dan pantau kehadiran dalam satu tempat."
      />
      <TempNotice />

      <StatGrid
        items={[
          { label: 'Pendaftar TOEFL', icon: 'graduation', hint: 'Sesi yang sedang dibuka' },
          { label: 'Menunggu verifikasi', icon: 'wallet', hint: 'Bukti pembayaran masuk' },
          { label: 'Dokumen diproses', icon: 'languages', hint: 'Pesanan penerjemahan' },
          { label: 'Kelas pelatihan aktif', icon: 'book', hint: 'Peserta aktif' },
        ]}
      />

      <div className="dash-grid cols-3">
        <Panel
          title="Sesi TOEFL"
          subtitle="Kuota dan status pendaftaran"
          icon="graduation"
          footer={<SoonButton icon="plus" variant="primary">Buat sesi</SoonButton>}
        >
          <EmptyState icon="calendar" text="Sesi TOEFL yang dibuka akan tampil di sini." />
        </Panel>

        <Panel
          title="Verifikasi pembayaran"
          subtitle="Bukti bayar yang perlu diperiksa"
          icon="wallet"
          footer={<SoonButton icon="checkCircle">Tinjau semua</SoonButton>}
        >
          <EmptyState icon="wallet" text="Belum ada bukti pembayaran yang masuk." />
        </Panel>

        <Panel
          title="Alur penerjemahan"
          subtitle="Pesanan & job order penerjemah"
          icon="languages"
          footer={<SoonButton icon="languages">Alokasikan penerjemah</SoonButton>}
        >
          <EmptyState icon="file" text="Pesanan penerjemahan akan tampil di sini." />
        </Panel>
      </div>

      <div className="dash-grid cols-2">
        <Panel title="Jadwal pelatihan" subtitle="Agenda kelas terdekat" icon="calendar">
          <EmptyState icon="calendar" text="Pertemuan kelas yang terjadwal akan tampil di sini." />
        </Panel>
        <Panel title="Peringatan dini kehadiran" subtitle="Peserta di bawah ambang 75%" icon="alert" badge="EWS">
          <EmptyState icon="users" title="Tidak ada peserta berisiko" text="Peserta dengan kehadiran rendah akan muncul di sini." />
        </Panel>
      </div>
    </>
  );
}

export default AdminDashboard;
