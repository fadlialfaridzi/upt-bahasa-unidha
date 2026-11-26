import { Router } from 'express';
import {
  getAllPelatihan,
  getPelatihanById,
  daftarPelatihan,
  getMyPelatihan,
  uploadBuktiPembayaran,
  getMyKelasMateri,
  scanPresensiMahasiswa,
  getMyPresensiEws,
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
router.get('/my-kelas-materi', authenticate, getMyKelasMateri);
router.get('/my-presensi-ews', authenticate, getMyPresensiEws);
router.get('/:id', optionalAuth, getPelatihanById);

// Pendaftaran, Pembayaran & Presensi Pelatihan
router.post('/daftar', authenticate, daftarPelatihan);
router.post('/pembayaran/upload', authenticate, uploadBukti.single('bukti'), uploadBuktiPembayaran);
router.post('/presensi/scan', authenticate, scanPresensiMahasiswa);

export default router;
