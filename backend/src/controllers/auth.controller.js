import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { sendMail, otpEmailTemplate } from '../utils/mailer.js';

const prisma = new PrismaClient();

const ROLE_PESERTA   = 'peserta';
// Role yang boleh Switch Role: pengajar <-> staf_upt
const SWITCH_ROLE_PAIRS = {
  pengajar: 'staf_upt',
  staf_upt: 'pengajar',
};

// ─── Helper ──────────────────────────────────────────────────────────────────

const toUserResponse = (u) => ({
  id_pengguna:   u.id_pengguna,
  nama_lengkap:  u.nama_lengkap,
  nama:          u.nama_lengkap,     // alias untuk frontend lama
  email:         u.email,
  no_hp:         u.no_hp,
  tipe_pengguna: u.tipe_pengguna,
  role:          u.role.nama_role,
  role_ekstra:   u.role_ekstra?.nama_role ?? null,
});

const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

// ─── Auth utama ───────────────────────────────────────────────────────────────

export const register = async (req, res) => {
  try {
    const { nama_lengkap, nama, email, password, no_hp, noHp, nim, program_studi, tipe_pengguna } = req.body;
    const namaLengkap = nama_lengkap || nama;

    if (!namaLengkap || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password minimal 8 karakter' });
    }

    const existing = await prisma.pengguna.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email sudah terdaftar' });
    }

    const user = await prisma.pengguna.create({
      data: {
        nama_lengkap: namaLengkap,
        email,
        password_hash: await bcrypt.hash(password, 10),
        no_hp: no_hp || noHp,
        nim,
        program_studi,
        tipe_pengguna,
        role: { connect: { nama_role: ROLE_PESERTA } },
      },
      include: { role: true, role_ekstra: true },
    });

    res.status(201).json({ message: 'Registrasi berhasil', data: toUserResponse(user) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan registrasi', error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi' });
    }

    const user = await prisma.pengguna.findUnique({
      where: { email },
      include: { role: true, role_ekstra: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }
    if (!user.status_aktif) {
      return res.status(403).json({ message: 'Akun dinonaktifkan. Hubungi admin UPT.' });
    }

    const token = jwt.sign(
      { id: user.id_pengguna, email: user.email, role: user.role.nama_role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ message: 'Login berhasil', token, data: toUserResponse(user) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan login', error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.pengguna.findUnique({
      where: { id_pengguna: req.user.id },
      include: { role: true, role_ekstra: true },
    });
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    res.json({ data: { ...toUserResponse(user), created_at: user.created_at } });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil profil', error: error.message });
  }
};

// ─── Reset Password via OTP ───────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * - Generate OTP 6 digit, simpan ke tabel otp_reset, kirim email
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email wajib diisi' });

    // Cek apakah email terdaftar
    const user = await prisma.pengguna.findUnique({ where: { email } });
    if (!user) {
      // Respons sama untuk mencegah email enumeration attack
      return res.json({ message: 'Jika email terdaftar, kode OTP akan dikirimkan.' });
    }

    // Nonaktifkan OTP lama yang belum dipakai
    await prisma.otp_reset.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    const kode = generateOtp();
    const expiredAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRES_MINUTES) || 10) * 60 * 1000);
    const menitBerlaku = parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;

    await prisma.otp_reset.create({
      data: { email, kode, expired_at: expiredAt },
    });

    // Kirim email
    const tmpl = otpEmailTemplate(user.nama_lengkap, kode, menitBerlaku);
    await sendMail({ to: email, toName: user.nama_lengkap, ...tmpl });

    res.json({ message: 'Kode OTP telah dikirim ke email Anda.' });
  } catch (error) {
    console.error('forgotPassword error:', error);
    res.status(500).json({ message: 'Gagal mengirim OTP', error: error.message });
  }
};

/**
 * POST /api/auth/verify-otp
 * Body: { email, kode }
 * - Validasi OTP, kembalikan reset_token sementara
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, kode } = req.body;
    if (!email || !kode) return res.status(400).json({ message: 'Email dan kode OTP wajib diisi' });

    const otp = await prisma.otp_reset.findFirst({
      where: { email, kode, used: false },
      orderBy: { created_at: 'desc' },
    });

    if (!otp) {
      return res.status(400).json({ message: 'Kode OTP tidak valid' });
    }
    if (new Date() > otp.expired_at) {
      return res.status(400).json({ message: 'Kode OTP sudah kadaluarsa. Minta kode baru.' });
    }

    // Tandai OTP sudah dipakai
    await prisma.otp_reset.update({ where: { id: otp.id }, data: { used: true } });

    // Buat reset_token (berlaku 15 menit) — dipakai di step berikutnya
    const resetToken = jwt.sign(
      { email, purpose: 'reset_password' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ message: 'OTP valid', reset_token: resetToken });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memverifikasi OTP', error: error.message });
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { reset_token, password_baru }
 * - Verifikasi reset_token, update password
 */
