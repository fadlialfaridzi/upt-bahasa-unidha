import { Router } from 'express';
import { getPengajar } from '../controllers/pertemuan.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Daftar pengajar aktif (role utama atau role ekstra "pengajar") untuk plotting jadwal
router.get('/', authenticate, authorizeAdmin, getPengajar);

export default router;
