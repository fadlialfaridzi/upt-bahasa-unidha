import { Router } from 'express';
import {
  getPresensiPertemuan, bukaPresensi, tutupPresensi, simpanPresensiManual,
} from '../controllers/presensi.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/role.middleware.js';

// Pencatatan presensi oleh dosen pengampu (QR per pertemuan + manual).
// Endpoint scan untuk peserta dibuat terpisah (lihat KONTRAK SCAN di presensi.controller.js).
const router = Router();
router.use(authenticate, authorizeRole('pengajar'));

router.get('/pertemuan/:id', getPresensiPertemuan);
router.put('/pertemuan/:id', simpanPresensiManual);
router.post('/pertemuan/:id/buka', bukaPresensi);
router.post('/pertemuan/:id/tutup', tutupPresensi);

export default router;
