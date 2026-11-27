import { Router } from 'express';
import {
  getMateriKelas, unggahMateri, unduhMateri, hapusMateri, wajibPengampu, terimaBerkasMateri,
} from '../controllers/materi.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

// Materi pembelajaran: kelola oleh dosen pengampu; lihat/unduh oleh admin & peserta terverifikasi.
const router = Router();
router.use(authenticate);

router.get('/kelas/:idKelas', getMateriKelas);
router.post('/kelas/:idKelas', wajibPengampu, terimaBerkasMateri, unggahMateri);
router.get('/:id/unduh', unduhMateri);
router.delete('/:id', hapusMateri);

export default router;
