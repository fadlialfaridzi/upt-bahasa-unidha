import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_PESERTA = 'peserta';

const toUserResponse = (u) => ({
  id_pengguna: u.id_pengguna,
  nama_lengkap: u.nama_lengkap,
  nama: u.nama_lengkap, // alias sementara untuk frontend lama
  email: u.email,
  no_hp: u.no_hp,
  tipe_pengguna: u.tipe_pengguna,
  role: u.role.nama_role,
});

export const register = async (req, res) => {
  try {
    const { nama_lengkap, nama, email, password, no_hp, noHp, nim, program_studi, tipe_pengguna } = req.body;
    const namaLengkap = nama_lengkap || nama;

    if (!namaLengkap || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi' });
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
      include: { role: true },
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

    const user = await prisma.pengguna.findUnique({ where: { email }, include: { role: true } });
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }
    if (!user.status_aktif) {
      return res.status(403).json({ message: 'Akun dinonaktifkan' });
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
      include: { role: true },
    });
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    res.json({ data: { ...toUserResponse(user), created_at: user.created_at } });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil profil', error: error.message });
  }
};
