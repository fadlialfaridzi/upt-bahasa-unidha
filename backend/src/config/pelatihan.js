// Aturan per tipe kelas pelatihan (enum tipe_kelas).
//  - kelas (reguler): selalu 20 pertemuan, 2-3 kali seminggu.
//  - intensif       : jumlah pertemuan & frekuensi menyesuaikan kebutuhan peserta.
export const ATURAN_TIPE_KELAS = {
  kelas: { jumlahPertemuan: 20, minHariPerMinggu: 2, maxPertemuanPerMinggu: 3 },
  intensif: { jumlahPertemuan: null, minHariPerMinggu: 1, maxPertemuanPerMinggu: null },
};

export const aturanTipe = (tipe) => ATURAN_TIPE_KELAS[tipe] ?? ATURAN_TIPE_KELAS.intensif;
