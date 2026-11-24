import { Router } from 'express';
import {
  getAllJadwal,
  getJadwalById,
  daftarTes,
  getMyPendaftaran,
  updateStatusPendaftaran,
  getKuotaToefl,
  updateKuotaSesi,
  getPendaftarSesi,
  rilisSesiDariKuota,
} from '../controllers/toefl.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public
router.get('/jadwal', getAllJadwal);
router.get('/jadwal/:id', getJadwalById);

// User - butuh login
router.post('/daftar', authenticate, daftarTes);
router.get('/my-pendaftaran', authenticate, getMyPendaftaran);

// Admin only
router.patch('/pendaftaran/:id/status', authenticate, authorizeAdmin, updateStatusPendaftaran);

// Admin - Kelola kuota peserta TOEFL (#33)
router.get('/kuota', authenticate, authorizeAdmin, getKuotaToefl);
router.put('/sesi/:id/kuota', authenticate, authorizeAdmin, updateKuotaSesi);
router.get('/sesi/:id/pendaftar', authenticate, authorizeAdmin, getPendaftarSesi);
router.post('/sesi/:id/rilis', authenticate, authorizeAdmin, rilisSesiDariKuota);

export default router;
