import { Router } from 'express';
import {
  getAllPelatihan,
  getPelatihanById,
  daftarPelatihan,
  getMyPelatihan,
  updateStatusPelatihan,
} from '../controllers/pelatihan.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public
router.get('/', getAllPelatihan);
router.get('/:id', getPelatihanById);

// User - butuh login
router.post('/daftar', authenticate, daftarPelatihan);
router.get('/my-pelatihan', authenticate, getMyPelatihan);

// Admin only
router.patch('/pendaftaran/:id/status', authenticate, authorizeAdmin, updateStatusPelatihan);

export default router;
