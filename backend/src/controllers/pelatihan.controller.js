import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllPelatihan = async (req, res) => {
  try {
    const pelatihan = await prisma.pelatihan.findMany({
      where: { isActive: true },
      orderBy: { tanggalMulai: 'asc' },
    });
    res.json({ data: pelatihan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pelatihan', error: error.message });
  }
};

export const getPelatihanById = async (req, res) => {
  try {
    const pelatihan = await prisma.pelatihan.findUnique({
      where: { id: req.params.id },
    });
    if (!pelatihan) return res.status(404).json({ message: 'Pelatihan tidak ditemukan' });
    res.json({ data: pelatihan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pelatihan', error: error.message });
  }
};

export const daftarPelatihan = async (req, res) => {
  try {
    const { pelatihanId } = req.body;

    const pelatihan = await prisma.pelatihan.findUnique({ where: { id: pelatihanId } });
    if (!pelatihan) return res.status(404).json({ message: 'Pelatihan tidak ditemukan' });
    if (pelatihan.kuotaTerisi >= pelatihan.kuota) {
      return res.status(400).json({ message: 'Kuota penuh' });
    }

    const existing = await prisma.pendaftaranPelatihan.findFirst({
      where: { userId: req.user.id, pelatihanId },
    });
    if (existing) return res.status(409).json({ message: 'Anda sudah terdaftar di pelatihan ini' });

    const pendaftaran = await prisma.pendaftaranPelatihan.create({
      data: { userId: req.user.id, pelatihanId, status: 'MENUNGGU' },
    });

    await prisma.pelatihan.update({
      where: { id: pelatihanId },
      data: { kuotaTerisi: { increment: 1 } },
    });

    res.status(201).json({ message: 'Pendaftaran pelatihan berhasil', data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mendaftar pelatihan', error: error.message });
  }
};

export const getMyPelatihan = async (req, res) => {
  try {
    const pelatihan = await prisma.pendaftaranPelatihan.findMany({
      where: { userId: req.user.id },
      include: { pelatihan: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: pelatihan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pelatihan', error: error.message });
  }
};

export const updateStatusPelatihan = async (req, res) => {
  try {
    const { status } = req.body;
    const pendaftaran = await prisma.pendaftaranPelatihan.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ message: 'Status diperbarui', data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui status', error: error.message });
  }
};
