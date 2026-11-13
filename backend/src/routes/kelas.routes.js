import { Router } from 'express';
import { getAllKelas, getKelasById, createKelas, updateKelas, deleteKelas } from '../controllers/kelas.controller.js';
import {
  getPertemuan, previewJadwal, tambahPertemuan, ubahPertemuan, hapusPertemuan, hapusPertemuanMassal, pengajarTersedia,
} from '../controllers/pertemuan.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Publik: daftar & detail kelas (filter: ?status=dibuka,berjalan&jenis=ielts)
router.get('/', getAllKelas);
router.get('/:id', getKelasById);

// Admin (staf_upt, kepala_upt, super_admin)
router.post('/', authenticate, authorizeAdmin, createKelas);
router.put('/:id', authenticate, authorizeAdmin, updateKelas);
router.delete('/:id', authenticate, authorizeAdmin, deleteKelas);

// Jadwal pertemuan kelas (#34 Plotting Jadwal Pengajar)
router.get('/:id/pertemuan', authenticate, getPertemuan);
router.post('/:id/pertemuan/preview', authenticate, authorizeAdmin, previewJadwal);
router.post('/:id/pertemuan/pengajar-tersedia', authenticate, authorizeAdmin, pengajarTersedia);
router.post('/:id/pertemuan', authenticate, authorizeAdmin, tambahPertemuan);
router.post('/:id/pertemuan/hapus', authenticate, authorizeAdmin, hapusPertemuanMassal);
router.put('/:id/pertemuan/:idp', authenticate, authorizeAdmin, ubahPertemuan);
router.delete('/:id/pertemuan/:idp', authenticate, authorizeAdmin, hapusPertemuan);

export default router;
