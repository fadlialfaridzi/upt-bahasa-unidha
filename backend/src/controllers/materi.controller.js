// Materi pembelajaran per kelas: dosen pengampu mengunggah/menghapus,
// admin & peserta terverifikasi kelas itu dapat melihat dan mengunduh.
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { aksesKelas as cekAkses, notifikasiPesertaKelas } from '../services/ruang-kelas.service.js';

export const MATERI_DIR = path.resolve('uploads', 'materi');
// Materi lama (sebelum folder khusus) tersimpan langsung di uploads/; tetap boleh diunduh & dihapus.
const UPLOAD_ROOT = path.resolve('uploads');
const dalamUploads = (file) => file.startsWith(UPLOAD_ROOT + path.sep);
export const MAKS_MB = 25;
const MAKS_JUDUL = 150;
export const EKSTENSI_MATERI = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.jpg', '.jpeg', '.png', '.zip', '.mp3', '.mp4'];

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Nama asli disimpan di nama berkas: "<timestamp>-<acak>-<nama-asli>" (tabel materi tidak punya kolom nama berkas).
const PREFIX_RE = /^\d+-\d+-/;
const namaAsli = (filePath) => path.basename(filePath).replace(PREFIX_RE, '');
const amankanNama = (nama) =>
  nama
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(-120) || 'materi';

const uploadMateri = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(MATERI_DIR, { recursive: true });
      cb(null, MATERI_DIR);
    },
    filename: (req, file, cb) => {
      // multer menerima nama berkas sebagai latin1; ubah ke UTF-8 agar nama berbahasa Indonesia tetap benar
      const asli = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${amankanNama(asli)}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (EKSTENSI_MATERI.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'tipe'));
  },
  limits: { fileSize: MAKS_MB * 1024 * 1024, files: 1 },
}).single('file');

/** Bungkus multer agar error unggah menjadi 400 dengan pesan yang jelas (bukan 500). */
export const terimaBerkasMateri = (req, res, next) =>
  uploadMateri(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: `Ukuran berkas maksimal ${MAKS_MB} MB` });
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: `Tipe berkas tidak didukung. Gunakan: ${EKSTENSI_MATERI.join(', ')}` });
    }
    next(err);
  });

const aksesKelas = (user, idKelas) => cekAkses(prisma, user, idKelas);

/** Middleware: pastikan pengguna adalah dosen pengampu kelas (sebelum berkas diterima). */
export const wajibPengampu = async (req, res, next) => {
  try {
    const idKelas = parseId(req.params.idKelas);
    if (!idKelas) return res.status(400).json({ message: 'ID kelas tidak valid' });
    if ((await aksesKelas(req.user, idKelas)) !== 'kelola') {
      return res.status(403).json({ message: 'Hanya dosen pengampu kelas ini yang dapat mengunggah materi' });
    }
    req.idKelas = idKelas;
    next();
  } catch (err) {
    next(err);
  }
};

const hapusBerkas = (filePath) => {
  const file = path.resolve(filePath);
  if (!dalamUploads(file)) return;
  try {
    fs.rmSync(file, { force: true });
  } catch (err) {
    console.error(`Gagal menghapus berkas materi ${file}:`, err.message);
  }
};

export const toResponse = (m) => {
  let ukuran = null;
  try {
    ukuran = fs.statSync(path.resolve(m.file_path)).size;
  } catch {
    // berkas hilang dari disk: tetap tampilkan entri, unduhan akan 404
  }
  return {
    id_materi: m.id_materi,
    judul: m.judul,
    nama_file: namaAsli(m.file_path),
    ekstensi: path.extname(m.file_path).slice(1).toLowerCase(),
    ukuran,
    tanggal_unggah: m.tanggal_unggah,
  };
};

