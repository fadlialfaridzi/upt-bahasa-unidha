import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, PageHeader, Panel, SoonButton, StatGrid, TempNotice } from '../../components/dashboard/Widgets.jsx';

function DosenDashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard / Dosen"
        title="Kelas yang menggerakkan potensi."
        subtitle="Kelola pembelajaran, buka presensi, dan dampingi setiap peserta."
      />
      <TempNotice />

      <StatGrid
        items={[
          { label: 'Kelas diampu', icon: 'graduation', hint: 'Periode berjalan' },
          { label: 'Pertemuan minggu ini', icon: 'calendar', hint: 'Sesuai jadwal' },
          { label: 'Rerata kehadiran', icon: 'chart', hint: 'Seluruh kelas' },
          { label: 'Nilai belum diinput', icon: 'clipboard', hint: 'Pre-test / post-test' },
        ]}
      />

      <div className="dash-grid cols-2-1">
        <div className="stack">
          <Panel title="Kelas saya" subtitle="Kelas dan pertemuan yang Anda ampu" icon="graduation">
            <EmptyState icon="graduation" text="Kelas yang dijadwalkan untuk Anda akan tampil di sini." />
          </Panel>

          <Panel
            title="Materi pembelajaran"
            subtitle="Materi per kelas untuk seluruh peserta"
            icon="book"
            footer={<SoonButton icon="upload" variant="outline">Unggah materi</SoonButton>}
          >
            <EmptyState icon="file" text="Belum ada materi yang diunggah." />
          </Panel>

          <Panel title="Input nilai peserta" subtitle="Nilai pre-test dan nilai akhir 0–100" icon="clipboard">
            <EmptyState icon="clipboard" text="Daftar peserta dan nilainya akan tampil di sini." />
          </Panel>
        </div>

        <Panel
          title="QR presensi"
          subtitle="Satu pertemuan = satu kode QR"
          icon="qr"
          footer={<SoonButton icon="qr" variant="primary">Buat QR presensi</SoonButton>}
        >
          <div className="qr-placeholder" aria-hidden="true">
            <Icon name="qr" size={64} strokeWidth={1.2} />
          </div>
          <p className="qr-caption">Belum ada sesi presensi yang dibuka.</p>
        </Panel>
      </div>
    </>
  );
}

export default DosenDashboard;
