import { Router } from 'express';
import { getKegiatanSaya, tambahKegiatan, ubahKegiatan, hapusKegiatan } from '../controllers/kegiatan.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Hanya saat sedang memakai role pengajar (role aktif di token)
const authorizePengajar = (req, res, next) => {
  if (req.user.role !== 'pengajar') {
    return res.status(403).json({ message: 'Akses ditolak, hanya untuk dosen/pengajar' });
  }
  next();
};

router.use(authenticate, authorizePengajar);
router.get('/', getKegiatanSaya);
router.post('/', tambahKegiatan);
router.put('/:id', ubahKegiatan);
router.delete('/:id', hapusKegiatan);

export default router;
