import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { cekBatasMingguan, cekBentrok, ketersediaanPengajar, tanggalDariPola, wherePengajar } from '../services/jadwal.service.js';
import { aturanTipe } from '../config/pelatihan.js';
import { fmtJam, fmtTanggal, menit, namaHari, parseJam, parseTanggal } from '../utils/waktu.js';

const includePertemuan = {
  pengajar: { select: { id_pengguna: true, nama_lengkap: true } },
  _count: { select: { presensi: true } },
};

const toResponse = (p) => ({
  id_pertemuan: p.id_pertemuan,
  id_kelas: p.id_kelas,
  pertemuan_ke: p.pertemuan_ke,
  tanggal: fmtTanggal(p.tanggal),
  hari: namaHari(p.tanggal),
  jam_mulai: fmtJam(p.jam_mulai),
  jam_selesai: fmtJam(p.jam_selesai),
  ruang: p.ruang,
  topik: p.topik,
  status_presensi: p.status_presensi,
  pengajar: { id_pengguna: p.pengajar.id_pengguna, nama_lengkap: p.pengajar.nama_lengkap },
  jumlah_presensi: p._count.presensi,
});

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const pengajarValid = async (ids) => {
  const unik = [...new Set(ids)];
  const ada = await prisma.pengguna.findMany({ where: { ...wherePengajar, id_pengguna: { in: unik } }, select: { id_pengguna: true } });
  const set = new Set(ada.map((p) => p.id_pengguna));
  return unik.filter((id) => !set.has(id));
};

/** Ambil kelas + validasi bisa dijadwalkan. Mengembalikan { kelas } atau { status, message }. */
const ambilKelas = async (rawId, { untukUbah = false } = {}) => {
  const id = parseId(rawId);
  if (!id) return { status: 400, message: 'ID kelas tidak valid' };
  const kelas = await prisma.kelas_pelatihan.findUnique({
    where: { id_kelas: id },
    include: { _count: { select: { pertemuan_kelas: true } } },
  });
  if (!kelas) return { status: 404, message: 'Kelas tidak ditemukan' };
  if (untukUbah && ['selesai', 'dibatalkan'].includes(kelas.status)) {
    return { status: 409, message: `Jadwal kelas berstatus "${kelas.status}" tidak dapat diubah` };
  }
  return { kelas };
};

/** Validasi satu baris jadwal. Mengembalikan { data, errors }. */
const parseItem = (body, label = '') => {
  const errors = [];
  const pre = label ? `${label}: ` : '';
  const tanggal = parseTanggal(body.tanggal);
  const jam_mulai = parseJam(body.jam_mulai);
  const jam_selesai = parseJam(body.jam_selesai);
  const id_pengajar = Number(body.id_pengajar);

  if (!tanggal) errors.push(`${pre}Tanggal tidak valid (YYYY-MM-DD)`);
  if (!jam_mulai || !jam_selesai) errors.push(`${pre}Jam harus berformat HH:MM`);
  else if (menit(jam_mulai) >= menit(jam_selesai)) errors.push(`${pre}Jam mulai harus sebelum jam selesai`);
  if (!Number.isInteger(id_pengajar) || id_pengajar <= 0) errors.push(`${pre}Pengajar wajib dipilih`);

  const ruang = body.ruang == null ? null : String(body.ruang).trim() || null;
  const topik = body.topik == null ? null : String(body.topik).trim() || null;
  if (ruang && ruang.length > 50) errors.push(`${pre}Ruang maksimal 50 karakter`);
  if (topik && topik.length > 150) errors.push(`${pre}Topik maksimal 150 karakter`);

  return { data: { tanggal, jam_mulai, jam_selesai, id_pengajar, ruang, topik }, errors };
};

/**
 * Urutkan ulang pertemuan_ke berdasarkan tanggal & jam (1, 2, 3, ...).
 * Dua tahap (negatif dulu) agar tidak melanggar unique (id_kelas, pertemuan_ke).
 */
