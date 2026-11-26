import { Router } from 'express';
import {
  getRingkasanDosen,
  getJadwalMengajar,
  getPertemuanKelasDosen,
  bukaPresensiPertemuan,
  tutupPresensiPertemuan,
  manualPresensiPertemuan,
  uploadMateriKelas,
  deleteMateriKelas,
} from '../controllers/dosen.controller.js';
import { getRingkasanAdmin } from '../controllers/admin.pelatihan.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/role.middleware.js';
import { uploadMateri } from '../middlewares/upload.middleware.js';

// Dashboard pelatihan dosen (#70): data milik dosen yang login
export const dosenRoutes = Router()
  .use(authenticate, authorizeRole('pengajar'))
  .get('/ringkasan', getRingkasanDosen)
  .get('/mengajar', getJadwalMengajar)
  .get('/kelas/:id_kelas/pertemuan', getPertemuanKelasDosen)
  .post('/pertemuan/:id_pertemuan/buka-presensi', bukaPresensiPertemuan)
  .post('/pertemuan/:id_pertemuan/tutup-presensi', tutupPresensiPertemuan)
  .post('/pertemuan/:id_pertemuan/manual-presensi', manualPresensiPertemuan)
  .post('/kelas/:id_kelas/materi', uploadMateri.single('file'), uploadMateriKelas)
  .delete('/materi/:id_materi', deleteMateriKelas);

// Dashboard pelatihan admin (#69). Sengaja bukan di /api/admin (router itu khusus Super Admin).
export const adminPelatihanRoutes = Router()
  .use(authenticate, authorizeAdmin)
  .get('/ringkasan', getRingkasanAdmin);
