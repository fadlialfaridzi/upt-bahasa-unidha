import { Router } from 'express';
import { getTagihanSaya, getBuktiTagihanSaya } from '../controllers/tagihan.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/role.middleware.js';

// Tagihan saya (peserta): TOEFL, pelatihan, dan penerjemahan dalam satu halaman.
const router = Router();
router.use(authenticate, authorizeRole('peserta'));

router.get('/saya', getTagihanSaya);
router.get('/:id/bukti', getBuktiTagihanSaya);

export default router;
