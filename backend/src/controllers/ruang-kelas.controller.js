// Ruang kelas ala Google Classroom: forum (pengumuman + materi berurutan waktu), daftar pertemuan
// beserta presensi, dan peserta. Dosen pengampu menulis pengumuman; peserta terverifikasi & admin membaca.
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { sekarangWIB } from '../utils/waktu.js';
import { persen, pertemuanRingkas } from '../services/pelatihan.service.js';
import { aksesKelas, notifikasiPesertaKelas } from '../services/ruang-kelas.service.js';
import { EKSTENSI_MATERI, MAKS_MB, toResponse as materiResponse } from './materi.controller.js';

const MAKS_ISI = 2000;

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const pengumumanResponse = (p, akses) => ({
  tipe: 'pengumuman',
  id: p.id_pengumuman,
  isi: p.isi,
  waktu: p.dibuat_pada,
  diubah: p.diperbarui_pada.getTime() - p.dibuat_pada.getTime() > 60000 ? p.diperbarui_pada : null,
  penulis: { id: p.pengajar.id_pengguna, nama: p.pengajar.nama_lengkap },
  bisa_kelola: akses === 'kelola',
});

/** Validasi isi pengumuman; kirim 400 dan kembalikan null bila tidak valid. */
function bacaIsi(req, res) {
  const isi = String(req.body?.isi ?? '').replace(/\r\n/g, '\n').trim();
  if (!isi) {
    res.status(400).json({ message: 'Isi pengumuman tidak boleh kosong' });
    return null;
  }
  if (isi.length > MAKS_ISI) {
    res.status(400).json({ message: `Pengumuman maksimal ${MAKS_ISI} karakter` });
    return null;
  }
  return isi;
}

