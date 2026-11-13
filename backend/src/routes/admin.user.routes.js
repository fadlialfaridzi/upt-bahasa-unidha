import { Router } from 'express';
import {
  getAllRoles,
  getAllUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
} from '../controllers/admin.user.controller.js';
import { authenticate, authorizeSuperAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Semua rute ini hanya dapat diakses oleh Super Admin
router.use(authenticate, authorizeSuperAdmin);

router.get('/roles', getAllRoles);
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', toggleUserStatus);
router.patch('/users/:id/reset-password', resetUserPassword);
router.delete('/users/:id', deleteUser);

export default router;
