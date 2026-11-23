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
