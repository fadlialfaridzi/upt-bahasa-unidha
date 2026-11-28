// Input Nilai Evaluasi Keseluruhan Peserta (Dosen)
// Catatan domain: Pelatihan bersifat opsional (persiapan / bimbingan belajar sebelum tes TOEFL).
// Tidak ada indikator Lulus atau Tidak lulus pada pelatihan; nilai pre-test & post-test (nilai akhir)
// hanya digunakan untuk memantau perkembangan kemampuan peserta.
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { persen } from '../services/pelatihan.service.js';
import { aksesKelas } from '../services/ruang-kelas.service.js';
import { sekarangWIB, statusWaktu } from '../utils/waktu.js';

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** Parse nilai opsional (0–100, maks 2 desimal). Kembalikan `{ ok, nilai }`. */
function parseNilai(raw) {
  if (raw === null || raw === undefined || raw === '') return { ok: true, nilai: null };
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, nilai: null };
  return { ok: true, nilai: Math.round(n * 100) / 100 };
}

const toAngka = (val) => (val === null || val === undefined ? null : Number(val));

const rataRata = (arr) => {
  if (!arr.length) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return Math.round((sum / arr.length) * 10) / 10;
};

/** Hitung rekap kehadiran peserta berdasarkan sesi presensi yang sudah dibuka/ditutup. */
function rekapKehadiran(presensiList, totalSesi) {
  let hadir = 0;
  let izin = 0;
  let alpha = 0;
  for (const pr of presensiList) {
    if (!pr.pertemuan_kelas?.status_presensi) continue;
    if (pr.status === 'hadir') hadir += 1;
    else if (pr.status === 'izin') izin += 1;
    else if (pr.status === 'alpha') alpha += 1;
  }
  const belum_tercatat = Math.max(0, totalSesi - (hadir + izin + alpha));
  const kehadiran_persen = persen(hadir, totalSesi);
  return { hadir, izin, alpha, belum_tercatat, kehadiran_persen };
}

/** Bentuk payload lengkap detail nilai satu kelas (dipakai GET dan respons PUT). */
async function muatDetailNilaiKelas(db, idKelas) {
  const now = sekarangWIB();
  const [kelas, pertemuanList, pendaftaran] = await Promise.all([
    db.kelas_pelatihan.findUnique({
      where: { id_kelas: idKelas },
      select: {
        id_kelas: true,
        nama_kelas: true,
        jenis_pelatihan: true,
        tipe_kelas: true,
        status: true,
        jumlah_pertemuan: true,
        tanggal_mulai: true,
      },
    }),
    db.pertemuan_kelas.findMany({
      where: { id_kelas: idKelas },
      select: {
        id_pertemuan: true,
        tanggal: true,
        jam_mulai: true,
        jam_selesai: true,
        status_presensi: true,
        pengajar: { select: { id_pengguna: true, nama_lengkap: true } },
      },
    }),
    db.pendaftaran_pelatihan.findMany({
      where: { id_kelas: idKelas, status: 'terverifikasi' },
      select: {
        id_pendaftaran: true,
        nilai_pretest: true,
        nilai_akhir: true,
        pengguna: { select: { nama_lengkap: true, nim: true, program_studi: true, email: true } },
        presensi: {
          select: {
            status: true,
            pertemuan_kelas: { select: { status_presensi: true } },
          },
        },
      },
      orderBy: { pengguna: { nama_lengkap: 'asc' } },
    }),
  ]);

  if (!kelas) return null;

  const totalSesi = pertemuanList.filter((p) => p.status_presensi !== null).length;
  const pertemuanSelesai = pertemuanList.filter((p) => statusWaktu(p, now) === 'selesai').length;
  const pengajar = [...new Map(pertemuanList.map((p) => [p.pengajar.id_pengguna, p.pengajar.nama_lengkap])).entries()]
    .map(([id, nama]) => ({ id, nama }));

  const peserta = pendaftaran.map((d) => {
    const rekap = rekapKehadiran(d.presensi, totalSesi);
    const nilai_pretest = toAngka(d.nilai_pretest);
    const nilai_akhir = toAngka(d.nilai_akhir);
    const selisih = nilai_pretest !== null && nilai_akhir !== null
      ? Math.round((nilai_akhir - nilai_pretest) * 100) / 100
      : null;

    return {
      id_pendaftaran: d.id_pendaftaran,
      nama_lengkap: d.pengguna.nama_lengkap,
      nim: d.pengguna.nim,
      program_studi: d.pengguna.program_studi,
      email: d.pengguna.email,
      ...rekap,
      nilai_pretest,
      nilai_akhir,
      selisih,
    };
  });

  const daftarPretest = peserta.map((p) => p.nilai_pretest).filter((v) => v !== null);
  const daftarAkhir = peserta.map((p) => p.nilai_akhir).filter((v) => v !== null);
  const daftarSelisih = peserta.map((p) => p.selisih).filter((v) => v !== null);

  const ringkasan = {
    total: peserta.length,
    sudah_dinilai: peserta.filter((p) => p.nilai_akhir !== null).length,
    belum_dinilai: peserta.filter((p) => p.nilai_akhir === null).length,
    sudah_pretest: daftarPretest.length,
    belum_pretest: peserta.filter((p) => p.nilai_pretest === null).length,
    meningkat: peserta.filter((p) => p.selisih !== null && p.selisih > 0).length,
    rerata_pretest: rataRata(daftarPretest),
    rerata_akhir: rataRata(daftarAkhir),
    rerata_selisih: rataRata(daftarSelisih),
    nilai_tertinggi: daftarAkhir.length ? Math.max(...daftarAkhir) : null,
    nilai_terendah: daftarAkhir.length ? Math.min(...daftarAkhir) : null,
  };

  return {
    kelas: {
      ...kelas,
      pertemuan_terjadwal: pertemuanList.length,
      pertemuan_selesai: pertemuanSelesai,
      pengajar,
    },
    total_sesi: totalSesi,
    peserta,
    ringkasan,
  };
}

