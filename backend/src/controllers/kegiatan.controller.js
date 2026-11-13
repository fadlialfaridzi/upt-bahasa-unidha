// Jadwal kegiatan dosen (#71 Pemilihan Jadwal Dosen).
// Dosen mencatat waktu ia TIDAK bisa mengajar di UPT; plotting jadwal hanya menawarkan dosen yang tersedia.
import prisma from '../lib/prisma.js';
import { NAMA_HARI, fmtJam, fmtTanggal, menit, parseJam, parseTanggal } from '../utils/waktu.js';

const MAX_RENTANG_HARI = 366;

const toResponse = (g) => ({
  id_kegiatan: g.id_kegiatan,
  judul: g.judul,
  hari: g.hari,
  nama_hari: NAMA_HARI[g.hari],
  jam_mulai: fmtJam(g.jam_mulai),
  jam_selesai: fmtJam(g.jam_selesai),
  tanggal_mulai: fmtTanggal(g.tanggal_mulai),
  tanggal_selesai: fmtTanggal(g.tanggal_selesai),
  jenis: g.tanggal_mulai.getTime() === g.tanggal_selesai.getTime() ? 'sekali' : 'rutin',
});

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Validasi input. Mengembalikan { rows, errors } dengan rows = data siap disimpan
 * (kegiatan rutin dengan beberapa hari menjadi beberapa baris).
 * Body rutin : { jenis: 'rutin', judul, hari: [1,3], tanggal_mulai, tanggal_selesai, jam_mulai, jam_selesai }
 * Body sekali: { jenis: 'sekali', judul, tanggal, jam_mulai, jam_selesai }
 */
const parseInput = (body, { satuHari = false } = {}) => {
  const errors = [];
  const judul = String(body.judul ?? '').trim();
  if (judul.length < 2 || judul.length > 100) errors.push('Nama kegiatan harus 2–100 karakter');

  const jam_mulai = parseJam(body.jam_mulai);
  const jam_selesai = parseJam(body.jam_selesai);
  if (!jam_mulai || !jam_selesai) errors.push('Jam harus berformat HH:MM');
  else if (menit(jam_mulai) >= menit(jam_selesai)) errors.push('Jam mulai harus sebelum jam selesai');

  let tanggal_mulai;
  let tanggal_selesai;
  let hari = [];

  if (body.jenis === 'sekali') {
    const tgl = parseTanggal(body.tanggal);
    if (!tgl) errors.push('Tanggal kegiatan tidak valid');
    else {
      tanggal_mulai = tgl;
      tanggal_selesai = tgl;
      hari = [tgl.getUTCDay()];
    }
  } else if (body.jenis === 'rutin') {
    tanggal_mulai = parseTanggal(body.tanggal_mulai);
    tanggal_selesai = parseTanggal(body.tanggal_selesai);
    hari = Array.isArray(body.hari) ? [...new Set(body.hari.map(Number))] : [];
    if (!hari.length || hari.some((h) => !Number.isInteger(h) || h < 0 || h > 6)) errors.push('Pilih minimal satu hari');
    if (satuHari && hari.length > 1) errors.push('Saat mengubah, pilih satu hari saja');
    if (!tanggal_mulai || !tanggal_selesai) errors.push('Periode berlaku tidak valid');
    else if (tanggal_mulai > tanggal_selesai) errors.push('Tanggal mulai berlaku harus sebelum tanggal selesai');
    else if ((tanggal_selesai - tanggal_mulai) / 86400000 > MAX_RENTANG_HARI) errors.push('Periode berlaku maksimal 1 tahun');
  } else {
    errors.push('Jenis kegiatan harus "rutin" atau "sekali"');
  }

  const rows = errors.length
    ? []
    : hari.map((h) => ({ judul, hari: h, jam_mulai, jam_selesai, tanggal_mulai, tanggal_selesai }));
  return { rows, errors };
};

