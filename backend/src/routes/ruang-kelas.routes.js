import { Router } from 'express';
import { getRuangKelas, buatPengumuman, ubahPengumuman, hapusPengumuman } from '../controllers/ruang-kelas.controller.js';
import { getKuesionerRuangKelas, simpanKuesionerPeserta } from '../controllers/kuesioner.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

// Ruang kelas (forum ala Google Classroom). Hak akses dicek per kelas di controller.
const router = Router();
router.use(authenticate);

router.get('/:idKelas', getRuangKelas);
router.get('/:idKelas/kuesioner', getKuesionerRuangKelas);
router.post('/:idKelas/kuesioner', simpanKuesionerPeserta);
router.post('/:idKelas/pengumuman', buatPengumuman);
router.put('/pengumuman/:id', ubahPengumuman);
router.delete('/pengumuman/:id', hapusPengumuman);

export default router;
