// Pemetaan role (tabel `role` di database) ke dashboard frontend.

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  kepala_upt: 'Kepala UPT',
  staf_upt: 'Admin UPT',
  pengajar: 'Dosen',
  penerjemah: 'Penerjemah',
  peserta: 'Mahasiswa',
};

export const DASHBOARDS = {
  superadmin: {
    path: '/dashboard/super-admin',
    label: 'Super Admin',
    menu: [
      { label: 'Ringkasan', icon: 'grid' },
      { label: 'Akun & role', icon: 'users' },
      { label: 'Parameter sistem', icon: 'sliders' },
      { label: 'Audit log', icon: 'history' },
      { label: 'Dokumen SOP', icon: 'file' },
    ],
  },
  admin: {
    path: '/dashboard/admin',
    label: 'Admin UPT',
    menu: [
      { label: 'Ringkasan', icon: 'grid' },
      { label: 'Sesi TOEFL', icon: 'graduation' },
      { label: 'Kelas pelatihan', icon: 'book' },
      { label: 'Penerjemahan', icon: 'languages' },
      { label: 'Tagihan & pembayaran', icon: 'wallet' },
      { label: 'Sertifikat', icon: 'award' },
      { label: 'Analitik', icon: 'chart' },
    ],
  },
  dosen: {
    path: '/dashboard/dosen',
    label: 'Dosen',
    menu: [
      { label: 'Ringkasan', icon: 'grid' },
      { label: 'Kelas saya', icon: 'graduation' },
      { label: 'Jadwal mengajar', icon: 'calendar' },
      { label: 'Presensi QR', icon: 'qr' },
      { label: 'Materi', icon: 'book' },
      { label: 'Input nilai', icon: 'clipboard' },
    ],
  },
  mahasiswa: {
    path: '/dashboard/mahasiswa',
    label: 'Mahasiswa',
    menu: [
      { label: 'Ringkasan', icon: 'grid' },
      { label: 'Tes TOEFL', icon: 'graduation' },
      { label: 'Kelas pelatihan', icon: 'book' },
      { label: 'Penerjemahan', icon: 'languages' },
      { label: 'Tagihan', icon: 'wallet' },
      { label: 'Presensi & EWS', icon: 'qr' },
      { label: 'Sertifikat', icon: 'award' },
    ],
  },
};

const ROLE_TO_DASHBOARD = {
  super_admin: 'superadmin',
  kepala_upt: 'admin',
  staf_upt: 'admin',
  pengajar: 'dosen',
  peserta: 'mahasiswa',
};

// Role yang belum punya dashboard sendiri (mis. penerjemah) sementara diarahkan ke dashboard pengguna.
export const dashboardKeyFor = (role) => ROLE_TO_DASHBOARD[role] ?? 'mahasiswa';
export const dashboardPathFor = (role) => DASHBOARDS[dashboardKeyFor(role)].path;
