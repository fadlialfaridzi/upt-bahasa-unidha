// Dashboard Pelatihan (Dosen) - #70
import prisma from '../lib/prisma.js';
import { ambangEws, persen, pertemuanRingkas } from '../services/pelatihan.service.js';
import { awalMinggu, fmtJam, fmtTanggal, parseTanggal, sekarangWIB, tambahHari } from '../utils/waktu.js';

const KELAS_AKTIF = ['dibuka', 'berjalan'];
const toMenit = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const MAX_RENTANG_HARI = 62;

/**
 * GET /api/dosen/ringkasan
 * Kelas yang diampu (punya minimal satu pertemuan dengan dosen ini), statistik, jadwal minggu ini,
 * dan pertemuan berikutnya. Dipakai halaman Ringkasan & Kelas saya.
 */
export const getRingkasanDosen = async (req, res) => {
  try {
    const now = sekarangWIB();
    const senin = awalMinggu(now.tanggal);
    const minggu = tambahHari(senin, 6);

    const [pertemuan, ambang] = await Promise.all([
      prisma.pertemuan_kelas.findMany({
        where: { id_pengajar: req.user.id, kelas_pelatihan: { status: { not: 'dibatalkan' } } },
        include: {
          kelas_pelatihan: {
            include: { _count: { select: { pendaftaran_pelatihan: { where: { status: 'terverifikasi' } } } } },
          },
          _count: { select: { presensi: { where: { status: 'hadir' } } } },
        },
        orderBy: [{ tanggal: 'asc' }, { jam_mulai: 'asc' }],
      }),
      ambangEws(prisma),
    ]);

    // Kelompokkan per kelas
    const perKelas = new Map();
    for (const p of pertemuan) {
      const k = p.kelas_pelatihan;
      if (!perKelas.has(k.id_kelas)) {
        perKelas.set(k.id_kelas, {
          id_kelas: k.id_kelas,
          nama_kelas: k.nama_kelas,
          jenis_pelatihan: k.jenis_pelatihan,
          tipe_kelas: k.tipe_kelas,
          status: k.status,
          jumlah_pertemuan: k.jumlah_pertemuan,
          kuota_maks: k.kuota_maks,
          peserta: k._count.pendaftaran_pelatihan,
          pertemuan: [],
          _hadir: 0,
          _slot: 0,
        });
      }
      const g = perKelas.get(k.id_kelas);
      const ringkas = pertemuanRingkas(p, now);
      g.pertemuan.push({ ...ringkas, hadir: p._count.presensi });
      // Kehadiran hanya dihitung dari pertemuan selesai yang sesi presensinya sudah dibuka
      if (ringkas.status === 'selesai' && p.status_presensi) {
        g._hadir += p._count.presensi;
        g._slot += k._count.pendaftaran_pelatihan;
      }
    }

    const idKelasAktif = [...perKelas.values()].filter((k) => KELAS_AKTIF.includes(k.status)).map((k) => k.id_kelas);
    const [pesertaAktif, kegiatan] = await Promise.all([
      idKelasAktif.length
        ? prisma.pendaftaran_pelatihan.findMany({
            where: { id_kelas: { in: idKelasAktif }, status: 'terverifikasi' },
            select: {
              id_pendaftaran: true,
              id_kelas: true,
              nilai_akhir: true,
              pengguna: { select: { nama_lengkap: true } },
              presensi: { select: { id_pertemuan: true, status: true } },
            },
          })
        : [],
      // Kegiatan pribadi dosen yang berlaku minggu ini (untuk kalender per jam)
      prisma.kegiatan_dosen.findMany({
        where: { id_pengajar: req.user.id, tanggal_mulai: { lte: minggu }, tanggal_selesai: { gte: senin } },
      }),
    ]);
    const nilaiBelum = pesertaAktif.filter((d) => d.nilai_akhir === null).length;

    const kelas = [...perKelas.values()].map(({ _hadir, _slot, ...k }) => ({
      ...k,
      pertemuan_selesai: k.pertemuan.filter((p) => p.status === 'selesai').length,
      berikutnya: k.pertemuan.find((p) => p.status !== 'selesai') ?? null,
      kehadiran: persen(_hadir, _slot),
    }));

    const semua = kelas.flatMap((k) => k.pertemuan);
    const aktif = semua.filter((p) => KELAS_AKTIF.includes(perKelas.get(p.id_kelas).status));
    const totalHadir = [...perKelas.values()].filter((k) => KELAS_AKTIF.includes(k.status)).reduce((n, k) => n + k._hadir, 0);
    const totalSlot = [...perKelas.values()].filter((k) => KELAS_AKTIF.includes(k.status)).reduce((n, k) => n + k._slot, 0);
    const urut = (a, b) => (a.tanggal + a.jam_mulai).localeCompare(b.tanggal + b.jam_mulai);

    // Peserta berisiko (EWS) di kelas yang diampu
    const berisiko = [];
    for (const k of kelas.filter((x) => KELAS_AKTIF.includes(x.status))) {
      const sesi = k.pertemuan.filter((p) => p.status === 'selesai' && p.status_presensi).map((p) => p.id_pertemuan);
      if (!sesi.length) continue;
      const idSesi = new Set(sesi);
      for (const d of pesertaAktif.filter((x) => x.id_kelas === k.id_kelas)) {
        const hadir = d.presensi.filter((x) => idSesi.has(x.id_pertemuan) && x.status === 'hadir').length;
        const pct = persen(hadir, sesi.length);
        if (pct < ambang) berisiko.push({ id_pendaftaran: d.id_pendaftaran, nama: d.pengguna.nama_lengkap, nama_kelas: k.nama_kelas, kehadiran: pct, hadir, sesi: sesi.length });
      }
    }

    // Daftar tugas: pertemuan lewat yang presensinya belum dicatat, nilai yang belum diinput per kelas
    const presensiBelum = aktif.filter((p) => p.status === 'selesai' && !p.status_presensi).sort(urut);
    const nilaiPerKelas = kelas
      .filter((k) => KELAS_AKTIF.includes(k.status))
      .map((k) => ({ id_kelas: k.id_kelas, nama_kelas: k.nama_kelas, belum: pesertaAktif.filter((d) => d.id_kelas === k.id_kelas && d.nilai_akhir === null).length }))
      .filter((k) => k.belum > 0);

    // Beban mengajar (jam) bulan ini vs bulan lalu
    const bulanIni = fmtTanggal(now.tanggal).slice(0, 7);
    const bulanLaluD = new Date(Date.UTC(now.tanggal.getUTCFullYear(), now.tanggal.getUTCMonth() - 1, 1));
    const bulanLalu = fmtTanggal(bulanLaluD).slice(0, 7);
    const durasiJam = (p) => (toMenit(p.jam_selesai) - toMenit(p.jam_mulai)) / 60;
    const jamBulan = (b) => Math.round(semua.filter((p) => p.tanggal.startsWith(b)).reduce((n, p) => n + durasiJam(p), 0) * 10) / 10;

    // Kegiatan pribadi minggu ini, dijabarkan per tanggal
    const kegiatanMinggu = [];
    for (let i = 0; i < 7; i++) {
      const tgl = tambahHari(senin, i);
      for (const g of kegiatan) {
        if (g.hari === tgl.getUTCDay() && g.tanggal_mulai <= tgl && g.tanggal_selesai >= tgl) {
          kegiatanMinggu.push({ id_kegiatan: g.id_kegiatan, tanggal: fmtTanggal(tgl), judul: g.judul, jam_mulai: fmtJam(g.jam_mulai), jam_selesai: fmtJam(g.jam_selesai) });
        }
      }
    }

    res.json({
      data: {
        stats: {
          kelas_diampu: idKelasAktif.length,
          pertemuan_minggu_ini: aktif.filter((p) => p.tanggal >= fmtTanggal(senin) && p.tanggal <= fmtTanggal(minggu)).length,
          rerata_kehadiran: persen(totalHadir, totalSlot),
          nilai_belum_diinput: nilaiBelum,
          peserta_total: kelas.filter((k) => KELAS_AKTIF.includes(k.status)).reduce((n, k) => n + k.peserta, 0),
        },
        ambang_ews: ambang,
        minggu: { mulai: fmtTanggal(senin), selesai: fmtTanggal(minggu) },
        minggu_ini: aktif.filter((p) => p.tanggal >= fmtTanggal(senin) && p.tanggal <= fmtTanggal(minggu)).sort(urut),
        berikutnya: aktif.filter((p) => p.status !== 'selesai').sort(urut).slice(0, 5),
        kelas: kelas.sort((a, b) => KELAS_AKTIF.includes(b.status) - KELAS_AKTIF.includes(a.status) || a.nama_kelas.localeCompare(b.nama_kelas)),
        berisiko: berisiko.sort((a, b) => a.kehadiran - b.kehadiran),
        tugas: { presensi_belum: presensiBelum, nilai_belum: nilaiPerKelas },
        beban: {
          jam_bulan_ini: jamBulan(bulanIni),
          jam_bulan_lalu: jamBulan(bulanLalu),
          pertemuan_bulan_ini: semua.filter((p) => p.tanggal.startsWith(bulanIni)).length,
        },
        kegiatan_minggu_ini: kegiatanMinggu,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memuat ringkasan dosen', error: error.message });
  }
};

/**
 * GET /api/dosen/mengajar?dari=YYYY-MM-DD&sampai=YYYY-MM-DD
 * Jadwal mengajar UPT milik dosen pada rentang tanggal (untuk tampilan mingguan Jadwal kegiatan).
 */
export const getJadwalMengajar = async (req, res) => {
  try {
    const dari = parseTanggal(req.query.dari);
    const sampai = parseTanggal(req.query.sampai);
    if (!dari || !sampai || dari > sampai) return res.status(400).json({ message: 'Rentang tanggal tidak valid' });
    if ((sampai - dari) / 86400000 > MAX_RENTANG_HARI) return res.status(400).json({ message: `Rentang maksimal ${MAX_RENTANG_HARI} hari` });

    const now = sekarangWIB();
    const list = await prisma.pertemuan_kelas.findMany({
      where: {
        id_pengajar: req.user.id,
        tanggal: { gte: dari, lte: sampai },
        kelas_pelatihan: { status: { not: 'dibatalkan' } },
      },
      include: { kelas_pelatihan: { select: { nama_kelas: true } } },
      orderBy: [{ tanggal: 'asc' }, { jam_mulai: 'asc' }],
    });
    res.json({ data: list.map((p) => pertemuanRingkas(p, now)) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memuat jadwal mengajar', error: error.message });
  }
};

/**
 * GET /api/dosen/kelas/:id_kelas/pertemuan
 * Detail pertemuan dan materi untuk satu kelas yang diampu dosen
 */
export const getPertemuanKelasDosen = async (req, res) => {
  try {
    const idKelas = Number(req.params.id_kelas);
    if (!Number.isInteger(idKelas) || idKelas <= 0) {
      return res.status(400).json({ message: 'ID kelas tidak valid' });
    }

    const kelas = await prisma.kelas_pelatihan.findUnique({
      where: { id_kelas: idKelas },
      include: {
        pertemuan_kelas: {
          orderBy: { pertemuan_ke: 'asc' },
          include: {
            pengajar: { select: { id_pengguna: true, nama_lengkap: true } },
            _count: { select: { presensi: { where: { status: 'hadir' } } } },
            presensi: {
              include: {
                pendaftaran_pelatihan: {
                  include: { pengguna: { select: { id_pengguna: true, nama_lengkap: true, email: true, no_hp: true } } },
                },
              },
            },
          },
        },
        materi: {
          orderBy: { tanggal_unggah: 'desc' },
        },
        pendaftaran_pelatihan: {
          where: { status: 'terverifikasi' },
          include: {
            pengguna: { select: { id_pengguna: true, nama_lengkap: true, email: true, no_hp: true } },
          },
          orderBy: { tanggal_daftar: 'asc' },
        },
      },
    });

    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

    // Verifikasi dosen mengajar di kelas ini
    const adalahPengajar = kelas.pertemuan_kelas.some((p) => p.id_pengajar === req.user.id);
    if (!adalahPengajar && req.user.role !== 'staf_upt' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Anda bukan pengajar pada kelas ini' });
    }

    const now = sekarangWIB();
    res.json({
      data: {
        id_kelas: kelas.id_kelas,
        nama_kelas: kelas.nama_kelas,
        jenis_pelatihan: kelas.jenis_pelatihan,
        tipe_kelas: kelas.tipe_kelas,
        status: kelas.status,
        jumlah_pertemuan: kelas.jumlah_pertemuan,
        kuota_maks: kelas.kuota_maks,
        total_peserta: kelas.pendaftaran_pelatihan.length,
        peserta: kelas.pendaftaran_pelatihan.map((d) => ({
          id_pendaftaran: d.id_pendaftaran,
          id_pengguna: d.pengguna.id_pengguna,
          nama_lengkap: d.pengguna.nama_lengkap,
          email: d.pengguna.email,
          no_hp: d.pengguna.no_hp,
        })),
        materi: kelas.materi.map((m) => ({
          id_materi: m.id_materi,
          judul: m.judul,
          file_path: m.file_path,
          tanggal_unggah: m.tanggal_unggah,
        })),
        pertemuan: kelas.pertemuan_kelas.map((p) => {
          const ringkas = pertemuanRingkas(p, now);
          return {
            ...ringkas,
            token_qr: p.token_qr,
            status_presensi: p.status_presensi,
            waktu_buka_presensi: p.waktu_buka_presensi,
            waktu_tutup_presensi: p.waktu_tutup_presensi,
            jumlah_hadir: p._count.presensi,
            daftar_hadir: p.presensi.map((pr) => ({
              id_presensi: pr.id_presensi,
              id_pendaftaran: pr.id_pendaftaran,
              nama: pr.pendaftaran_pelatihan.pengguna.nama_lengkap,
              status: pr.status,
              waktu_scan: pr.waktu_scan,
            })),
          };
        }),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail pertemuan kelas', error: error.message });
  }
};

/**
 * POST /api/dosen/pertemuan/:id_pertemuan/buka-presensi
 * Dosen membuka sesi presensi dan men-generate QR Code token
 */
export const bukaPresensiPertemuan = async (req, res) => {
  try {
    const idP = Number(req.params.id_pertemuan);
    if (!Number.isInteger(idP) || idP <= 0) {
      return res.status(400).json({ message: 'ID pertemuan tidak valid' });
    }

    const pertemuan = await prisma.pertemuan_kelas.findUnique({
      where: { id_pertemuan: idP },
      include: { kelas_pelatihan: { select: { nama_kelas: true } } },
    });

    if (!pertemuan) return res.status(404).json({ message: 'Pertemuan tidak ditemukan' });
    if (pertemuan.id_pengajar !== req.user.id && req.user.role !== 'staf_upt' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Hanya pengajar pertemuan ini yang dapat membuka presensi' });
    }

    // Generate token QR unik, misal: UPT-QR-12-839201
    const randCode = Math.floor(100000 + Math.random() * 900000);
    const token = `UPT-QR-${idP}-${randCode}`;

    const updated = await prisma.pertemuan_kelas.update({
      where: { id_pertemuan: idP },
      data: {
        token_qr: token,
        status_presensi: 'dibuka',
        waktu_buka_presensi: new Date(),
        waktu_tutup_presensi: null,
      },
    });

    res.json({
      message: `Presensi pertemuan ke-${pertemuan.pertemuan_ke} berhasil dibuka!`,
      data: {
        id_pertemuan: updated.id_pertemuan,
        pertemuan_ke: updated.pertemuan_ke,
        token_qr: updated.token_qr,
        status_presensi: updated.status_presensi,
        waktu_buka_presensi: updated.waktu_buka_presensi,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuka sesi presensi', error: error.message });
  }
};

/**
 * POST /api/dosen/pertemuan/:id_pertemuan/tutup-presensi
 * Dosen menutup sesi presensi
 */
export const tutupPresensiPertemuan = async (req, res) => {
  try {
    const idP = Number(req.params.id_pertemuan);
    if (!Number.isInteger(idP) || idP <= 0) {
      return res.status(400).json({ message: 'ID pertemuan tidak valid' });
    }

    const pertemuan = await prisma.pertemuan_kelas.findUnique({
      where: { id_pertemuan: idP },
    });

    if (!pertemuan) return res.status(404).json({ message: 'Pertemuan tidak ditemukan' });
    if (pertemuan.id_pengajar !== req.user.id && req.user.role !== 'staf_upt' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Hanya pengajar pertemuan ini yang dapat menutup presensi' });
    }

    const updated = await prisma.pertemuan_kelas.update({
      where: { id_pertemuan: idP },
      data: {
        status_presensi: 'ditutup',
        waktu_tutup_presensi: new Date(),
      },
    });

    res.json({
      message: `Sesi presensi pertemuan ke-${updated.pertemuan_ke} telah ditutup.`,
      data: {
        id_pertemuan: updated.id_pertemuan,
        status_presensi: updated.status_presensi,
        waktu_tutup_presensi: updated.waktu_tutup_presensi,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menutup sesi presensi', error: error.message });
  }
};

/**
 * POST /api/dosen/pertemuan/:id_pertemuan/manual-presensi
 * Dosen menandai kehadiran peserta secara manual (hadir/izin/alpha)
 */
export const manualPresensiPertemuan = async (req, res) => {
  try {
    const idP = Number(req.params.id_pertemuan);
    const { id_pendaftaran, status = 'hadir' } = req.body;
    const idPendaftaran = Number(id_pendaftaran);

    if (!Number.isInteger(idP) || !Number.isInteger(idPendaftaran)) {
      return res.status(400).json({ message: 'ID pertemuan dan ID pendaftaran wajib valid' });
    }

    if (!['hadir', 'izin', 'alpha'].includes(status)) {
      return res.status(400).json({ message: 'Status kehadiran harus hadir, izin, atau alpha' });
    }

    const result = await prisma.presensi.upsert({
      where: {
        id_pertemuan_id_pendaftaran: {
          id_pertemuan: idP,
          id_pendaftaran: idPendaftaran,
        },
      },
      update: {
        status,
        waktu_scan: new Date(),
      },
      create: {
        id_pertemuan: idP,
        id_pendaftaran: idPendaftaran,
        status,
        waktu_scan: new Date(),
      },
    });

    res.json({ message: `Kehadiran peserta berhasil diperbarui (${status}).`, data: result });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mencatat kehadiran manual', error: error.message });
  }
};

/**
 * POST /api/dosen/kelas/:id_kelas/materi
 * Dosen mengunggah materi belajar untuk kelas
 */
export const uploadMateriKelas = async (req, res) => {
  try {
    const idKelas = Number(req.params.id_kelas);
    if (!Number.isInteger(idKelas) || idKelas <= 0) {
      return res.status(400).json({ message: 'ID kelas tidak valid' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'File materi wajib dipilih' });
    }

    const judul = String(req.body.judul ?? '').trim() || req.file.originalname;
    const filePath = req.file.path.replace(/\\/g, '/');

    const materiBaru = await prisma.materi.create({
      data: {
        id_kelas: idKelas,
        judul,
        file_path: filePath,
      },
    });

    res.status(201).json({
      message: 'Materi belajar berhasil diunggah!',
      data: materiBaru,
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunggah materi', error: error.message });
  }
};

/**
 * DELETE /api/dosen/materi/:id_materi
 * Dosen menghapus materi kelas
 */
export const deleteMateriKelas = async (req, res) => {
  try {
    const idMateri = Number(req.params.id_materi);
    if (!Number.isInteger(idMateri) || idMateri <= 0) {
      return res.status(400).json({ message: 'ID materi tidak valid' });
    }

    await prisma.materi.delete({
      where: { id_materi: idMateri },
    });

    res.json({ message: 'Materi berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus materi', error: error.message });
  }
};

