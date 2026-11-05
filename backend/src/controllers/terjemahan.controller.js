import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ajukanTerjemahan = async (req, res) => {
  try {
    const { judulDokumen, bahasaAsal, bahasaTujuan, catatan } = req.body;
    const filePath = req.file ? req.file.path : null;

    if (!judulDokumen || !bahasaAsal || !bahasaTujuan) {
      return res.status(400).json({ message: 'Judul dokumen, bahasa asal, dan bahasa tujuan wajib diisi' });
    }

    const terjemahan = await prisma.pengajuanTerjemahan.create({
      data: {
        userId: req.user.id,
        judulDokumen,
        bahasaAsal,
        bahasaTujuan,
        catatan,
        fileDokumen: filePath,
        status: 'MENUNGGU',
      },
    });

    res.status(201).json({ message: 'Pengajuan terjemahan berhasil', data: terjemahan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengajukan terjemahan', error: error.message });
  }
};

export const getMyTerjemahan = async (req, res) => {
  try {
    const terjemahan = await prisma.pengajuanTerjemahan.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: terjemahan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data terjemahan', error: error.message });
  }
};

export const getTerjemahanById = async (req, res) => {
  try {
    const terjemahan = await prisma.pengajuanTerjemahan.findUnique({
      where: { id: req.params.id },
    });
    if (!terjemahan) return res.status(404).json({ message: 'Data tidak ditemukan' });
    if (terjemahan.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Akses ditolak' });
    }
    res.json({ data: terjemahan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data terjemahan', error: error.message });
  }
};

export const updateStatusTerjemahan = async (req, res) => {
  try {
    const { status, estimasiSelesai, harga } = req.body;
    const terjemahan = await prisma.pengajuanTerjemahan.update({
      where: { id: req.params.id },
      data: { status, estimasiSelesai: estimasiSelesai ? new Date(estimasiSelesai) : undefined, harga },
    });
    res.json({ message: 'Status diperbarui', data: terjemahan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui status', error: error.message });
  }
};

export const uploadDokumen = async (req, res) => {
  try {
    const filePath = req.file ? req.file.path : null;
    if (!filePath) return res.status(400).json({ message: 'File hasil tidak ditemukan' });

    const terjemahan = await prisma.pengajuanTerjemahan.update({
      where: { id: req.params.id },
      data: { fileHasil: filePath, status: 'SELESAI' },
    });
    res.json({ message: 'File hasil berhasil diupload', data: terjemahan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal upload file', error: error.message });
  }
};
