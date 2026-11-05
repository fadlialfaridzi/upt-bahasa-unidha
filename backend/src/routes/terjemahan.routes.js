import { Router } from 'express';
import {
  ajukanTerjemahan,
  getMyTerjemahan,
  getTerjemahanById,
  updateStatusTerjemahan,
  uploadDokumen,
} from '../controllers/terjemahan.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = Router();

// User - butuh login
router.post('/ajukan', authenticate, upload.single('dokumen'), ajukanTerjemahan);
router.get('/my-terjemahan', authenticate, getMyTerjemahan);
router.get('/:id', authenticate, getTerjemahanById);

// Admin only
router.patch('/:id/status', authenticate, authorizeAdmin, updateStatusTerjemahan);
router.post('/:id/upload-hasil', authenticate, authorizeAdmin, upload.single('hasil'), uploadDokumen);

export default router;