export const resetPassword = async (req, res) => {
  try {
    const { reset_token, password_baru } = req.body;
    if (!reset_token || !password_baru) {
      return res.status(400).json({ message: 'Token dan password baru wajib diisi' });
    }
    if (password_baru.length < 8) {
      return res.status(400).json({ message: 'Password minimal 8 karakter' });
    }

    let payload;
    try {
      payload = jwt.verify(reset_token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'Token tidak valid atau sudah kadaluarsa. Ulangi proses reset.' });
    }

    if (payload.purpose !== 'reset_password') {
      return res.status(400).json({ message: 'Token tidak valid' });
    }

    const user = await prisma.pengguna.findUnique({ where: { email: payload.email } });
    if (!user) return res.status(404).json({ message: 'Akun tidak ditemukan' });

    await prisma.pengguna.update({
      where: { email: payload.email },
      data: { password_hash: await bcrypt.hash(password_baru, 10) },
    });

    res.json({ message: 'Password berhasil diubah. Silakan login dengan password baru.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mereset password', error: error.message });
  }
};

// ─── Switch Role ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/switch-role
 * Header: Authorization Bearer <token>
 * Body: { target_role } — role yang ingin dipakai sementara
 *
 * Aturan:
 *  - Hanya pengajar (punya role_ekstra staf_upt) atau staf_upt (punya role_ekstra pengajar)
 *  - Pertama kali switch: super_admin perlu set role_ekstra via endpoint admin
 *  - Setelah switch, JWT baru diterbitkan dengan role yang dipilih
 */
export const switchRole = async (req, res) => {
  try {
    const { target_role } = req.body;
    if (!target_role) return res.status(400).json({ message: 'target_role wajib diisi' });

    const user = await prisma.pengguna.findUnique({
      where: { id_pengguna: req.user.id },
      include: { role: true, role_ekstra: true },
    });
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });

    const roleSaatIni  = user.role.nama_role;
    const roleEkstra   = user.role_ekstra?.nama_role;

    // Validasi: target_role harus merupakan salah satu dari role utama atau role ekstra
    const roleYangDiizinkan = [roleSaatIni, roleEkstra].filter(Boolean);
    if (!roleYangDiizinkan.includes(target_role)) {
      return res.status(403).json({
        message: `Anda tidak memiliki akses ke role '${target_role}'. Role yang tersedia: ${roleYangDiizinkan.join(', ')}`,
      });
    }
    if (target_role === roleSaatIni) {
      return res.status(400).json({ message: `Anda sudah menggunakan role '${target_role}'` });
    }

    // Tukar role utama <-> role ekstra di database
    const roleBaru  = await prisma.role.findUnique({ where: { nama_role: target_role } });
    const roelLama  = await prisma.role.findUnique({ where: { nama_role: roleSaatIni } });

    await prisma.pengguna.update({
      where: { id_pengguna: user.id_pengguna },
      data: {
        id_role:       roleBaru.id_role,
        id_role_ekstra: roelLama.id_role,
      },
    });

    // Terbitkan JWT baru dengan role yang baru
    const token = jwt.sign(
      { id: user.id_pengguna, email: user.email, role: target_role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const updatedUser = await prisma.pengguna.findUnique({
      where: { id_pengguna: user.id_pengguna },
      include: { role: true, role_ekstra: true },
    });

    res.json({
      message: `Berhasil beralih ke role '${target_role}'`,
      token,
      data: toUserResponse(updatedUser),
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan switch role', error: error.message });
  }
};

/**
 * POST /api/auth/grant-role-ekstra  (hanya super_admin)
 * Body: { id_pengguna, nama_role_ekstra }
 * - Super admin memberikan role ekstra ke pengguna tertentu
 */
export const grantRoleEkstra = async (req, res) => {
  try {
    const { id_pengguna, nama_role_ekstra } = req.body;
    if (!id_pengguna || !nama_role_ekstra) {
      return res.status(400).json({ message: 'id_pengguna dan nama_role_ekstra wajib diisi' });
    }

    const roleEkstra = await prisma.role.findUnique({ where: { nama_role: nama_role_ekstra } });
    if (!roleEkstra) return res.status(404).json({ message: 'Role tidak ditemukan' });

    const user = await prisma.pengguna.update({
      where: { id_pengguna: parseInt(id_pengguna) },
      data: { id_role_ekstra: roleEkstra.id_role },
      include: { role: true, role_ekstra: true },
    });

    res.json({ message: 'Role ekstra berhasil diberikan', data: toUserResponse(user) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memberikan role ekstra', error: error.message });
  }
};
