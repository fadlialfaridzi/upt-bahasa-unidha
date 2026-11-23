// Helper tanggal & jam untuk kolom @db.Date dan @db.Time (disimpan sebagai UTC agar tidak bergeser zona waktu).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** "2026-12-01" -> Date (UTC tengah malam), atau null jika tidak valid (termasuk 2026-02-30). */
export const parseTanggal = (value) => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? d : null;
};

/** "08:30" -> Date 1970-01-01T08:30Z, atau null jika tidak valid. */
export const parseJam = (value) =>
  typeof value === 'string' && TIME_RE.test(value) ? new Date(`1970-01-01T${value}:00.000Z`) : null;

export const fmtTanggal = (d) => d.toISOString().slice(0, 10);
export const fmtJam = (d) => d.toISOString().slice(11, 16);
export const menit = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();
export const namaHari = (d) => NAMA_HARI[d.getUTCDay()];
export const tambahHari = (d, n) => new Date(d.getTime() + n * 86400000);

/** Senin dari minggu yang memuat `tgl` (minggu dihitung Senin–Minggu). */
export const awalMinggu = (tgl) => tambahHari(tgl, -((tgl.getUTCDay() + 6) % 7));

/** Tanggal (UTC tengah malam) & menit-dalam-hari saat ini menurut WIB (UTC+7). */
export const sekarangWIB = () => {
  const d = new Date(Date.now() + 7 * 3600000);
  return {
    tanggal: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
    menit: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
};

/** Timestamp (mis. tanggal_daftar) -> tanggal kalender WIB sebagai Date UTC tengah malam. */
export const tanggalWIB = (d) => {
  const w = new Date(d.getTime() + 7 * 3600000);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
};

/** Status waktu pertemuan relatif terhadap `now` (dari sekarangWIB): 'selesai' | 'berlangsung' | 'akan_datang'. */
export const statusWaktu = (p, now) => {
  const t = p.tanggal.getTime();
  const hariIni = now.tanggal.getTime();
  if (t < hariIni) return 'selesai';
  if (t > hariIni) return 'akan_datang';
  if (menit(p.jam_selesai) <= now.menit) return 'selesai';
  if (menit(p.jam_mulai) <= now.menit) return 'berlangsung';
  return 'akan_datang';
};
