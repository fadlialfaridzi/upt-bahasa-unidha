import { Router } from 'express';
import { getRingkasanDosen, getJadwalMengajar } from '../controllers/dosen.controller.js';
import { getRingkasanAdmin } from '../controllers/admin.pelatihan.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/role.middleware.js';

// Dashboard pelatihan dosen (#70): data milik dosen yang login
export const dosenRoutes = Router()
  .use(authenticate, authorizeRole('pengajar'))
  .get('/ringkasan', getRingkasanDosen)
  .get('/mengajar', getJadwalMengajar);

// Dashboard pelatihan admin (#69). Sengaja bukan di /api/admin (router itu khusus Super Admin).
export const adminPelatihanRoutes = Router()
  .use(authenticate, authorizeAdmin)
  .get('/ringkasan', getRingkasanAdmin);
