// Pengecekan bentrok & ketersediaan jadwal pengajar.
// Dipakai Plotting Jadwal (#34) dan Pemilihan Jadwal Dosen (#71); dapat dipakai ulang untuk #14.
import { fmtJam, fmtTanggal, menit, tambahHari } from '../utils/waktu.js';

const MAX_HARI_POLA = 730; // batas pencarian tanggal saat membuat jadwal dari pola (2 tahun)

// Pengguna aktif yang ber-role pengajar (role utama maupun role ekstra).
export const wherePengajar = {
  status_aktif: true,
  OR: [{ role: { nama_role: 'pengajar' } }, { role_ekstra: { nama_role: 'pengajar' } }],
};

const normRuang = (r) => (r ?? '').trim().toLowerCase();

const jamTumpangTindih = (a, b) =>
  menit(a.jam_mulai) < menit(b.jam_selesai) && menit(b.jam_mulai) < menit(a.jam_selesai);

const tumpangTindih = (a, b) => a.tanggal.getTime() === b.tanggal.getTime() && jamTumpangTindih(a, b);

/** Apakah kegiatan dosen `g` berlaku & bertumpuk dengan slot { tanggal, jam_mulai, jam_selesai }. */
const kegiatanBertumpuk = (g, slot) =>
  g.hari === slot.tanggal.getUTCDay() &&
  g.tanggal_mulai.getTime() <= slot.tanggal.getTime() &&
  g.tanggal_selesai.getTime() >= slot.tanggal.getTime() &&
  jamTumpangTindih(g, slot);

const rentangJam = (x) => `${fmtJam(x.jam_mulai)}–${fmtJam(x.jam_selesai)}`;

/** Daftar tanggal dari pola mingguan: mulai `mulai`, hanya hari dalam `hari` (0=Min..6=Sab), sebanyak `jumlah`. */
export const tanggalDariPola = (mulai, hari, jumlah) => {
  const hasil = [];
  for (let i = 0; i < MAX_HARI_POLA && hasil.length < jumlah; i++) {
    const tgl = tambahHari(mulai, i);
    if (hari.includes(tgl.getUTCDay())) hasil.push(tgl);
  }
  return hasil;
};

/** Tanggal Senin dari minggu yang memuat `tgl` (minggu dihitung Senin–Minggu). */
const awalMinggu = (tgl) => tambahHari(tgl, -((tgl.getUTCDay() + 6) % 7));

/**
 * Cek batas jumlah pertemuan per minggu untuk satu kelas (mis. reguler maks 3x seminggu).
 * @param tanggalBaru  Date[] pertemuan yang akan ditambahkan / tanggal baru pertemuan yang diubah
 * @returns null jika aman, atau { minggu: 'YYYY-MM-DD' (Senin), jumlah } untuk minggu pertama yang melebihi
 */
export async function cekBatasMingguan(db, id_kelas, tanggalBaru, maks, { abaikanId = [] } = {}) {
  if (!maks || !tanggalBaru.length) return null;
  const ada = await db.pertemuan_kelas.findMany({
    where: { id_kelas, id_pertemuan: { notIn: abaikanId } },
    select: { tanggal: true },
  });
  const hitung = new Map();
  for (const t of [...ada.map((p) => p.tanggal), ...tanggalBaru]) {
    const kunci = fmtTanggal(awalMinggu(t));
    hitung.set(kunci, (hitung.get(kunci) ?? 0) + 1);
  }
  const lewat = [...hitung.entries()].filter(([, n]) => n > maks).sort(([a], [b]) => a.localeCompare(b));
  return lewat.length ? { minggu: lewat[0][0], jumlah: lewat[0][1] } : null;
}

const ambilPertemuan = (db, tanggal, abaikanId, extraWhere = {}) =>
  db.pertemuan_kelas.findMany({
    where: {
      tanggal: { in: tanggal },
      id_pertemuan: { notIn: abaikanId },
      kelas_pelatihan: { status: { not: 'dibatalkan' } },
      ...extraWhere,
    },
    include: {
      kelas_pelatihan: { select: { nama_kelas: true } },
      pengajar: { select: { nama_lengkap: true } },
    },
  });

const ambilKegiatan = (db, tanggal, extraWhere = {}) => {
  const waktu = tanggal.map((t) => t.getTime());
  return db.kegiatan_dosen.findMany({
    where: {
      tanggal_mulai: { lte: new Date(Math.max(...waktu)) },
      tanggal_selesai: { gte: new Date(Math.min(...waktu)) },
      ...extraWhere,
    },
  });
};

const tanggalUnik = (slots) => [...new Set(slots.map((s) => s.tanggal.getTime()))].map((t) => new Date(t));

/**
 * Cek bentrok untuk sekumpulan kandidat pertemuan.
 *
 * @param db        PrismaClient atau transaksi
 * @param kandidat  [{ id_kelas, tanggal: Date, jam_mulai: Date, jam_selesai: Date, ruang, id_pengajar }]
 * @param opsi.abaikanId  id_pertemuan yang diabaikan (mis. pertemuan yang sedang diubah)
 * @returns array sejajar dengan `kandidat`; tiap elemen berisi daftar { jenis, pesan }
 *          jenis: 'pengajar' | 'kegiatan' | 'ruang' | 'kelas'
 */