const urutkanUlang = async (tx, id_kelas) => {
  const rows = await tx.pertemuan_kelas.findMany({
    where: { id_kelas },
    orderBy: [{ tanggal: 'asc' }, { jam_mulai: 'asc' }, { id_pertemuan: 'asc' }],
    select: { id_pertemuan: true, pertemuan_ke: true },
  });
  let berubah = false;
  for (const [i, r] of rows.entries()) {
    if (r.pertemuan_ke !== i + 1) {
      berubah = true;
      await tx.pertemuan_kelas.update({ where: { id_pertemuan: r.id_pertemuan }, data: { pertemuan_ke: -(i + 1) } });
    }
  }
  if (berubah) {
    await tx.$executeRaw`UPDATE "pertemuan_kelas" SET "pertemuan_ke" = -"pertemuan_ke" WHERE "id_kelas" = ${id_kelas} AND "pertemuan_ke" < 0`;
  }
};

const daftarPertemuan = (id_kelas, db = prisma) =>
  db.pertemuan_kelas.findMany({
    where: { id_kelas },
    include: includePertemuan,
    orderBy: [{ tanggal: 'asc' }, { jam_mulai: 'asc' }],
  });

/** Pesan error jika jadwal melanggar batas pertemuan per minggu (kelas reguler), atau null. */
const cekFrekuensi = async (kelas, tanggalBaru, abaikanId = []) => {
  const { maxPertemuanPerMinggu } = aturanTipe(kelas.tipe_kelas);
  const lewat = await cekBatasMingguan(prisma, kelas.id_kelas, tanggalBaru, maxPertemuanPerMinggu, { abaikanId });
  return lewat
    ? `Kelas reguler maksimal ${maxPertemuanPerMinggu} pertemuan per minggu (minggu mulai ${lewat.minggu}: ${lewat.jumlah} pertemuan)`
    : null;
};

const ringkasBentrok = (hasil) =>
  hasil.flatMap((list, index) => list.map((b) => ({ index, ...b })));

// ─── Handler ───────────────────────────────────────────────────────────────

// GET /api/pengajar (admin) - daftar pengajar untuk dropdown
export const getPengajar = async (req, res) => {
  try {
    const list = await prisma.pengguna.findMany({
      where: wherePengajar,
      select: { id_pengguna: true, nama_lengkap: true, email: true },
      orderBy: { nama_lengkap: 'asc' },
    });
    res.json({ data: list });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar pengajar', error: error.message });
  }
};

// POST /api/kelas/:id/pertemuan/pengajar-tersedia (admin)
// Body satu pertemuan : { tanggal, jam_mulai, jam_selesai, abaikan_id? }
// Body pola mingguan  : { tanggal_mulai, hari: [1,3], jumlah, jam_mulai, jam_selesai }
// -> daftar pengajar + status tersedia (berdasarkan kegiatan dosen & jadwal mengajar lain)
export const pengajarTersedia = async (req, res) => {
  try {
    const { kelas, status, message } = await ambilKelas(req.params.id);
    if (!kelas) return res.status(status).json({ message });

    const jam_mulai = parseJam(req.body.jam_mulai);
    const jam_selesai = parseJam(req.body.jam_selesai);
    if (!jam_mulai || !jam_selesai || menit(jam_mulai) >= menit(jam_selesai)) {
      return res.status(400).json({ message: 'Jam tidak valid' });
    }

    let tanggal = [];
    if (req.body.tanggal_mulai !== undefined) {
      const mulai = parseTanggal(req.body.tanggal_mulai);
      const hari = Array.isArray(req.body.hari) ? req.body.hari.map(Number).filter((h) => h >= 0 && h <= 6) : [];
      const jumlah = Math.min(Number(req.body.jumlah) || 0, kelas.jumlah_pertemuan);
      if (!mulai || !hari.length || jumlah < 1) return res.status(400).json({ message: 'Pola jadwal tidak lengkap' });
      tanggal = tanggalDariPola(mulai, hari, jumlah);
    } else {
      const tgl = parseTanggal(req.body.tanggal);
      if (!tgl) return res.status(400).json({ message: 'Tanggal tidak valid' });
      tanggal = [tgl];
    }

    const abaikanId = parseId(req.body.abaikan_id) ? [parseId(req.body.abaikan_id)] : [];
    const list = await ketersediaanPengajar(prisma, tanggal.map((t) => ({ tanggal: t, jam_mulai, jam_selesai })), { abaikanId });
    res.json({ data: list, jumlah_tanggal: tanggal.length });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memeriksa ketersediaan pengajar', error: error.message });
  }
};

