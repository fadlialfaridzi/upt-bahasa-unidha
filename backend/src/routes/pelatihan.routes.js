import { Router } from 'express';
import {
  getAllPelatihan,
  getPelatihanById,
  daftarPelatihan,
  getMyPelatihan,
  uploadBuktiPembayaran,
} from '../controllers/pelatihan.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { uploadBukti } from '../middlewares/upload.middleware.js';

const router = Router();

// Middleware opsional untuk mengambil info user jika token disertakan pada route publik
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  return authenticate(req, res, next);
};

// Publik & Mahasiswa
router.get('/', optionalAuth, getAllPelatihan);
router.get('/my-pendaftaran', authenticate, getMyPelatihan);
router.get('/:id', optionalAuth, getPelatihanById);

// Pendaftaran & Pembayaran Pelatihan
router.post('/daftar', authenticate, daftarPelatihan);
router.post('/pembayaran/upload', authenticate, uploadBukti.single('bukti'), uploadBuktiPembayaran);

export default router;
