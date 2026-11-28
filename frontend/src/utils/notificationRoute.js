import { dashboardPathFor } from '../config/roles.js';

/**
 * Menentukan rute tujuan ketika pengguna mengklik item notifikasi pada topbar dashboard.
 * Aman terhadap payload notifikasi yang tidak lengkap (null/undefined/field kosong).
 */
export function resolveNotificationTarget(item, role) {
  const jenis = typeof item?.jenis === 'string' ? item.jenis : '';
  const judul = typeof item?.judul === 'string' ? item.judul : '';
  const isAdmin = role === 'staf_upt';

  // Notifikasi override kuota TOEFL (Issue #80)
  if (jenis === 'override_toefl') {
    if (role === 'super_admin') return '/dashboard/super-admin/override-toefl';
    if (role === 'staf_upt') return '/dashboard/admin/toefl/kuota';
    return role ? dashboardPathFor(role) : '/dashboard/mahasiswa';
  }

  // Notifikasi ruang kelas: jenis 'kelas:<id_kelas>:<pengumuman|materi>'
  const kelasNotif = /^kelas:(\d+):/.exec(jenis);
  if (kelasNotif) {
    return `/dashboard/mahasiswa/kelas/${kelasNotif[1]}`;
  }

  // Notifikasi penerjemahan
  if (jenis.startsWith('terjemahan_')) {
    if (role === 'pengajar') return '/dashboard/dosen/penerjemahan';
    if (role === 'penerjemah') return '/dashboard/penerjemah';
    return '/dashboard/mahasiswa/terjemahan';
  }

  // Notifikasi pembayaran TOEFL
  if (jenis === 'pembayaran_toefl') {
    return isAdmin ? '/dashboard/admin/toefl/pembayaran' : '/dashboard/mahasiswa/toefl?mode=lanjut';
  }

  // Notifikasi pembayaran / verifikasi umum
  const isPaymentNotification = jenis === 'pembayaran'
    || judul.includes('verifikasi')
    || judul.includes('pembayaran');
  if (isPaymentNotification) {
    return isAdmin ? '/dashboard/admin/pembayaran' : '/dashboard/mahasiswa/tagihan';
  }

  return '/dashboard/mahasiswa';
}

export function resolveNotificationIcon(item) {
  const jenis = typeof item?.jenis === 'string' ? item.jenis : '';
  if (jenis === 'override_toefl') return 'shield';
  if (jenis.startsWith('terjemahan_')) return 'languages';
  if (jenis.startsWith('kelas:')) {
    if (jenis.endsWith(':materi')) return 'book';
    if (jenis.endsWith(':nilai')) return 'clipboard';
    return 'megaphone';
  }
  return 'wallet';
}
