import { Router } from 'express';
import {
  getAllJadwal, getJadwalById, daftarTes, getMyPendaftaran,
  uploadBuktiToefl, updateStatusPendaftaran,
} from '../controllers/toefl.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';
import { uploadBukti } from '../middlewares/upload.middleware.js';

const router = Router();

// Public
router.get('/jadwal', getAllJadwal);
router.get('/jadwal/:id', getJadwalById);

// User - butuh login
router.post('/daftar', authenticate, daftarTes);
router.get('/my-pendaftaran', authenticate, getMyPendaftaran);
router.post('/pembayaran/upload', authenticate, uploadBukti.single('bukti'), uploadBuktiToefl);

// Admin only
router.patch('/pendaftaran/:id/status', authenticate, authorizeAdmin, updateStatusPendaftaran);

export default router;
