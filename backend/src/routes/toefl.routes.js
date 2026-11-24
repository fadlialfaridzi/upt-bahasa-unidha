import { Router } from 'express';
import {
  getAllJadwal,
  getJadwalById,
  getAllSesi,
  getSesiById,
  createSesi,
  updateSesi,
  rilisSesi,
  deleteSesi,
  daftarTes,
  getMyPendaftaran,
  updateStatusPendaftaran,
} from '../controllers/toefl.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public
router.get('/jadwal', getAllJadwal);
router.get('/jadwal/:id', getJadwalById);

// Peserta
router.post('/daftar', authenticate, daftarTes);
router.get('/my-pendaftaran', authenticate, getMyPendaftaran);
router.patch('/pendaftaran/:id/status', authenticate, authorizeAdmin, updateStatusPendaftaran);

// Admin - Kelola sesi TOEFL (#60)
router.get('/sesi', authenticate, authorizeAdmin, getAllSesi);
router.get('/sesi/:id', authenticate, authorizeAdmin, getSesiById);
router.post('/sesi', authenticate, authorizeAdmin, createSesi);
router.put('/sesi/:id', authenticate, authorizeAdmin, updateSesi);
router.post('/sesi/:id/rilis', authenticate, authorizeAdmin, rilisSesi);
router.delete('/sesi/:id', authenticate, authorizeAdmin, deleteSesi);

export default router;
