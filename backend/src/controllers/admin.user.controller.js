import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper untuk catat audit log jika super admin melakukan perubahan
async function logAudit(idPengguna, aksi, entitas, idEntitas, detail, ip) {
  try {
    await prisma.audit_log.create({
      data: {
        id_pengguna: idPengguna,
        aksi,
        entitas,
        id_entitas: idEntitas ? String(idEntitas) : null,
        detail,
        alamat_ip: ip || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Audit log error (ignored):', err.message);
  }
}

/**
 * GET /api/admin/roles
 * Ambil semua master role
 */
export const getAllRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { id_role: 'asc' },
    });
    res.json({ data: roles });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data role', error: error.message });
  }
};

/**
 * GET /api/admin/users
 * Ambil daftar akun pengguna beserta statistik ringkas
 */
export const getAllUsers = async (req, res) => {
  try {
    const { search, role, status } = req.query;

    const where = {};

    // Filter status
    if (status === 'aktif') {
      where.status_aktif = true;
    } else if (status === 'nonaktif') {
      where.status_aktif = false;
    }

    // Filter role
    if (role && role !== 'all') {
      where.role = {
        nama_role: role,
      };
    }

    // Filter pencarian teks
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { nama_lengkap: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { nim: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [users, totalCount, activeCount, inactiveCount, roleCounts] = await Promise.all([
      prisma.pengguna.findMany({
        where,
        include: {
          role: true,
          role_ekstra: true,
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.pengguna.count(),
      prisma.pengguna.count({ where: { status_aktif: true } }),
      prisma.pengguna.count({ where: { status_aktif: false } }),
      prisma.role.findMany({
        select: {
          nama_role: true,
          _count: {
            select: { pengguna_utama: true },
          },
        },
      }),
    ]);

    // Format list pengguna agar aman (tanpa password_hash)
    const formattedUsers = users.map((u) => ({
      id_pengguna: u.id_pengguna,
      nama_lengkap: u.nama_lengkap,
      email: u.email,
      username: u.username,
      no_hp: u.no_hp,
      nim: u.nim,
      program_studi: u.program_studi,
      tipe_pengguna: u.tipe_pengguna,
      status_aktif: u.status_aktif,
      created_at: u.created_at,
      id_role: u.id_role,
      role: u.role?.nama_role,
      role_keterangan: u.role?.keterangan,
      id_role_ekstra: u.id_role_ekstra,
      role_ekstra: u.role_ekstra?.nama_role || null,
      role_ekstra_keterangan: u.role_ekstra?.keterangan || null,
    }));

    res.json({
      data: formattedUsers,
      stats: {
        total: totalCount,
        active: activeCount,
        inactive: inactiveCount,
        byRole: roleCounts.reduce((acc, curr) => {
          acc[curr.nama_role] = curr._count.pengguna_utama;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pengguna', error: error.message });
  }
};

/**
 * POST /api/admin/users
 * Buat akun baru oleh Super Admin
 */
export const createUser = async (req, res) => {
  try {
    const {
      nama_lengkap,
      email,
      username,
      password,
      no_hp,
      nim,
      program_studi,
      tipe_pengguna,
      id_role,
      id_role_ekstra,
      status_aktif,
    } = req.body;

    if (!nama_lengkap || !email || !password || !id_role) {
      return res.status(400).json({ message: 'Nama lengkap, email, password, dan role wajib diisi' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password minimal 8 karakter' });
    }

    // Cek email duplikat
    const existing = await prisma.pengguna.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email sudah terdaftar pada akun lain' });
    }

    // Cek username jika diisi
    if (username) {
      const existingUsername = await prisma.pengguna.findUnique({ where: { username } });
      if (existingUsername) {
        return res.status(409).json({ message: 'Username sudah digunakan' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.pengguna.create({
      data: {
        nama_lengkap,
        email,
        username: username || null,
        password_hash: passwordHash,
        no_hp: no_hp || null,
        nim: nim || null,
        program_studi: program_studi || null,
        tipe_pengguna: tipe_pengguna || 'mahasiswa',
        id_role: parseInt(id_role),
        id_role_ekstra: id_role_ekstra ? parseInt(id_role_ekstra) : null,
        status_aktif: status_aktif !== undefined ? Boolean(status_aktif) : true,
      },
      include: {
        role: true,
        role_ekstra: true,
      },
    });

    await logAudit(
      req.user.id,
      'BUAT_PENGGUNA',
      'pengguna',
      newUser.id_pengguna,
      `Membuat akun baru: ${newUser.email} (Role: ${newUser.role.nama_role})`,
      req.ip
    );

    res.status(201).json({
      message: 'Akun berhasil dibuat',
      data: {
        id_pengguna: newUser.id_pengguna,
        nama_lengkap: newUser.nama_lengkap,
        email: newUser.email,
        role: newUser.role.nama_role,
        role_ekstra: newUser.role_ekstra?.nama_role || null,
        status_aktif: newUser.status_aktif,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat pengguna', error: error.message });
  }
};

/**
 * PUT /api/admin/users/:id
 * Edit informasi akun & role pengguna
 */
export const updateUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      nama_lengkap,
      email,
      username,
      no_hp,
      nim,
      program_studi,
      tipe_pengguna,
      id_role,
      id_role_ekstra,
      status_aktif,
    } = req.body;

    const existing = await prisma.pengguna.findUnique({ where: { id_pengguna: id } });
    if (!existing) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    // Cek duplikasi email jika diganti
    if (email && email !== existing.email) {
      const emailUsed = await prisma.pengguna.findUnique({ where: { email } });
      if (emailUsed) return res.status(409).json({ message: 'Email sudah digunakan akun lain' });
    }

    // Cek username jika diganti
    if (username && username !== existing.username) {
      const usernameUsed = await prisma.pengguna.findUnique({ where: { username } });
      if (usernameUsed) return res.status(409).json({ message: 'Username sudah digunakan akun lain' });
    }

    const updated = await prisma.pengguna.update({
      where: { id_pengguna: id },
      data: {
        nama_lengkap: nama_lengkap || existing.nama_lengkap,
        email: email || existing.email,
        username: username !== undefined ? (username || null) : existing.username,
        no_hp: no_hp !== undefined ? (no_hp || null) : existing.no_hp,
        nim: nim !== undefined ? (nim || null) : existing.nim,
        program_studi: program_studi !== undefined ? (program_studi || null) : existing.program_studi,
        tipe_pengguna: tipe_pengguna || existing.tipe_pengguna,
        id_role: id_role ? parseInt(id_role) : existing.id_role,
        id_role_ekstra: id_role_ekstra === null || id_role_ekstra === ''
          ? null
          : (id_role_ekstra ? parseInt(id_role_ekstra) : existing.id_role_ekstra),
        status_aktif: status_aktif !== undefined ? Boolean(status_aktif) : existing.status_aktif,
      },
      include: {
        role: true,
        role_ekstra: true,
      },
    });

    await logAudit(
      req.user.id,
      'UPDATE_PENGGUNA',
      'pengguna',
      id,
      `Memperbarui profil/role pengguna: ${updated.email}`,
      req.ip
    );

    res.json({
      message: 'Data pengguna berhasil diperbarui',
      data: {
        id_pengguna: updated.id_pengguna,
        nama_lengkap: updated.nama_lengkap,
        email: updated.email,
        role: updated.role.nama_role,
        role_ekstra: updated.role_ekstra?.nama_role || null,
        status_aktif: updated.status_aktif,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui pengguna', error: error.message });
  }
};

/**
 * PATCH /api/admin/users/:id/status
 * Toggle status aktif / nonaktif
 */
export const toggleUserStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Anda tidak dapat menonaktifkan akun sendiri' });
    }

    const user = await prisma.pengguna.findUnique({ where: { id_pengguna: id } });
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });

    const newStatus = !user.status_aktif;
    await prisma.pengguna.update({
      where: { id_pengguna: id },
      data: { status_aktif: newStatus },
    });

    await logAudit(
      req.user.id,
      newStatus ? 'AKTIFKAN_PENGGUNA' : 'NONAKTIFKAN_PENGGUNA',
      'pengguna',
      id,
      `Mengubah status akun ${user.email} menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}`,
      req.ip
    );

    res.json({
      message: `Akun berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
      status_aktif: newStatus,
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengubah status pengguna', error: error.message });
  }
};

/**
 * PATCH /api/admin/users/:id/reset-password
 * Reset password akun oleh Super Admin
 */
export const resetUserPassword = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { password_baru } = req.body;

    if (!password_baru || password_baru.length < 8) {
      return res.status(400).json({ message: 'Password baru minimal 8 karakter' });
    }

    const user = await prisma.pengguna.findUnique({ where: { id_pengguna: id } });
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });

    const passwordHash = await bcrypt.hash(password_baru, 10);
    await prisma.pengguna.update({
      where: { id_pengguna: id },
      data: { password_hash: passwordHash },
    });

    await logAudit(
      req.user.id,
      'RESET_PASSWORD_ADMIN',
      'pengguna',
      id,
      `Mereset kata sandi akun ${user.email}`,
      req.ip
    );

    res.json({ message: 'Kata sandi berhasil diperbarui oleh admin' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mereset kata sandi', error: error.message });
  }
};

/**
 * DELETE /api/admin/users/:id
 * Hapus pengguna secara permanen
 */
export const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Anda tidak dapat menghapus akun sendiri' });
    }

    const user = await prisma.pengguna.findUnique({ where: { id_pengguna: id } });
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });

    // Hapus data pengguna
    await prisma.pengguna.delete({ where: { id_pengguna: id } });

    await logAudit(
      req.user.id,
      'HAPUS_PENGGUNA',
      'pengguna',
      id,
      `Menghapus pengguna: ${user.email} (${user.nama_lengkap})`,
      req.ip
    );

    res.json({ message: 'Akun pengguna berhasil dihapus' });
  } catch (error) {
    // Tangani jika ada foreign key constraint (misal sudah pernah mendaftar tes)
    if (error.code === 'P2003') {
      return res.status(400).json({
        message: 'Pengguna ini sudah memiliki riwayat pendaftaran/transaksi. Nonaktifkan akun saja daripada menghapusnya.',
      });
    }
    res.status(500).json({ message: 'Gagal menghapus pengguna', error: error.message });
  }
};
