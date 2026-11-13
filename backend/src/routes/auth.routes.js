import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  switchRole,
  grantRoleEkstra,
} from '../controllers/auth.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// ─── Publik ───────────────────────────────────────────────────────────────────
router.post('/register',         register);
router.post('/login',            login);

// ─── Reset Password (OTP) ─────────────────────────────────────────────────────
router.post('/forgot-password',  forgotPassword);
router.post('/verify-otp',       verifyOtp);
router.post('/reset-password',   resetPassword);

// ─── Butuh login ─────────────────────────────────────────────────────────────
router.get('/profile',           authenticate, getProfile);
router.post('/switch-role',      authenticate, switchRole);

// ─── Hanya super_admin ───────────────────────────────────────────────────────
router.post('/grant-role-ekstra', authenticate, authorizeAdmin, grantRoleEkstra);

export default router;