// GET /api/materi/kelas/:idKelas
export const getMateriKelas = async (req, res, next) => {
  try {
    const idKelas = parseId(req.params.idKelas);
    if (!idKelas) return res.status(400).json({ message: 'ID kelas tidak valid' });
    const kelas = await prisma.kelas_pelatihan.findUnique({
      where: { id_kelas: idKelas },
      select: { id_kelas: true, nama_kelas: true, jenis_pelatihan: true, tipe_kelas: true, status: true },
    });
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    const akses = await aksesKelas(req.user, idKelas);
    if (!akses) return res.status(403).json({ message: 'Anda tidak memiliki akses ke materi kelas ini' });

    const materi = await prisma.materi.findMany({ where: { id_kelas: idKelas }, orderBy: { tanggal_unggah: 'desc' } });
    res.json({ data: { kelas, akses, materi: materi.map(toResponse), batas: { maks_mb: MAKS_MB, ekstensi: EKSTENSI_MATERI } } });
  } catch (err) {
    next(err);
  }
};

// POST /api/materi/kelas/:idKelas  (multipart: file, judul)
export const unggahMateri = async (req, res, next) => {
  const file = req.file;
  try {
    if (!file) return res.status(400).json({ message: 'Pilih berkas materi yang akan diunggah' });
    const judul = String(req.body?.judul ?? '').trim();
    if (judul.length < 3 || judul.length > MAKS_JUDUL) {
      hapusBerkas(file.path);
      return res.status(400).json({ message: `Judul materi wajib diisi (3–${MAKS_JUDUL} karakter)` });
    }
    const filePath = path.relative(process.cwd(), file.path).split(path.sep).join('/'); // "uploads/materi/..."
    const materi = await prisma.$transaction(async (tx) => {
      const m = await tx.materi.create({ data: { id_kelas: req.idKelas, judul, file_path: filePath } });
      await catatAudit(tx, req, { aksi: 'unggah_materi', entitas: 'materi', idEntitas: m.id_materi, detail: { id_kelas: req.idKelas, judul } });
      const kelas = await tx.kelas_pelatihan.findUnique({ where: { id_kelas: req.idKelas }, select: { nama_kelas: true } });
      await notifikasiPesertaKelas(tx, req.idKelas, { tipe: 'materi', judul: `Materi baru · ${kelas.nama_kelas}`, pesan: judul });
      return m;
    });
    res.status(201).json({ message: 'Materi berhasil diunggah', data: toResponse(materi) });
  } catch (err) {
    if (file) hapusBerkas(file.path);
    next(err);
  }
};

async function materiDenganAkses(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ message: 'ID materi tidak valid' });
    return {};
  }
  const m = await prisma.materi.findUnique({ where: { id_materi: id } });
  if (!m) {
    res.status(404).json({ message: 'Materi tidak ditemukan' });
    return {};
  }
  const akses = await aksesKelas(req.user, m.id_kelas);
  if (!akses) {
    res.status(403).json({ message: 'Anda tidak memiliki akses ke materi ini' });
    return {};
  }
  return { m, akses };
}

// GET /api/materi/:id/unduh
export const unduhMateri = async (req, res, next) => {
  try {
    const { m } = await materiDenganAkses(req, res);
    if (!m) return;
    const file = path.resolve(m.file_path);
    if (!dalamUploads(file) || !fs.existsSync(file)) {
      return res.status(404).json({ message: 'Berkas materi tidak ditemukan' });
    }
    res.set('Cache-Control', 'private, no-store');
    res.download(file, namaAsli(m.file_path));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/materi/:id
export const hapusMateri = async (req, res, next) => {
  try {
    const { m, akses } = await materiDenganAkses(req, res);
    if (!m) return;
    if (akses !== 'kelola') return res.status(403).json({ message: 'Hanya dosen pengampu yang dapat menghapus materi' });
    await prisma.$transaction(async (tx) => {
      await tx.materi.delete({ where: { id_materi: m.id_materi } });
      await catatAudit(tx, req, { aksi: 'hapus_materi', entitas: 'materi', idEntitas: m.id_materi, detail: { id_kelas: m.id_kelas, judul: m.judul } });
    });
    hapusBerkas(m.file_path);
    res.json({ message: 'Materi dihapus' });
  } catch (err) {
    next(err);
  }
};