// GET /api/kelas/:id/pertemuan
export const getPertemuan = async (req, res) => {
  try {
    const { kelas, status, message } = await ambilKelas(req.params.id);
    if (!kelas) return res.status(status).json({ message });
    const list = await daftarPertemuan(kelas.id_kelas);
    res.json({ data: list.map(toResponse) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal', error: error.message });
  }
};

// POST /api/kelas/:id/pertemuan/preview (admin)
// Body: { tanggal_mulai, hari: [1,3], jam_mulai, jam_selesai, ruang, id_pengajar, jumlah }
export const previewJadwal = async (req, res) => {
  try {
    const { kelas, status, message } = await ambilKelas(req.params.id, { untukUbah: true });
    if (!kelas) return res.status(status).json({ message });

    const sisa = kelas.jumlah_pertemuan - kelas._count.pertemuan_kelas;
    const errors = [];
    const mulai = parseTanggal(req.body.tanggal_mulai);
    if (!mulai) errors.push('Tanggal mulai tidak valid');
    const hari = Array.isArray(req.body.hari) ? [...new Set(req.body.hari.map(Number))] : [];
    if (!hari.length || hari.some((h) => !Number.isInteger(h) || h < 0 || h > 6)) errors.push('Pilih minimal satu hari');
    else {
      const { minHariPerMinggu, maxPertemuanPerMinggu } = aturanTipe(kelas.tipe_kelas);
      if (maxPertemuanPerMinggu && (hari.length < minHariPerMinggu || hari.length > maxPertemuanPerMinggu)) {
        errors.push(`Kelas reguler: pilih ${minHariPerMinggu} atau ${maxPertemuanPerMinggu} hari per minggu`);
      }
    }
    const jumlah = Number(req.body.jumlah);
    if (sisa <= 0) errors.push(`Semua ${kelas.jumlah_pertemuan} pertemuan sudah dijadwalkan`);
    else if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > sisa) errors.push(`Jumlah pertemuan harus 1–${sisa}`);

    const { data: template, errors: itemErrors } = parseItem({ ...req.body, tanggal: req.body.tanggal_mulai });
    errors.push(...itemErrors.filter((e) => !e.startsWith('Tanggal')));
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const salahPengajar = await pengajarValid([template.id_pengajar]);
    if (salahPengajar.length) return res.status(400).json({ message: 'Pengajar tidak ditemukan atau tidak aktif' });

    const kandidat = tanggalDariPola(mulai, hari, jumlah).map((tgl) => ({ ...template, tanggal: tgl, id_kelas: kelas.id_kelas }));

    const bentrok = await cekBentrok(prisma, kandidat);
    res.json({
      data: kandidat.map((k, i) => ({
        tanggal: fmtTanggal(k.tanggal),
        hari: namaHari(k.tanggal),
        jam_mulai: fmtJam(k.jam_mulai),
        jam_selesai: fmtJam(k.jam_selesai),
        ruang: k.ruang,
        topik: k.topik,
        id_pengajar: k.id_pengajar,
        bentrok: bentrok[i],
      })),
      sisa,
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat pratinjau jadwal', error: error.message });
  }
};

// POST /api/kelas/:id/pertemuan (admin)
// Body: { items: [{ tanggal, jam_mulai, jam_selesai, ruang, id_pengajar, topik }] } atau satu objek pertemuan
export const tambahPertemuan = async (req, res) => {
  try {
    const { kelas, status, message } = await ambilKelas(req.params.id, { untukUbah: true });
    if (!kelas) return res.status(status).json({ message });

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [req.body];
    const sisa = kelas.jumlah_pertemuan - kelas._count.pertemuan_kelas;
    if (!rawItems.length) return res.status(400).json({ message: 'Tidak ada pertemuan yang disimpan' });
    if (rawItems.length > sisa) {
      return res.status(400).json({ message: `Melebihi jumlah pertemuan kelas. Sisa yang bisa dijadwalkan: ${Math.max(sisa, 0)}` });
    }

    const items = [];
    const errors = [];
    rawItems.forEach((raw, i) => {
      const { data, errors: e } = parseItem(raw ?? {}, rawItems.length > 1 ? `Baris ${i + 1}` : '');
      errors.push(...e);
      items.push({ ...data, id_kelas: kelas.id_kelas });
    });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const pesanMingguan = await cekFrekuensi(kelas, items.map((it) => it.tanggal));
    if (pesanMingguan) return res.status(400).json({ message: pesanMingguan });

    const salahPengajar = await pengajarValid(items.map((it) => it.id_pengajar));
    if (salahPengajar.length) return res.status(400).json({ message: 'Pengajar tidak ditemukan atau tidak aktif' });

    const bentrok = ringkasBentrok(await cekBentrok(prisma, items));
    if (bentrok.length) {
      return res.status(409).json({ message: `Terdapat ${bentrok.length} bentrok jadwal: ${bentrok[0].pesan}`, bentrok });
    }

    const list = await prisma.$transaction(async (tx) => {
      // pertemuan_ke sementara (di atas angka yang mungkin dipakai), lalu diurutkan ulang
      await tx.pertemuan_kelas.createMany({
        data: items.map(({ id_kelas, ...it }, i) => ({ ...it, id_kelas, pertemuan_ke: 1000 + i })),
      });
      await urutkanUlang(tx, kelas.id_kelas);
      await catatAudit(tx, req, {
        aksi: 'tambah_jadwal',
        entitas: 'kelas_pelatihan',
        idEntitas: kelas.id_kelas,
        detail: { jumlah: items.length, tanggal: items.map((it) => fmtTanggal(it.tanggal)) },
      });
      return daftarPertemuan(kelas.id_kelas, tx);
    });

    res.status(201).json({ message: `${items.length} pertemuan berhasil dijadwalkan`, data: list.map(toResponse) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menyimpan jadwal', error: error.message });
  }
};

// PUT /api/kelas/:id/pertemuan/:idp (admin) - ubah sebagian field
export const ubahPertemuan = async (req, res) => {
  try {
    const { kelas, status, message } = await ambilKelas(req.params.id, { untukUbah: true });
    if (!kelas) return res.status(status).json({ message });
    const idp = parseId(req.params.idp);
    const lama = idp && (await prisma.pertemuan_kelas.findFirst({
      where: { id_pertemuan: idp, id_kelas: kelas.id_kelas },
      include: includePertemuan,
    }));
    if (!lama) return res.status(404).json({ message: 'Pertemuan tidak ditemukan' });

    const gabung = {
      tanggal: req.body.tanggal ?? fmtTanggal(lama.tanggal),
      jam_mulai: req.body.jam_mulai ?? fmtJam(lama.jam_mulai),
      jam_selesai: req.body.jam_selesai ?? fmtJam(lama.jam_selesai),
      id_pengajar: req.body.id_pengajar ?? lama.id_pengajar,
      ruang: req.body.ruang !== undefined ? req.body.ruang : lama.ruang,
      topik: req.body.topik !== undefined ? req.body.topik : lama.topik,
    };
    const { data, errors } = parseItem(gabung);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const waktuBerubah =
      data.tanggal.getTime() !== lama.tanggal.getTime() ||
      menit(data.jam_mulai) !== menit(lama.jam_mulai) ||
      menit(data.jam_selesai) !== menit(lama.jam_selesai);
    if (waktuBerubah && (lama.status_presensi || lama._count.presensi)) {
      return res.status(409).json({ message: 'Tanggal/jam tidak bisa diubah karena presensi pertemuan ini sudah dibuka' });
    }

    if (data.tanggal.getTime() !== lama.tanggal.getTime()) {
      const pesanMingguan = await cekFrekuensi(kelas, [data.tanggal], [idp]);
      if (pesanMingguan) return res.status(400).json({ message: pesanMingguan });
    }

    if (data.id_pengajar !== lama.id_pengajar && (await pengajarValid([data.id_pengajar])).length) {
      return res.status(400).json({ message: 'Pengajar tidak ditemukan atau tidak aktif' });
    }

    const bentrok = ringkasBentrok(await cekBentrok(prisma, [{ ...data, id_kelas: kelas.id_kelas }], { abaikanId: [idp] }));
    if (bentrok.length) {
      return res.status(409).json({ message: `Jadwal bentrok: ${bentrok[0].pesan}`, bentrok });
    }

    const list = await prisma.$transaction(async (tx) => {
      await tx.pertemuan_kelas.update({ where: { id_pertemuan: idp }, data });
      if (waktuBerubah) await urutkanUlang(tx, kelas.id_kelas);
      await catatAudit(tx, req, {
        aksi: 'ubah_jadwal',
        entitas: 'pertemuan_kelas',
        idEntitas: idp,
        detail: {
          id_kelas: kelas.id_kelas,
          tanggal: fmtTanggal(data.tanggal),
          pengajar_lama: lama.id_pengajar,
          pengajar_baru: data.id_pengajar,
        },
      });
      return daftarPertemuan(kelas.id_kelas, tx);
    });

    res.json({ message: 'Pertemuan berhasil diperbarui', data: list.map(toResponse) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui pertemuan', error: error.message });
  }
};

// POST /api/kelas/:id/pertemuan/hapus (admin) - hapus massal
// Body: { ids: [id_pertemuan, ...] }. Semua-atau-tidak sama sekali: ditolak jika ada yang tidak valid.
export const hapusPertemuanMassal = async (req, res) => {
  try {
    const { kelas, status, message } = await ambilKelas(req.params.id, { untukUbah: true });
    if (!kelas) return res.status(status).json({ message });

    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map(Number))] : [];
    if (!ids.length || ids.some((i) => !Number.isInteger(i) || i <= 0)) {
      return res.status(400).json({ message: 'Pilih minimal satu pertemuan yang akan dihapus' });
    }

    const target = await prisma.pertemuan_kelas.findMany({
      where: { id_pertemuan: { in: ids }, id_kelas: kelas.id_kelas },
      include: includePertemuan,
    });
    if (target.length !== ids.length) {
      return res.status(404).json({ message: 'Sebagian pertemuan tidak ditemukan di kelas ini. Muat ulang halaman.' });
    }
    const terkunci = target.filter((p) => p.status_presensi || p._count.presensi);
    if (terkunci.length) {
      return res.status(409).json({
        message: `Pertemuan ke-${terkunci.map((p) => p.pertemuan_ke).join(', ')} sudah dibuka presensinya dan tidak dapat dihapus`,
      });
    }

    const list = await prisma.$transaction(async (tx) => {
      await tx.pertemuan_kelas.deleteMany({ where: { id_pertemuan: { in: ids } } });
      await urutkanUlang(tx, kelas.id_kelas);
      await catatAudit(tx, req, {
        aksi: 'hapus_jadwal_massal',
        entitas: 'kelas_pelatihan',
        idEntitas: kelas.id_kelas,
        detail: { jumlah: ids.length, tanggal: target.map((p) => fmtTanggal(p.tanggal)) },
      });
      return daftarPertemuan(kelas.id_kelas, tx);
    });

    res.json({ message: `${ids.length} pertemuan berhasil dihapus`, data: list.map(toResponse) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus pertemuan', error: error.message });
  }
};

// DELETE /api/kelas/:id/pertemuan/:idp (admin)
export const hapusPertemuan = async (req, res) => {
  try {
    const { kelas, status, message } = await ambilKelas(req.params.id, { untukUbah: true });
    if (!kelas) return res.status(status).json({ message });
    const idp = parseId(req.params.idp);
    const p = idp && (await prisma.pertemuan_kelas.findFirst({
      where: { id_pertemuan: idp, id_kelas: kelas.id_kelas },
      include: includePertemuan,
    }));
    if (!p) return res.status(404).json({ message: 'Pertemuan tidak ditemukan' });
    if (p.status_presensi || p._count.presensi) {
      return res.status(409).json({ message: 'Pertemuan yang presensinya sudah dibuka tidak dapat dihapus' });
    }

    const list = await prisma.$transaction(async (tx) => {
      await tx.pertemuan_kelas.delete({ where: { id_pertemuan: idp } });
      await urutkanUlang(tx, kelas.id_kelas);
      await catatAudit(tx, req, {
        aksi: 'hapus_jadwal',
        entitas: 'pertemuan_kelas',
        idEntitas: idp,
        detail: { id_kelas: kelas.id_kelas, tanggal: fmtTanggal(p.tanggal), pertemuan_ke: p.pertemuan_ke },
      });
      return daftarPertemuan(kelas.id_kelas, tx);
    });

    res.json({ message: 'Pertemuan berhasil dihapus', data: list.map(toResponse) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus pertemuan', error: error.message });
  }
};
