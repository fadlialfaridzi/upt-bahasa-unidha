import { Router } from 'express';
import { validasiSertifikat } from '../controllers/sertifikat.controller.js';

// Route publik untuk validasi sertifikat UPT Bahasa UNIDHA (tanpa autentikasi).
const router = Router();

router.get('/validasi', validasiSertifikat);
router.post('/validasi', validasiSertifikat);
router.get('/validasi/:kode', validasiSertifikat);

export default router;
