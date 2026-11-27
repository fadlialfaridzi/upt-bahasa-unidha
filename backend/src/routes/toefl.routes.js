import { Router } from 'express';
import {
  getAllJadwal, getJadwalById, daftarTes, getMyPendaftaran,
  getTagihanToeflPeserta,
  uploadBuktiToefl, updateStatusPendaftaran,
  getBuktiToefl,
  getAllSesi, getSesiById, createSesi, updateSesi, rilisSesi, deleteSesi,
  getKuotaToefl, updateKuotaSesi, getPendaftarSesi, rilisSesiDariKuota,
  ajukanOverrideToefl, getDaftarOverrideToefl, putusanOverrideToefl,
} from '../controllers/toefl.controller.js';
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/role.middleware.js';
import { uploadBukti } from '../middlewares/upload.middleware.js';

const router = Router();

// Public
router.get('/jadwal', getAllJadwal);
router.get('/jadwal/:id', getJadwalById);

// User - butuh login
router.post('/daftar', authenticate, daftarTes);
router.get('/my-pendaftaran', authenticate, getMyPendaftaran);
router.get('/tagihan', authenticate, getTagihanToeflPeserta);
router.post('/pembayaran/upload', authenticate, uploadBukti.single('bukti'), uploadBuktiToefl);
router.get('/pendaftaran/:id/bukti', authenticate, getBuktiToefl);

// Admin only
router.patch('/pendaftaran/:id/status', authenticate, authorizeAdmin, updateStatusPendaftaran);
router.get('/kuota', authenticate, authorizeAdmin, getKuotaToefl);
router.put('/sesi/:id/kuota', authenticate, authorizeAdmin, updateKuotaSesi);
router.get('/sesi/:id/pendaftar', authenticate, authorizeAdmin, getPendaftarSesi);
router.post('/sesi/:id/rilis-kuota', authenticate, authorizeAdmin, rilisSesiDariKuota);
router.post('/override', authenticate, authorizeRole('staf_upt'), ajukanOverrideToefl);

// Super Admin only
router.get('/override', authenticate, authorizeSuperAdmin, getDaftarOverrideToefl);
router.patch('/override/:id/putusan', authenticate, authorizeSuperAdmin, putusanOverrideToefl);

// Admin only - kelola sesi
router.get('/sesi', authenticate, authorizeAdmin, getAllSesi);
router.get('/sesi/:id', authenticate, authorizeAdmin, getSesiById);
router.post('/sesi', authenticate, authorizeAdmin, createSesi);
router.put('/sesi/:id', authenticate, authorizeAdmin, updateSesi);
router.post('/sesi/:id/rilis', authenticate, authorizeAdmin, rilisSesi);
router.delete('/sesi/:id', authenticate, authorizeAdmin, deleteSesi);

export default router;
