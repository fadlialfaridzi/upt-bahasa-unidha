import { Router } from 'express';
import { getRingkasanDosen, getJadwalMengajar } from '../controllers/dosen.controller.js';
import { listKelasNilai, getNilaiKelas, simpanNilaiKelas } from '../controllers/nilai.controller.js';
import {
  getKuesionerDosen,
  getAdminKuesioner,
  createPertanyaanKuesioner,
  updatePertanyaanKuesioner,
  urutkanPertanyaanKuesioner,
  deletePertanyaanKuesioner,
} from '../controllers/kuesioner.controller.js';
import { getRingkasanAdmin } from '../controllers/admin.pelatihan.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/role.middleware.js';

// Dashboard pelatihan dosen (#70): data milik dosen yang login
export const dosenRoutes = Router()
  .use(authenticate, authorizeRole('pengajar'))
  .get('/ringkasan', getRingkasanDosen)
  .get('/mengajar', getJadwalMengajar)
  .get('/nilai', listKelasNilai)
  .get('/nilai/:idKelas', getNilaiKelas)
  .put('/nilai/:idKelas', simpanNilaiKelas)
  .get('/kuesioner', getKuesionerDosen);
// Presensi & materi dosen ada di /api/presensi dan /api/materi

// Dashboard pelatihan admin (#69). Sengaja bukan di /api/admin (router itu khusus Super Admin).
export const adminPelatihanRoutes = Router()
  .use(authenticate, authorizeAdmin)
  .get('/ringkasan', getRingkasanAdmin)
  .get('/kuesioner', getAdminKuesioner)
  .post('/kuesioner', createPertanyaanKuesioner)
  .put('/kuesioner/urutan', urutkanPertanyaanKuesioner)
  .put('/kuesioner/:id', updatePertanyaanKuesioner)
  .delete('/kuesioner/:id', deletePertanyaanKuesioner);
