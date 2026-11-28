// Helper bersama untuk dashboard pelatihan (dosen & peserta).
import { fmtJam, fmtTanggal, namaHari, statusWaktu } from '../utils/waktu.js';

const AMBANG_EWS_DEFAULT = 75;

const bacaParamAngka = async (db, kunci, fallback) => {
  const p = await db.parameter_sistem.findUnique({ where: { kunci } });
  const n = Number(p?.nilai);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Ambang kehadiran EWS (%) dari parameter_sistem, default 75. */
export const ambangEws = (db) => bacaParamAngka(db, 'ambang_ews_persen', AMBANG_EWS_DEFAULT);

/** Bentuk respons satu pertemuan untuk dashboard. */
export const pertemuanRingkas = (p, now) => ({
  id_pertemuan: p.id_pertemuan,
  id_kelas: p.id_kelas,
  nama_kelas: p.kelas_pelatihan?.nama_kelas,
  pertemuan_ke: p.pertemuan_ke,
  tanggal: fmtTanggal(p.tanggal),
  hari: namaHari(p.tanggal),
  jam_mulai: fmtJam(p.jam_mulai),
  jam_selesai: fmtJam(p.jam_selesai),
  ruang: p.ruang,
  topik: p.topik,
  pengajar: p.pengajar?.nama_lengkap,
  status_presensi: p.status_presensi,
  status: statusWaktu(p, now),
});

/** Persentase dibulatkan, atau null jika penyebut 0. */
export const persen = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