/**
 * GET /api/dosen/nilai
 * Daftar kelas yang diampu dosen beserta progres penilaian & statistik nilai peserta.
 */
export const listKelasNilai = async (req, res, next) => {
  try {
    const now = sekarangWIB();
    const kelasList = await prisma.kelas_pelatihan.findMany({
      where: {
        status: { not: 'dibatalkan' },
        pertemuan_kelas: { some: { id_pengajar: req.user.id } },
      },
      select: {
        id_kelas: true,
        nama_kelas: true,
        jenis_pelatihan: true,
        tipe_kelas: true,
        status: true,
        jumlah_pertemuan: true,
        pertemuan_kelas: {
          select: { tanggal: true, jam_mulai: true, jam_selesai: true, status_presensi: true },
        },
        pendaftaran_pelatihan: {
          where: { status: 'terverifikasi' },
          select: { nilai_pretest: true, nilai_akhir: true },
        },
      },
      orderBy: [{ status: 'asc' }, { nama_kelas: 'asc' }],
    });

    const kelas = kelasList.map((k) => {
      const total = k.pendaftaran_pelatihan.length;
      const daftarPre = k.pendaftaran_pelatihan.map((d) => toAngka(d.nilai_pretest)).filter((v) => v !== null);
      const daftarAkhir = k.pendaftaran_pelatihan.map((d) => toAngka(d.nilai_akhir)).filter((v) => v !== null);
      const sudah_dinilai = daftarAkhir.length;
      const pertemuan_selesai = k.pertemuan_kelas.filter((p) => statusWaktu(p, now) === 'selesai').length;
      const total_sesi = k.pertemuan_kelas.filter((p) => p.status_presensi !== null).length;

      return {
        id_kelas: k.id_kelas,
        nama_kelas: k.nama_kelas,
        jenis_pelatihan: k.jenis_pelatihan,
        tipe_kelas: k.tipe_kelas,
        status: k.status,
        jumlah_pertemuan: k.jumlah_pertemuan,
        pertemuan_selesai,
        total_sesi,
        peserta: total,
        sudah_dinilai,
        belum_dinilai: total - sudah_dinilai,
        sudah_pretest: daftarPre.length,
        rerata_pretest: rataRata(daftarPre),
        rerata_akhir: rataRata(daftarAkhir),
      };
    });

    res.json({ data: { kelas } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dosen/nilai/:idKelas
 * Daftar peserta terverifikasi beserta rekap kehadiran & nilai evaluasi untuk satu kelas.
 */
export const getNilaiKelas = async (req, res, next) => {
  try {
    const idKelas = parseId(req.params.idKelas);
    if (!idKelas) return res.status(400).json({ message: 'ID kelas tidak valid' });

    const akses = await aksesKelas(prisma, req.user, idKelas);
    if (akses !== 'kelola') {
      return res.status(403).json({ message: 'Anda tidak memiliki akses mengelola nilai kelas ini' });
    }

    const data = await muatDetailNilaiKelas(prisma, idKelas);
    if (!data) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/dosen/nilai/:idKelas
 * Simpan nilai evaluasi (pre-test & nilai akhir/post-test) peserta secara massal.
 * Body: { nilai: [{ id_pendaftaran, nilai_pretest?, nilai_akhir? }] }
 */
export const simpanNilaiKelas = async (req, res, next) => {
  try {
    const idKelas = parseId(req.params.idKelas);
    if (!idKelas) return res.status(400).json({ message: 'ID kelas tidak valid' });

    const akses = await aksesKelas(prisma, req.user, idKelas);
    if (akses !== 'kelola') {
      return res.status(403).json({ message: 'Anda tidak memiliki akses mengelola nilai kelas ini' });
    }

    const kelas = await prisma.kelas_pelatihan.findUnique({
      where: { id_kelas: idKelas },
      select: { id_kelas: true, nama_kelas: true, status: true },
    });
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    if (kelas.status === 'dibatalkan') {
      return res.status(400).json({ message: 'Tidak dapat menginput nilai pada kelas yang dibatalkan' });
    }

    const daftar = req.body?.nilai;
    if (!Array.isArray(daftar) || daftar.length === 0) {
      return res.status(400).json({ message: 'Daftar nilai peserta harus diisi' });
    }

    const pesertaDb = await prisma.pendaftaran_pelatihan.findMany({
      where: { id_kelas: idKelas, status: 'terverifikasi' },
      select: {
        id_pendaftaran: true,
        id_pengguna: true,
        nilai_pretest: true,
        nilai_akhir: true,
        pengguna: { select: { nama_lengkap: true } },
      },
    });

    const pesertaMap = new Map(pesertaDb.map((p) => [p.id_pendaftaran, p]));
    const perubahan = [];

    for (const item of daftar) {
      const idPendaftaran = parseId(item?.id_pendaftaran);
      const eksisting = idPendaftaran ? pesertaMap.get(idPendaftaran) : null;
      if (!eksisting) {
        return res.status(400).json({ message: `Peserta dengan ID ${item?.id_pendaftaran} tidak terdaftar di kelas ini` });
      }

      const pretest = parseNilai(item.nilai_pretest);
      const akhir = parseNilai(item.nilai_akhir);
      if (!pretest.ok || !akhir.ok) {
        return res.status(400).json({
          message: `Nilai untuk ${eksisting.pengguna.nama_lengkap} harus berupa angka antara 0 sampai 100`,
        });
      }

      const pretestLama = toAngka(eksisting.nilai_pretest);
      const akhirLama = toAngka(eksisting.nilai_akhir);
      const berubah = pretest.nilai !== pretestLama || akhir.nilai !== akhirLama;

      if (berubah) {
        perubahan.push({
          id_pendaftaran: idPendaftaran,
          id_pengguna: eksisting.id_pengguna,
          nilai_pretest: pretest.nilai,
          nilai_akhir: akhir.nilai,
          notifNilai:
            (akhir.nilai !== null && akhir.nilai !== akhirLama) ||
            (akhir.nilai === null && pretest.nilai !== null && pretest.nilai !== pretestLama),
        });
      }
    }

    if (perubahan.length > 0) {
      await prisma.$transaction(async (tx) => {
        await Promise.all(
          perubahan.map((u) =>
            tx.pendaftaran_pelatihan.update({
              where: { id_pendaftaran: u.id_pendaftaran },
              data: {
                nilai_pretest: u.nilai_pretest,
                nilai_akhir: u.nilai_akhir,
              },
            })
          )
        );

        const notifTarget = perubahan.filter((u) => u.notifNilai);
        if (notifTarget.length > 0) {
          await tx.notifikasi.createMany({
            data: notifTarget.map((u) => ({
              id_pengguna: u.id_pengguna,
              jenis: `kelas:${idKelas}:nilai`,
              judul: `Nilai Evaluasi · ${kelas.nama_kelas}`.slice(0, 100),
              pesan: (u.nilai_akhir !== null
                ? `Nilai evaluasi pelatihan Anda telah diperbarui: Nilai akhir ${u.nilai_akhir}${u.nilai_pretest !== null ? ` (Pre-test: ${u.nilai_pretest})` : ''}.`
                : `Nilai pre-test pelatihan Anda telah dicatat: ${u.nilai_pretest}.`
              ).slice(0, 255),
            })),
          });
        }

        await catatAudit(tx, req, {
          aksi: 'input_nilai_pelatihan',
          entitas: 'kelas_pelatihan',
          idEntitas: idKelas,
          detail: { diperbarui: perubahan.length },
        });
      });
    }

    const data = await muatDetailNilaiKelas(prisma, idKelas);
    res.json({
      message: perubahan.length
        ? `Nilai evaluasi ${perubahan.length} peserta berhasil disimpan`
        : 'Tidak ada perubahan nilai untuk disimpan',
      data,
    });
  } catch (err) {
    next(err);
  }
};
