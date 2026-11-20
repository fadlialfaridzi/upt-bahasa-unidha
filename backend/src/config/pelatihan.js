// Aturan per tipe kelas pelatihan (enum tipe_kelas).
//  - kelas (reguler): selalu 20 pertemuan, 2-3 kali seminggu.
//  - intensif       : jumlah pertemuan & frekuensi menyesuaikan kebutuhan peserta.
export const ATURAN_TIPE_KELAS = {
  kelas: { jumlahPertemuan: 20, minHariPerMinggu: 2, maxPertemuanPerMinggu: 3 },
  intensif: { jumlahPertemuan: null, minHariPerMinggu: 1, maxPertemuanPerMinggu: null },
};

export const PRESET_POLA_HARI = [
  { id: 'kelas_1', label: 'Kelas 1 (Senin, Rabu, Jumat)', hari: [1, 3, 5] },
  { id: 'kelas_2', label: 'Kelas 2 (Selasa, Kamis, Sabtu)', hari: [2, 4, 6] },
];

export const PRESET_SESI = [
  { id: 'sesi_1', label: 'Sesi 1 (09.00 – 11.00)', jam_mulai: '09:00', jam_selesai: '11:00' },
  { id: 'sesi_2', label: 'Sesi 2 (13.30 – 15.30)', jam_mulai: '13:30', jam_selesai: '15:30' },
];

export const aturanTipe = (tipe) => ATURAN_TIPE_KELAS[tipe] ?? ATURAN_TIPE_KELAS.intensif;
