// Helper bersama ruang kelas (forum, materi): hak akses kelas & notifikasi ke peserta.
import { ADMIN_ROLES } from '../middlewares/auth.middleware.js';

/**
 * Hak akses pengguna pada satu kelas:
 * 'kelola' (dosen pengampu), 'lihat' (admin / peserta terverifikasi), atau null.
 */
export async function aksesKelas(db, user, idKelas) {
  if (user.role === 'pengajar') {
    const ngajar = await db.pertemuan_kelas.count({ where: { id_kelas: idKelas, id_pengajar: user.id } });
    return ngajar > 0 ? 'kelola' : null;
  }
  if (ADMIN_ROLES.includes(user.role)) return 'lihat';
  if (user.role === 'peserta') {
    const daftar = await db.pendaftaran_pelatihan.count({ where: { id_kelas: idKelas, id_pengguna: user.id, status: 'terverifikasi' } });
    return daftar > 0 ? 'lihat' : null;
  }
  return null;
}

const potong = (teks, maks) => (teks.length > maks ? `${teks.slice(0, maks - 1)}…` : teks);

/**
 * Kirim notifikasi ke semua peserta terverifikasi kelas (lonceng notifikasi).
 * `jenis` memakai format "kelas:<id_kelas>:<pengumuman|materi>" agar lonceng bisa membuka ruang kelasnya.
 */
export async function notifikasiPesertaKelas(db, idKelas, { tipe, judul, pesan }) {
  const peserta = await db.pendaftaran_pelatihan.findMany({
    where: { id_kelas: idKelas, status: 'terverifikasi' },
    select: { id_pengguna: true },
  });
  if (!peserta.length) return 0;
  await db.notifikasi.createMany({
    data: peserta.map((p) => ({
      id_pengguna: p.id_pengguna,
      jenis: `kelas:${idKelas}:${tipe}`,
      judul: potong(judul, 100),
      pesan: potong(pesan.replace(/\s+/g, ' ').trim(), 255),
    })),
  });
  return peserta.length;
}