export async function cekBentrok(db, kandidat, { abaikanId = [] } = {}) {
  if (!kandidat.length) return [];

  const tanggal = tanggalUnik(kandidat);
  const idPengajar = [...new Set(kandidat.map((k) => k.id_pengajar))];
  const [jadwalAda, kegiatan, namaPengajar] = await Promise.all([
    ambilPertemuan(db, tanggal, abaikanId),
    ambilKegiatan(db, tanggal, { id_pengajar: { in: idPengajar } }),
    db.pengguna.findMany({ where: { id_pengguna: { in: idPengajar } }, select: { id_pengguna: true, nama_lengkap: true } }),
  ]);
  const nama = new Map(namaPengajar.map((p) => [p.id_pengguna, p.nama_lengkap]));

  return kandidat.map((k, i) => {
    const hasil = [];

    for (const e of jadwalAda) {
      if (!tumpangTindih(k, e)) continue;
      const ket = `${e.kelas_pelatihan.nama_kelas} pertemuan ${e.pertemuan_ke} (${rentangJam(e)})`;
      if (e.id_kelas === k.id_kelas) hasil.push({ jenis: 'kelas', pesan: `Bertumpuk dengan ${ket}` });
      if (e.id_pengajar === k.id_pengajar) hasil.push({ jenis: 'pengajar', pesan: `${e.pengajar.nama_lengkap} sudah mengajar ${ket}` });
      if (normRuang(k.ruang) && normRuang(k.ruang) === normRuang(e.ruang)) {
        hasil.push({ jenis: 'ruang', pesan: `${e.ruang} sudah dipakai ${ket}` });
      }
    }

    for (const g of kegiatan) {
      if (g.id_pengajar === k.id_pengajar && kegiatanBertumpuk(g, k)) {
        hasil.push({ jenis: 'kegiatan', pesan: `${nama.get(g.id_pengajar)} ada kegiatan "${g.judul}" (${rentangJam(g)})` });
      }
    }

    // Bentrok antar kandidat dalam satu pengajuan (mis. dua baris di tanggal & jam yang sama)
    kandidat.forEach((o, j) => {
      if (j === i || !tumpangTindih(k, o)) return;
      const samaKelas = o.id_kelas === k.id_kelas;
      const samaPengajar = o.id_pengajar === k.id_pengajar;
      const samaRuang = normRuang(k.ruang) && normRuang(k.ruang) === normRuang(o.ruang);
      if (samaKelas || samaPengajar || samaRuang) {
        hasil.push({ jenis: samaKelas ? 'kelas' : samaPengajar ? 'pengajar' : 'ruang', pesan: `Bertumpuk dengan baris lain pada ${fmtTanggal(o.tanggal)}` });
      }
    });

    return hasil;
  });
}

/**
 * Ketersediaan semua pengajar aktif untuk sekumpulan slot waktu.
 * Pengajar tidak tersedia jika pada salah satu slot ia punya kegiatan (kegiatan_dosen)
 * atau sudah mengajar pertemuan kelas lain.
 *
 * @param slots  [{ tanggal: Date, jam_mulai: Date, jam_selesai: Date }]
 * @returns [{ id_pengguna, nama_lengkap, email, tersedia, jumlah_bentrok, alasan: string[], sudah_isi_jadwal }]
 */
export async function ketersediaanPengajar(db, slots, { abaikanId = [] } = {}) {
  const pengajar = await db.pengguna.findMany({
    where: wherePengajar,
    select: { id_pengguna: true, nama_lengkap: true, email: true, _count: { select: { kegiatan_dosen: true } } },
    orderBy: { nama_lengkap: 'asc' },
  });
  if (!slots.length) {
    return pengajar.map(({ _count, ...p }) => ({ ...p, tersedia: true, jumlah_bentrok: 0, alasan: [], sudah_isi_jadwal: _count.kegiatan_dosen > 0 }));
  }

  const tanggal = tanggalUnik(slots);
  const ids = pengajar.map((p) => p.id_pengguna);
  const [jadwalAda, kegiatan] = await Promise.all([
    ambilPertemuan(db, tanggal, abaikanId, { id_pengajar: { in: ids } }),
    ambilKegiatan(db, tanggal, { id_pengajar: { in: ids } }),
  ]);

  return pengajar.map(({ _count, ...p }) => {
    const alasan = [];
    let jumlah = 0;
    for (const s of slots) {
      const tgl = fmtTanggal(s.tanggal);
      const mengajar = jadwalAda.find((e) => e.id_pengajar === p.id_pengguna && tumpangTindih(s, e));
      const sibuk = kegiatan.find((g) => g.id_pengajar === p.id_pengguna && kegiatanBertumpuk(g, s));
      if (mengajar || sibuk) jumlah++;
      if (mengajar) alasan.push(`${tgl}: mengajar ${mengajar.kelas_pelatihan.nama_kelas} (${rentangJam(mengajar)})`);
      if (sibuk) alasan.push(`${tgl}: ${sibuk.judul} (${rentangJam(sibuk)})`);
    }
    return {
      ...p,
      tersedia: jumlah === 0,
      jumlah_bentrok: jumlah,
      alasan: alasan.slice(0, 3),
      sudah_isi_jadwal: _count.kegiatan_dosen > 0,
    };
  });
}