/** Pertemuan UPT milik dosen yang bertumpuk dengan kegiatan baru (sebagai peringatan, bukan penolakan). */
const cariPertemuanTerdampak = async (id_pengajar, rows) => {
  if (!rows.length) return [];
  const mulai = new Date(Math.min(...rows.map((r) => r.tanggal_mulai.getTime())));
  const selesai = new Date(Math.max(...rows.map((r) => r.tanggal_selesai.getTime())));
  const pertemuan = await prisma.pertemuan_kelas.findMany({
    where: { id_pengajar, tanggal: { gte: mulai, lte: selesai }, kelas_pelatihan: { status: { not: 'dibatalkan' } } },
    include: { kelas_pelatihan: { select: { nama_kelas: true } } },
    orderBy: { tanggal: 'asc' },
  });
  return pertemuan
    .filter((p) =>
      rows.some(
        (r) =>
          r.hari === p.tanggal.getUTCDay() &&
          r.tanggal_mulai <= p.tanggal &&
          r.tanggal_selesai >= p.tanggal &&
          menit(r.jam_mulai) < menit(p.jam_selesai) &&
          menit(p.jam_mulai) < menit(r.jam_selesai)
      )
    )
    .map((p) => `${p.kelas_pelatihan.nama_kelas} pertemuan ${p.pertemuan_ke}, ${fmtTanggal(p.tanggal)} ${fmtJam(p.jam_mulai)}–${fmtJam(p.jam_selesai)}`);
};

const daftarMilik = (id_pengajar) =>
  prisma.kegiatan_dosen.findMany({
    where: { id_pengajar },
    orderBy: [{ tanggal_selesai: 'desc' }, { hari: 'asc' }, { jam_mulai: 'asc' }],
  });

// GET /api/kegiatan-dosen (dosen) - kegiatan milik sendiri
export const getKegiatanSaya = async (req, res) => {
  try {
    const list = await daftarMilik(req.user.id);
    res.json({ data: list.map(toResponse) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal kegiatan', error: error.message });
  }
};

// POST /api/kegiatan-dosen (dosen)
export const tambahKegiatan = async (req, res) => {
  try {
    const { rows, errors } = parseInput(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    await prisma.kegiatan_dosen.createMany({ data: rows.map((r) => ({ ...r, id_pengajar: req.user.id })) });
    const [list, terdampak] = await Promise.all([daftarMilik(req.user.id), cariPertemuanTerdampak(req.user.id, rows)]);
    res.status(201).json({
      message: rows.length > 1 ? `${rows.length} kegiatan rutin ditambahkan` : 'Kegiatan ditambahkan',
      data: list.map(toResponse),
      pertemuan_terdampak: terdampak,
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah kegiatan', error: error.message });
  }
};

// PUT /api/kegiatan-dosen/:id (dosen) - ubah satu kegiatan milik sendiri
export const ubahKegiatan = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const ada = id && (await prisma.kegiatan_dosen.findFirst({ where: { id_kegiatan: id, id_pengajar: req.user.id } }));
    if (!ada) return res.status(404).json({ message: 'Kegiatan tidak ditemukan' });

    const { rows, errors } = parseInput(req.body, { satuHari: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    await prisma.kegiatan_dosen.update({ where: { id_kegiatan: id }, data: rows[0] });
    const [list, terdampak] = await Promise.all([daftarMilik(req.user.id), cariPertemuanTerdampak(req.user.id, rows)]);
    res.json({ message: 'Kegiatan diperbarui', data: list.map(toResponse), pertemuan_terdampak: terdampak });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui kegiatan', error: error.message });
  }
};

// DELETE /api/kegiatan-dosen/:id (dosen)
export const hapusKegiatan = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { count } = id
      ? await prisma.kegiatan_dosen.deleteMany({ where: { id_kegiatan: id, id_pengajar: req.user.id } })
      : { count: 0 };
    if (!count) return res.status(404).json({ message: 'Kegiatan tidak ditemukan' });
    const list = await daftarMilik(req.user.id);
    res.json({ message: 'Kegiatan dihapus', data: list.map(toResponse) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus kegiatan', error: error.message });
  }
};
