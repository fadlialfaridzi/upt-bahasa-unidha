import { Router } from 'express';
import { getRuangKelas, buatPengumuman, ubahPengumuman, hapusPengumuman } from '../controllers/ruang-kelas.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

// Ruang kelas (forum ala Google Classroom). Hak akses dicek per kelas di controller.
const router = Router();
router.use(authenticate);

router.get('/:idKelas', getRuangKelas);
router.post('/:idKelas/pengumuman', buatPengumuman);
router.put('/pengumuman/:id', ubahPengumuman);
router.delete('/pengumuman/:id', hapusPengumuman);

export default router;
