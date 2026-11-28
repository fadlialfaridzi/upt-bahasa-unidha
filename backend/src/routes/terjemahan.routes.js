import { Router } from 'express';
import {
  ajukanTerjemahan,
  getMyTerjemahan,
  getTerjemahanById,
  updateStatusTerjemahan,
  uploadDokumen,
} from '../controllers/terjemahan.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/role.middleware.js';
import { upload, uploadHasilTerjemahan } from '../middlewares/upload.middleware.js';
import {
  getDokumenAsliJobOrder,
  getHasilJobOrder,
  getJobOrderSaya,
  uploadHasilJobOrder,
  ubahStatusJobOrder,
} from '../controllers/job-order.controller.js';
import {
  ajukanRevisiTerjemahan,
  getPesananTerjemahanSaya,
  unduhHasilPesananSaya,
} from '../controllers/pesanan-terjemahan.controller.js';
import {
  getHasilTerjemahanUntukAdmin,
  unduhHasilTerjemahanUntukAdmin,
} from '../controllers/admin-hasil-terjemahan.controller.js';

const router = Router();

// User - butuh login
router.post('/ajukan', authenticate, upload.single('dokumen'), ajukanTerjemahan);
router.get('/my-terjemahan', authenticate, getMyTerjemahan);
router.get('/my-orders', authenticate, authorizeRole('peserta'), getPesananTerjemahanSaya);
router.get('/my-orders/:id/hasil', authenticate, authorizeRole('peserta'), unduhHasilPesananSaya);
router.post('/my-orders/:id/revisi', authenticate, authorizeRole('peserta'), ajukanRevisiTerjemahan);
router.get('/admin/orders', authenticate, authorizeAdmin, getHasilTerjemahanUntukAdmin);
router.get('/admin/orders/:id/hasil', authenticate, authorizeAdmin, unduhHasilTerjemahanUntukAdmin);

// Job order dapat dilihat dan dikelola dosen (pengajar) maupun akun penerjemah yang ditugaskan.
router.get('/job-orders', authenticate, authorizeRole('pengajar', 'penerjemah'), getJobOrderSaya);
router.get('/job-orders/:id/dokumen-asli', authenticate, authorizeRole('pengajar', 'penerjemah'), getDokumenAsliJobOrder);
router.get('/job-orders/:id/hasil', authenticate, authorizeRole('pengajar', 'penerjemah'), getHasilJobOrder);
router.post('/job-orders/:id/hasil', authenticate, authorizeRole('pengajar', 'penerjemah'), uploadHasilTerjemahan, uploadHasilJobOrder);
router.patch('/job-orders/:id/status', authenticate, authorizeRole('pengajar', 'penerjemah'), ubahStatusJobOrder);

router.get('/:id', authenticate, getTerjemahanById);

// Admin only
router.patch('/:id/status', authenticate, authorizeAdmin, updateStatusTerjemahan);
router.post('/:id/upload-hasil', authenticate, authorizeAdmin, upload.single('hasil'), uploadDokumen);

export default router;
