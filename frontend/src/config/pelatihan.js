// Label & pilihan enum modul pelatihan (sesuai enum di backend/prisma/schema.prisma).

export const JENIS_PELATIHAN = {
  toefl_preparation: 'TOEFL Preparation',
  toefl: 'TOEFL',
  ielts: 'IELTS',
  conversation: 'Conversation',
};

export const TIPE_KELAS = {
  kelas: 'Kelas reguler',
  intensif: 'Kelas intensif',
};

// Sama dengan backend/src/config/pelatihan.js
export const ATURAN_TIPE_KELAS = {
  kelas: {
    jumlahPertemuan: 20,
    minHariPerMinggu: 2,
    maxPertemuanPerMinggu: 3,
    keterangan: 'Reguler: tetap 20 pertemuan, 2–3 kali seminggu.',
  },
  intensif: {
    jumlahPertemuan: null,
    minHariPerMinggu: 1,
    maxPertemuanPerMinggu: null,
    keterangan: 'Intensif: jumlah & frekuensi pertemuan menyesuaikan kebutuhan peserta.',
  },
};

export const STATUS_KELAS = {
  dibuka: { label: 'Dibuka', badge: 'badge-success' },
  berjalan: { label: 'Berjalan', badge: 'badge-accent' },
  selesai: { label: 'Selesai', badge: 'badge-muted' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

export const toOptions = (map) =>
  Object.entries(map).map(([value, v]) => ({ value, label: typeof v === 'string' ? v : v.label }));

export const formatRupiah = (value) =>
  `Rp${Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

// Tanggal dari kolom @db.Date dikirim sebagai ISO UTC tengah malam -> format dengan zona UTC agar tidak bergeser.
export const formatTanggal = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { ...opts, timeZone: 'UTC' }) : '—';

export const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');

// Urutan tampilan hari (Senin dulu); value = Date.getUTCDay()
export const HARI = [
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Min' },
];

export const STATUS_PRESENSI = {
  dibuka: { label: 'Presensi dibuka', badge: 'badge-success' },
  ditutup: { label: 'Presensi ditutup', badge: 'badge-muted' },
};

export const JENIS_BENTROK = { pengajar: 'Pengajar', kegiatan: 'Kegiatan dosen', ruang: 'Ruang', kelas: 'Kelas' };

export const todayInput = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
