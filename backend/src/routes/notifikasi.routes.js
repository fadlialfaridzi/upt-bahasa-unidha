import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const data = await prisma.notifikasi.findMany({
      where: { id_pengguna: req.user.id },
      orderBy: { waktu: 'desc' },
      take: 30,
    });
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil notifikasi', error: error.message });
  }
});

router.patch('/:id/baca', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID notifikasi tidak valid' });
    const data = await prisma.notifikasi.updateMany({
      where: { id_notifikasi: id, id_pengguna: req.user.id },
      data: { sudah_dibaca: true },
    });
    if (!data.count) return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
    res.json({ message: 'Notifikasi ditandai telah dibaca' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui notifikasi', error: error.message });
  }
});

router.patch('/baca-semua', async (req, res) => {
  try {
    await prisma.notifikasi.updateMany({
      where: { id_pengguna: req.user.id, sudah_dibaca: false },
      data: { sudah_dibaca: true },
    });
    res.json({ message: 'Semua notifikasi ditandai telah dibaca' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui notifikasi', error: error.message });
  }
});

export default router;
