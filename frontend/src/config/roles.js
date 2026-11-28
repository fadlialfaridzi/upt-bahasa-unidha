// Pemetaan role (tabel `role` di database) ke dashboard frontend.

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  staf_upt: 'Admin UPT',
  pengajar: 'Dosen',
  penerjemah: 'Penerjemah',
  peserta: 'Mahasiswa',
};

// Item menu dengan `path` sudah punya halaman; yang belum ditampilkan nonaktif ("segera hadir").
export const DASHBOARDS = {
  superadmin: {
    path: '/dashboard/super-admin',
    label: 'Super Admin',
    menu: [
      { label: 'Ringkasan', icon: 'grid', path: '/dashboard/super-admin' },
      { label: 'Akun & role', icon: 'users', path: '/dashboard/super-admin/users' },
      { label: 'Override TOEFL', icon: 'shield', path: '/dashboard/super-admin/override-toefl' },
      { label: 'Parameter sistem', icon: 'sliders' },
      { label: 'Audit log', icon: 'history' },
      { label: 'Dokumen SOP', icon: 'file' },
    ],
  },
  admin: {
    path: '/dashboard/admin',
    label: 'Admin UPT',
    menu: [
      { label: 'Ringkasan', icon: 'grid', path: '/dashboard/admin' },
      { label: 'Sesi TOEFL', icon: 'graduation', path: '/dashboard/admin/toefl/sesi' },
      { label: 'Kuota TOEFL', icon: 'users', path: '/dashboard/admin/toefl/kuota' },
      { label: 'Validasi TOEFL', icon: 'checkCircle', path: '/dashboard/admin/toefl/pembayaran' },
      { label: 'Kelas pelatihan', icon: 'book', path: '/dashboard/admin/kelas' },
      { label: 'Hasil terjemahan', icon: 'languages', path: '/dashboard/admin/terjemahan/hasil' },
      { label: 'Tagihan & pembayaran', icon: 'wallet', path: '/dashboard/admin/pembayaran' },
      { label: 'Sertifikat', icon: 'award' },
      { label: 'Analitik', icon: 'chart' },
    ],
  },
  dosen: {
    path: '/dashboard/dosen',
    label: 'Dosen',
    menu: [
      { label: 'Ringkasan', icon: 'grid', path: '/dashboard/dosen' },
      { label: 'Kelas saya', icon: 'graduation', path: '/dashboard/dosen/kelas' },
      { label: 'Jadwal kegiatan', icon: 'calendar', path: '/dashboard/dosen/jadwal' },
      { label: 'Input nilai', icon: 'clipboard' },
    ],
  },
  penerjemah: {
    path: '/dashboard/penerjemah',
    label: 'Penerjemah',
    menu: [
      { label: 'Job order', icon: 'languages', path: '/dashboard/penerjemah' },
    ],
  },
  mahasiswa: {
    path: '/dashboard/mahasiswa',
    label: 'Mahasiswa',
    menu: [
      { label: 'Ringkasan', icon: 'grid', path: '/dashboard/mahasiswa' },
      { label: 'Tes TOEFL', icon: 'graduation', path: '/dashboard/mahasiswa/toefl' },
      { label: 'Absensi TOEFL', icon: 'qr', path: '/dashboard/mahasiswa/absensi-toefl' },
      { label: 'Daftar pelatihan', icon: 'book', path: '/dashboard/mahasiswa/pelatihan' },
      { label: 'Kelas saya', icon: 'users', path: '/dashboard/mahasiswa/kelas' },
      { label: 'Presensi & EWS', icon: 'qr', path: '/dashboard/mahasiswa/presensi-ews' },
      { label: 'Penerjemahan saya', icon: 'languages', path: '/dashboard/mahasiswa/terjemahan' },
      { label: 'Tagihan', icon: 'wallet', path: '/dashboard/mahasiswa/tagihan' },
      { label: 'Sertifikat', icon: 'award' },
    ],
  },
};

const ROLE_TO_DASHBOARD = {
  super_admin: 'superadmin',
  staf_upt: 'admin',
  pengajar: 'dosen',
  penerjemah: 'penerjemah',
  peserta: 'mahasiswa',
};

export const dashboardKeyFor = (role) => ROLE_TO_DASHBOARD[role] ?? 'mahasiswa';
export const dashboardPathFor = (role) => DASHBOARDS[dashboardKeyFor(role)].path;
