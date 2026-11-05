import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllJadwal = async (req, res) => {
  try {
    const jadwal = await prisma.jadwalToefl.findMany({
      where: { isActive: true },
      orderBy: { tanggal: 'asc' },
    });
    res.json({ data: jadwal });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal', error: error.message });
  }
};

export const getJadwalById = async (req, res) => {
  try {
    const jadwal = await prisma.jadwalToefl.findUnique({
      where: { id: req.params.id },
    });
    if (!jadwal) return res.status(404).json({ message: 'Jadwal tidak ditemukan' });
    res.json({ data: jadwal });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal', error: error.message });
  }
};

export const daftarTes = async (req, res) => {
  try {
    const { jadwalId } = req.body;

    const jadwal = await prisma.jadwalToefl.findUnique({ where: { id: jadwalId } });
    if (!jadwal) return res.status(404).json({ message: 'Jadwal tidak ditemukan' });
    if (jadwal.kuotaTerisi >= jadwal.kuota) {
      return res.status(400).json({ message: 'Kuota penuh' });
    }

    const existing = await prisma.pendaftaranToefl.findFirst({
      where: { userId: req.user.id, jadwalId },
    });
    if (existing) return res.status(409).json({ message: 'Anda sudah terdaftar di jadwal ini' });

    const pendaftaran = await prisma.pendaftaranToefl.create({
      data: { userId: req.user.id, jadwalId, status: 'MENUNGGU' },
    });

    await prisma.jadwalToefl.update({
      where: { id: jadwalId },
      data: { kuotaTerisi: { increment: 1 } },
    });

    res.status(201).json({ message: 'Pendaftaran berhasil', data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mendaftar', error: error.message });
  }
};

export const getMyPendaftaran = async (req, res) => {
  try {
    const pendaftaran = await prisma.pendaftaranToefl.findMany({
      where: { userId: req.user.id },
      include: { jadwal: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pendaftaran', error: error.message });
  }
};

export const updateStatusPendaftaran = async (req, res) => {
  try {
    const { status } = req.body;
    const pendaftaran = await prisma.pendaftaranToefl.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ message: 'Status diperbarui', data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui status', error: error.message });
  }
};