// GET /api/ruang-kelas/:idKelas
export const getRuangKelas = async (req, res, next) => {
  try {
    const idKelas = parseId(req.params.idKelas);
    if (!idKelas) return res.status(400).json({ message: 'ID kelas tidak valid' });
    const kelas = await prisma.kelas_pelatihan.findUnique({
      where: { id_kelas: idKelas },
      select: { id_kelas: true, nama_kelas: true, jenis_pelatihan: true, tipe_kelas: true, status: true, jumlah_pertemuan: true, tanggal_mulai: true },
    });
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    const akses = await aksesKelas(prisma, req.user, idKelas);
    if (!akses) return res.status(403).json({ message: 'Anda tidak terdaftar di kelas ini' });

    const pesertaSaya = req.user.role === 'peserta'
      ? await prisma.pendaftaran_pelatihan.findFirst({
          where: { id_kelas: idKelas, id_pengguna: req.user.id, status: 'terverifikasi' },
          select: { id_pendaftaran: true, nilai_pretest: true, nilai_akhir: true },
        })
      : null;

    const [pengumuman, materi, pertemuan, peserta] = await Promise.all([
      prisma.pengumuman_kelas.findMany({
        where: { id_kelas: idKelas },
        include: { pengajar: { select: { id_pengguna: true, nama_lengkap: true } } },
        orderBy: { dibuat_pada: 'desc' },
      }),
      prisma.materi.findMany({ where: { id_kelas: idKelas }, orderBy: { tanggal_unggah: 'desc' } }),
      prisma.pertemuan_kelas.findMany({
        where: { id_kelas: idKelas },
        orderBy: { pertemuan_ke: 'asc' },
        include: {
          pengajar: { select: { id_pengguna: true, nama_lengkap: true } },
          _count: { select: { presensi: { where: { status: 'hadir' } } } },
          presensi: pesertaSaya ? { where: { id_pendaftaran: pesertaSaya.id_pendaftaran }, select: { status: true, waktu_scan: true } } : false,
        },
      }),
      prisma.pendaftaran_pelatihan.findMany({
        where: { id_kelas: idKelas, status: 'terverifikasi' },
        select: {
          id_pendaftaran: true,
          nilai_pretest: true,
          nilai_akhir: true,
          pengguna: { select: { nama_lengkap: true, nim: true, program_studi: true } },
        },
        orderBy: { pengguna: { nama_lengkap: 'asc' } },
      }),
    ]);

    const now = sekarangWIB();
    const daftarPertemuan = pertemuan.map((p) => ({
      ...pertemuanRingkas(p, now),
      hadir: p._count.presensi,
      milik_saya: p.id_pengajar === req.user.id,
      kehadiran_saya: pesertaSaya ? (p.presensi[0]?.status ?? null) : undefined,
    }));
    const pengajar = [...new Map(pertemuan.map((p) => [p.pengajar.id_pengguna, p.pengajar.nama_lengkap])).entries()]
      .map(([id, nama]) => ({ id, nama }));

    // Kehadiran peserta yang login: dihitung dari pertemuan yang sesi presensinya sudah dibuka/ditutup
    let kehadiranSaya = null;
    if (pesertaSaya) {
      const sesi = daftarPertemuan.filter((p) => p.status_presensi);
      kehadiranSaya = { hadir: sesi.filter((p) => p.kehadiran_saya === 'hadir').length, sesi: sesi.length };
      kehadiranSaya.persen = persen(kehadiranSaya.hadir, kehadiranSaya.sesi);
    }

    const stream = [
      ...pengumuman.map((p) => pengumumanResponse(p, akses)),
      ...materi.map((m) => ({ tipe: 'materi', id: m.id_materi, waktu: m.tanggal_unggah, materi: materiResponse(m) })),
    ].sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

    res.json({
      data: {
        kelas,
        akses,
        pengajar,
        berikutnya: daftarPertemuan.find((p) => p.status !== 'selesai') ?? null,
        pertemuan: daftarPertemuan,
        stream,
        ringkasan: {
          peserta: peserta.length,
          materi: materi.length,
          pengumuman: pengumuman.length,
          pertemuan_selesai: daftarPertemuan.filter((p) => p.status === 'selesai').length,
        },
        kehadiran_saya: kehadiranSaya,
        nilai_saya: pesertaSaya
          ? {
              nilai_pretest: pesertaSaya.nilai_pretest !== null ? Number(pesertaSaya.nilai_pretest) : null,
              nilai_akhir: pesertaSaya.nilai_akhir !== null ? Number(pesertaSaya.nilai_akhir) : null,
            }
          : null,
        batas_materi: { maks_mb: MAKS_MB, ekstensi: EKSTENSI_MATERI },
        // Daftar peserta hanya untuk dosen pengampu & admin
        peserta: req.user.role === 'peserta'
          ? null
          : peserta.map((d) => ({
              id_pendaftaran: d.id_pendaftaran,
              nama_lengkap: d.pengguna.nama_lengkap,
              nim: d.pengguna.nim,
              program_studi: d.pengguna.program_studi,
              nilai_pretest: d.nilai_pretest !== null ? Number(d.nilai_pretest) : null,
              nilai_akhir: d.nilai_akhir !== null ? Number(d.nilai_akhir) : null,
            })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/ruang-kelas/:idKelas/pengumuman  body: { isi }
export const buatPengumuman = async (req, res, next) => {
  try {
    const idKelas = parseId(req.params.idKelas);
    if (!idKelas) return res.status(400).json({ message: 'ID kelas tidak valid' });
    if ((await aksesKelas(prisma, req.user, idKelas)) !== 'kelola') {
      return res.status(403).json({ message: 'Hanya dosen pengampu kelas ini yang dapat membuat pengumuman' });
    }
    const isi = bacaIsi(req, res);
    if (isi === null) return;

    const { pengumuman, terkirim } = await prisma.$transaction(async (tx) => {
      const p = await tx.pengumuman_kelas.create({
        data: { id_kelas: idKelas, id_pengajar: req.user.id, isi },
        include: { pengajar: { select: { id_pengguna: true, nama_lengkap: true } }, kelas_pelatihan: { select: { nama_kelas: true } } },
      });
      const n = await notifikasiPesertaKelas(tx, idKelas, { tipe: 'pengumuman', judul: `Pengumuman · ${p.kelas_pelatihan.nama_kelas}`, pesan: isi });
      await catatAudit(tx, req, { aksi: 'buat_pengumuman_kelas', entitas: 'pengumuman_kelas', idEntitas: p.id_pengumuman, detail: { id_kelas: idKelas, notifikasi: n } });
      return { pengumuman: p, terkirim: n };
    });
    res.status(201).json({
      message: terkirim ? `Pengumuman diposting dan dikirim ke ${terkirim} peserta` : 'Pengumuman diposting',
      data: pengumumanResponse(pengumuman, 'kelola'),
    });
  } catch (err) {
    next(err);
  }
};

async function pengumumanUntukDikelola(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ message: 'ID pengumuman tidak valid' });
    return null;
  }
  const p = await prisma.pengumuman_kelas.findUnique({ where: { id_pengumuman: id } });
  if (!p) {
    res.status(404).json({ message: 'Pengumuman tidak ditemukan' });
    return null;
  }
  if ((await aksesKelas(prisma, req.user, p.id_kelas)) !== 'kelola') {
    res.status(403).json({ message: 'Hanya dosen pengampu kelas ini yang dapat mengubah pengumuman' });
    return null;
  }
  return p;
}

// PUT /api/ruang-kelas/pengumuman/:id  body: { isi }
export const ubahPengumuman = async (req, res, next) => {
  try {
    const p = await pengumumanUntukDikelola(req, res);
    if (!p) return;
    const isi = bacaIsi(req, res);
    if (isi === null) return;
    const baru = await prisma.$transaction(async (tx) => {
      const u = await tx.pengumuman_kelas.update({
        where: { id_pengumuman: p.id_pengumuman },
        data: { isi },
        include: { pengajar: { select: { id_pengguna: true, nama_lengkap: true } } },
      });
      await catatAudit(tx, req, { aksi: 'ubah_pengumuman_kelas', entitas: 'pengumuman_kelas', idEntitas: p.id_pengumuman });
      return u;
    });
    res.json({ message: 'Pengumuman diperbarui', data: pengumumanResponse(baru, 'kelola') });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/ruang-kelas/pengumuman/:id
export const hapusPengumuman = async (req, res, next) => {
  try {
    const p = await pengumumanUntukDikelola(req, res);
    if (!p) return;
    await prisma.$transaction(async (tx) => {
      await tx.pengumuman_kelas.delete({ where: { id_pengumuman: p.id_pengumuman } });
      await catatAudit(tx, req, { aksi: 'hapus_pengumuman_kelas', entitas: 'pengumuman_kelas', idEntitas: p.id_pengumuman, detail: { id_kelas: p.id_kelas } });
    });
    res.json({ message: 'Pengumuman dihapus' });
  } catch (err) {
    next(err);
  }
};
