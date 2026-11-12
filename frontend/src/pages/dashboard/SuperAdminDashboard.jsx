import { EmptyState, PageHeader, Panel, SoonButton, StatGrid, TempNotice } from '../../components/dashboard/Widgets.jsx';

function SuperAdminDashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard / Super Admin"
        title="Kendali sistem dalam satu layar."
        subtitle="Kelola akun, hak akses, dan parameter sistem, serta pantau jejak aktivitas pengguna."
      />
      <TempNotice />

      <StatGrid
        items={[
          { label: 'Total pengguna', icon: 'users', hint: 'Seluruh role' },
          { label: 'Role terdaftar', icon: 'shield', hint: 'Peserta s.d. super admin' },
          { label: 'Aktivitas hari ini', icon: 'history', hint: 'Dari audit log' },
          { label: 'Akun nonaktif', icon: 'user', hint: 'Perlu ditinjau' },
        ]}
      />

      <div className="dash-grid cols-2-1">
        <Panel
          title="Akun & role"
          subtitle="Pengguna terbaru dan hak aksesnya"
          icon="users"
          footer={<SoonButton icon="users">Kelola akun</SoonButton>}
        >
          <EmptyState icon="users" text="Daftar akun beserta role-nya akan tampil di sini." />
        </Panel>

        <Panel
          title="Parameter sistem"
          subtitle="Kuota, ambang EWS, batas bayar"
          icon="sliders"
          footer={<SoonButton icon="sliders">Ubah parameter</SoonButton>}
        >
          <EmptyState icon="sliders" text="Nilai dari tabel parameter_sistem akan tampil di sini." />
        </Panel>
      </div>

      <div className="dash-grid cols-2">
        <Panel title="Audit log terbaru" subtitle="Jejak aksi seluruh pengguna (read-only)" icon="history">
          <EmptyState icon="history" title="Belum ada aktivitas" text="Setiap aksi penting pengguna akan tercatat di sini." />
        </Panel>
        <Panel title="Dokumen SOP" subtitle="Panduan operasional layanan" icon="file">
          <EmptyState icon="file" text="Dokumen SOP yang aktif akan tampil di sini." />
        </Panel>
      </div>
    </>
  );
}

export default SuperAdminDashboard;
