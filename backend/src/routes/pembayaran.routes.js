import { Router } from 'express';
import { getDaftarPembayaran, getBuktiPembayaran, verifikasiPembayaran } from '../controllers/pembayaran.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';

// Validasi pembayaran (#67) - Admin UPT & Super Admin
const router = Router();
router.use(authenticate, authorizeAdmin);

router.get('/', getDaftarPembayaran);
router.get('/:id/bukti', getBuktiPembayaran);
router.post('/:id/verifikasi', verifikasiPembayaran);

export default router;
