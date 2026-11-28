// Pengelolaan & Input Nilai TOEFL per Sesi (Issue #122).
// Aturan bisnis resmi Kepala UPT Bahasa UNIDHA:
//   - Admin UPT (staf_upt) & Dosen (pengajar) menginput RAW SCORE (jumlah jawaban benar):
//       * Section 1 — Listening                        : 0–50
//       * Section 2 — Structure and Written Expression : 0–40 (41–50 bertanda '-' di tabel resmi)
//       * Section 3 — Reading Comprehension            : 0–50
//   - Converted Score tiap section dihitung otomatis dari tabel konversi resmi (bukan input manual).
//   - Final Score (skor_toefl) = round(((Converted Listening + Converted Structure + Converted Reading) × 10) / 3).
//   - Nilai hanya dapat diberikan kepada peserta terverifikasi yang berstatus hadir pada sesi terkait.
//   - Tidak ada status lulus/tidak lulus dan tidak mengirim notifikasi ke peserta.
//   - Nilai peserta yang sudah memiliki sertifikat (id_sertifikat != null) terkunci agar konsisten dengan sertifikat.
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import {
  TOEFL_RAW_LIMITS,
  hitungFinalScoreToefl,
  hitungSkorToeflDariRaw,
  konversiRawToefl,
  parseRawScore,
} from '../config/toefl-conversion.js';

export {
  TOEFL_RAW_LIMITS,
  hitungFinalScoreToefl,
  hitungSkorToeflDariRaw,
  konversiRawToefl,
  parseRawScore,
};

export const NILAI_TOEFL_ROLES = ['staf_upt', 'pengajar', 'super_admin'];
export const STATUS_SESI_DINILAI = ['dijadwalkan', 'selesai'];

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const ensureNilaiAccess = (req, res) => {
  if (!NILAI_TOEFL_ROLES.includes(req.user?.role)) {
    res.status(403).json({ message: 'Akses ditolak untuk peran Anda' });
    return false;
  }
  return true;
};

const toAngka = (val) => (val === null || val === undefined ? null : Number(val));

const rataRata = (arr) => {
  if (!arr.length) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return Math.round((sum / arr.length) * 100) / 100;
};

/**
 * Muat detail sesi TOEFL beserta daftar peserta terverifikasi, Raw Score, Converted Score,
 * Final Score, status kehadiran, status sertifikat, dan statistik (khusus peserta hadir).
 */
async function muatDetailNilaiSesi(db, idSesi) {
  const [sesi, pendaftaran] = await Promise.all([
    db.sesi_toefl.findUnique({
      where: { id_sesi: idSesi },
      select: {
        id_sesi: true,
        nama_sesi: true,
        tanggal: true,
        jam_mulai: true,
        jam_selesai: true,
        ruang: true,
        status: true,
        status_presensi: true,
      },
    }),
    db.pendaftaran_toefl.findMany({
      where: { id_sesi: idSesi, status: 'terverifikasi' },
      select: {
        id_pendaftaran: true,
        id_pengguna: true,
        status_kehadiran: true,
        waktu_presensi: true,
        raw_listening: true,
        raw_structure: true,
        raw_reading: true,
        nilai_listening: true,
        nilai_structure: true,
        nilai_reading: true,
        skor_toefl: true,
        id_sertifikat: true,
        pengguna: {
          select: {
            id_pengguna: true,
            nama_lengkap: true,
            nim: true,
            email: true,
            program_studi: true,
          },
        },
        sertifikat: {
          select: {
            id_sertifikat: true,
            no_sertifikat: true,
            status: true,
          },
        },
      },
      orderBy: { pengguna: { nama_lengkap: 'asc' } },
    }),
  ]);

  if (!sesi) return null;

  const sesiBisaDinilai = STATUS_SESI_DINILAI.includes(sesi.status);

  const peserta = pendaftaran.map((item) => {
    const raw_listening = toAngka(item.raw_listening);
    const raw_structure = toAngka(item.raw_structure);
    const raw_reading = toAngka(item.raw_reading);
    const nilai_listening = toAngka(item.nilai_listening);
    const nilai_structure = toAngka(item.nilai_structure);
    const nilai_reading = toAngka(item.nilai_reading);
    const skor_toefl = toAngka(item.skor_toefl);
    const sudahDinilai = skor_toefl !== null;
    const sertifikatTerbit = item.id_sertifikat !== null && item.id_sertifikat !== undefined;
    const hadir = item.status_kehadiran === 'hadir';
    const bisaDinilai = sesiBisaDinilai && hadir && !sertifikatTerbit;

    let alasanTerkunci = null;
    if (!sesiBisaDinilai) {
      alasanTerkunci = `Sesi berstatus "${sesi.status}" belum dapat dinilai`;
    } else if (sertifikatTerbit) {
      alasanTerkunci = 'Sertifikat sudah diterbitkan, nilai terkunci';
    } else if (!hadir) {
      alasanTerkunci = 'Hanya peserta berstatus hadir yang dapat dinilai';
    }

    return {
      id_pendaftaran: item.id_pendaftaran,
      id_pengguna: item.id_pengguna,
      nama_lengkap: item.pengguna?.nama_lengkap ?? '',
      nim: item.pengguna?.nim ?? null,
      email: item.pengguna?.email ?? null,
      program_studi: item.pengguna?.program_studi ?? null,
      status_kehadiran: item.status_kehadiran ?? null,
      waktu_presensi: item.waktu_presensi ?? null,
      raw_listening,
      raw_structure,
      raw_reading,
      nilai_listening,
      nilai_structure,
      nilai_reading,
      skor_toefl,
      sudah_dinilai: sudahDinilai,
      id_sertifikat: item.id_sertifikat ?? null,
      sertifikat_terbit: sertifikatTerbit,
      no_sertifikat: item.sertifikat?.no_sertifikat ?? null,
      status_sertifikat: item.sertifikat?.status ?? null,
      bisa_dinilai: bisaDinilai,
      alasan_terkunci: alasanTerkunci,
    };
  });

  // Seluruh statistik nilai hanya menghitung peserta berstatus 'hadir'
  const pesertaHadir = peserta.filter((p) => p.status_kehadiran === 'hadir');
  const daftarTotal = pesertaHadir.map((p) => p.skor_toefl).filter((v) => v !== null);
  const daftarListening = pesertaHadir.map((p) => p.nilai_listening).filter((v) => v !== null);
  const daftarStructure = pesertaHadir.map((p) => p.nilai_structure).filter((v) => v !== null);
  const daftarReading = pesertaHadir.map((p) => p.nilai_reading).filter((v) => v !== null);

  const ringkasan = {
    total_peserta: peserta.length,
    total_hadir: pesertaHadir.length,
    tidak_hadir_atau_belum: peserta.length - pesertaHadir.length,
    sudah_dinilai: pesertaHadir.filter((p) => p.sudah_dinilai).length,
    belum_dinilai: pesertaHadir.filter((p) => !p.sudah_dinilai).length,
    sertifikat_terbit: peserta.filter((p) => p.sertifikat_terbit).length,
    rerata_total: rataRata(daftarTotal),
    rerata_listening: rataRata(daftarListening),
    rerata_structure: rataRata(daftarStructure),
    rerata_reading: rataRata(daftarReading),
    nilai_tertinggi: daftarTotal.length ? Math.max(...daftarTotal) : null,
    nilai_terendah: daftarTotal.length ? Math.min(...daftarTotal) : null,
  };

  return {
    sesi: {
      ...sesi,
      bisa_dinilai: sesiBisaDinilai,
      alasan_tidak_bisa_dinilai: sesiBisaDinilai
        ? null
        : `Input nilai hanya tersedia untuk sesi berstatus "dijadwalkan" atau "selesai" (status saat ini: "${sesi.status}")`,
    },
    batas_raw: TOEFL_RAW_LIMITS,
    peserta,
    ringkasan,
  };
}

/**
 * GET /api/toefl/nilai/sesi
 * Daftar sesi TOEFL yang dapat dikelola nilainya (dijadwalkan & selesai) beserta progres penilaian.
 */
export const listSesiNilaiToefl = async (req, res) => {
  try {
    if (!ensureNilaiAccess(req, res)) return;

    const statusParam = typeof req.query?.status === 'string' ? req.query.status.trim() : '';
    const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';

    const where = {
      status: STATUS_SESI_DINILAI.includes(statusParam)
        ? statusParam
        : { in: STATUS_SESI_DINILAI },
    };

    if (q) {
      where.nama_sesi = { contains: q, mode: 'insensitive' };
    }

    const sesiList = await prisma.sesi_toefl.findMany({
      where,
      select: {
        id_sesi: true,
        nama_sesi: true,
        tanggal: true,
        jam_mulai: true,
        jam_selesai: true,
        ruang: true,
        status: true,
        status_presensi: true,
        pendaftaran_toefl: {
          where: { status: 'terverifikasi' },
          select: {
            id_pendaftaran: true,
            status_kehadiran: true,
            skor_toefl: true,
            id_sertifikat: true,
          },
        },
      },
      orderBy: [{ tanggal: 'desc' }, { id_sesi: 'desc' }],
    });

    const data = sesiList.map((s) => {
      const terverifikasi = s.pendaftaran_toefl || [];
      const hadirList = terverifikasi.filter((p) => p.status_kehadiran === 'hadir');
      const sudahDinilai = hadirList.filter((p) => p.skor_toefl !== null).length;
      const skorList = hadirList.map((p) => toAngka(p.skor_toefl)).filter((v) => v !== null);
      const sertifikatTerbit = terverifikasi.filter((p) => p.id_sertifikat !== null).length;

      return {
        id_sesi: s.id_sesi,
        nama_sesi: s.nama_sesi,
        tanggal: s.tanggal,
        jam_mulai: s.jam_mulai,
        jam_selesai: s.jam_selesai,
        ruang: s.ruang,
        status: s.status,
        status_presensi: s.status_presensi ?? null,
        total_peserta: terverifikasi.length,
        total_hadir: hadirList.length,
        sudah_dinilai: sudahDinilai,
        belum_dinilai: Math.max(0, hadirList.length - sudahDinilai),
        sertifikat_terbit: sertifikatTerbit,
        rerata_total: rataRata(skorList),
      };
    });

    const ringkasan = {
      total_sesi: data.length,
      total_peserta: data.reduce((acc, s) => acc + s.total_peserta, 0),
      total_hadir: data.reduce((acc, s) => acc + s.total_hadir, 0),
      sudah_dinilai: data.reduce((acc, s) => acc + s.sudah_dinilai, 0),
      belum_dinilai: data.reduce((acc, s) => acc + s.belum_dinilai, 0),
    };

    return res.json({
      message: 'Daftar sesi penilaian TOEFL berhasil diambil',
      data,
      ringkasan,
    });
  } catch (error) {
    console.error('[listSesiNilaiToefl] Internal Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar sesi penilaian TOEFL' });
  }
};

/**
 * GET /api/toefl/sesi/:id/nilai
 * Detail sesi TOEFL, daftar peserta terverifikasi, Raw Score, Converted Score, Final Score,
 * status kehadiran, dan status sertifikat.
 */
export const getNilaiSesiToefl = async (req, res) => {
  try {
    if (!ensureNilaiAccess(req, res)) return;

    const idSesi = parseId(req.params?.id);
    if (!idSesi) return res.status(400).json({ message: 'ID sesi TOEFL tidak valid' });

    const detail = await muatDetailNilaiSesi(prisma, idSesi);
    if (!detail) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });

    return res.json({
      message: 'Data nilai sesi TOEFL berhasil diambil',
      data: detail,
    });
  } catch (error) {
    console.error('[getNilaiSesiToefl] Internal Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data nilai sesi TOEFL' });
  }
};

/**
 * PUT /api/toefl/sesi/:id/nilai
 * Body: { nilai: [{ id_pendaftaran, raw_listening, raw_structure, raw_reading }] }
 * Menyimpan/mengedit Raw Score peserta secara massal dalam satu transaksi.
 * Converted Score (nilai_listening, nilai_structure, nilai_reading) di-lookup otomatis dari tabel resmi,
 * dan Final Score (skor_toefl) selalu dihitung ulang oleh backend = round(((L + S + R) × 10) / 3).
 */
export const simpanNilaiSesiToefl = async (req, res) => {
  try {
    if (!ensureNilaiAccess(req, res)) return;

    const idSesi = parseId(req.params?.id);
    if (!idSesi) return res.status(400).json({ message: 'ID sesi TOEFL tidak valid' });

    const daftar = req.body?.nilai;
    if (!Array.isArray(daftar) || daftar.length === 0) {
      return res.status(400).json({ message: 'Daftar nilai peserta wajib diisi' });
    }

    const seenIds = new Set();
    for (const item of daftar) {
      const idP = parseId(item?.id_pendaftaran);
      if (!idP) {
        return res.status(400).json({ message: 'ID pendaftaran peserta pada payload tidak valid' });
      }
      if (seenIds.has(idP)) {
        return res.status(400).json({ message: `Duplikasi ID pendaftaran ${idP} pada daftar nilai` });
      }
      seenIds.add(idP);
    }

    const hasilTx = await prisma.$transaction(async (tx) => {
      const sesi = await tx.sesi_toefl.findUnique({
        where: { id_sesi: idSesi },
        select: { id_sesi: true, nama_sesi: true, status: true },
      });

      if (!sesi) {
        const err = new Error('Sesi TOEFL tidak ditemukan');
        err.statusCode = 404;
        throw err;
      }

      if (!STATUS_SESI_DINILAI.includes(sesi.status)) {
        const err = new Error(
          `Nilai hanya dapat dikelola untuk sesi berstatus "dijadwalkan" atau "selesai" (status saat ini: "${sesi.status}")`,
        );
        err.statusCode = 400;
        throw err;
      }

      const pesertaDb = await tx.pendaftaran_toefl.findMany({
        where: { id_sesi: idSesi },
        select: {
          id_pendaftaran: true,
          id_pengguna: true,
          status: true,
          status_kehadiran: true,
          raw_listening: true,
          raw_structure: true,
          raw_reading: true,
          nilai_listening: true,
          nilai_structure: true,
          nilai_reading: true,
          skor_toefl: true,
          id_sertifikat: true,
          pengguna: { select: { nama_lengkap: true } },
        },
      });

      const pesertaMap = new Map(pesertaDb.map((p) => [p.id_pendaftaran, p]));
      const perubahan = [];

      for (const item of daftar) {
        const idPendaftaran = parseId(item.id_pendaftaran);
        const eksisting = pesertaMap.get(idPendaftaran);

        if (!eksisting) {
          const err = new Error(`Peserta dengan ID pendaftaran ${idPendaftaran} tidak terdaftar pada sesi TOEFL ini`);
          err.statusCode = 400;
          throw err;
        }

        const namaPeserta = eksisting.pengguna?.nama_lengkap || `ID #${idPendaftaran}`;

        if (eksisting.status !== 'terverifikasi') {
          const err = new Error(`Peserta ${namaPeserta} belum terverifikasi sehingga tidak dapat dinilai`);
          err.statusCode = 400;
          throw err;
        }

        const pListening = parseRawScore(item.raw_listening, 'listening');
        if (!pListening.ok) {
          const err = new Error(`Raw Score Listening untuk ${namaPeserta} ${pListening.reason}`);
          err.statusCode = 400;
          throw err;
        }

        const pStructure = parseRawScore(item.raw_structure, 'structure');
        if (!pStructure.ok) {
          const err = new Error(
            `Raw Score Structure and Written Expression untuk ${namaPeserta} ${pStructure.reason}`,
          );
          err.statusCode = 400;
          throw err;
        }

        const pReading = parseRawScore(item.raw_reading, 'reading');
        if (!pReading.ok) {
          const err = new Error(`Raw Score Reading Comprehension untuk ${namaPeserta} ${pReading.reason}`);
          err.statusCode = 400;
          throw err;
        }

        const semuaKosong = pListening.empty && pStructure.empty && pReading.empty;
        const semuaTerisi = !pListening.empty && !pStructure.empty && !pReading.empty;

        if (!semuaKosong && !semuaTerisi) {
          const err = new Error(
            `Raw Score Listening, Structure and Written Expression, dan Reading Comprehension untuk ${namaPeserta} wajib diisi lengkap (atau kosongkan ketiganya untuk reset)`,
          );
          err.statusCode = 400;
          throw err;
        }

        const hasilKonversi = semuaTerisi
          ? hitungSkorToeflDariRaw({
            raw_listening: pListening.nilai,
            raw_structure: pStructure.nilai,
            raw_reading: pReading.nilai,
          })
          : {
            nilai_listening: null,
            nilai_structure: null,
            nilai_reading: null,
            skor_toefl: null,
          };

        if (semuaTerisi && hasilKonversi.skor_toefl === null) {
          const err = new Error(
            `Gagal mengonversi Raw Score untuk ${namaPeserta} pada tabel konversi resmi`,
          );
          err.statusCode = 400;
          throw err;
        }

        const lamaRawL = toAngka(eksisting.raw_listening);
        const lamaRawS = toAngka(eksisting.raw_structure);
        const lamaRawR = toAngka(eksisting.raw_reading);
        const lamaConvL = toAngka(eksisting.nilai_listening);
        const lamaConvS = toAngka(eksisting.nilai_structure);
        const lamaConvR = toAngka(eksisting.nilai_reading);
        const lamaTotal = toAngka(eksisting.skor_toefl);

        const berubah = (
          pListening.nilai !== lamaRawL
          || pStructure.nilai !== lamaRawS
          || pReading.nilai !== lamaRawR
          || hasilKonversi.nilai_listening !== lamaConvL
          || hasilKonversi.nilai_structure !== lamaConvS
          || hasilKonversi.nilai_reading !== lamaConvR
          || hasilKonversi.skor_toefl !== lamaTotal
        );

        // Enforce kehadiran: peserta bukan hadir tidak boleh diinput/diubah nilainya
        if (eksisting.status_kehadiran !== 'hadir') {
          if (!semuaKosong || berubah) {
            const err = new Error(
              `Peserta ${namaPeserta} tidak berstatus hadir sehingga tidak dapat diinput nilainya`,
            );
            err.statusCode = 400;
            throw err;
          }
          continue;
        }

        // Safeguard: nilai peserta yang sertifikatnya sudah diterbitkan tidak boleh diubah
        if (eksisting.id_sertifikat !== null && eksisting.id_sertifikat !== undefined) {
          if (berubah) {
            const err = new Error(
              `Nilai untuk ${namaPeserta} tidak dapat diubah karena sertifikat sudah diterbitkan`,
            );
            err.statusCode = 409;
            throw err;
          }
          continue;
        }

        if (berubah) {
          perubahan.push({
            id_pendaftaran: idPendaftaran,
            id_pengguna: eksisting.id_pengguna,
            raw_listening: pListening.nilai,
            raw_structure: pStructure.nilai,
            raw_reading: pReading.nilai,
            nilai_listening: hasilKonversi.nilai_listening,
            nilai_structure: hasilKonversi.nilai_structure,
            nilai_reading: hasilKonversi.nilai_reading,
            skor_toefl: hasilKonversi.skor_toefl,
          });
        }
      }

      if (perubahan.length > 0) {
        await Promise.all(
          perubahan.map((u) => tx.pendaftaran_toefl.update({
            where: { id_pendaftaran: u.id_pendaftaran },
            data: {
              raw_listening: u.raw_listening,
              raw_structure: u.raw_structure,
              raw_reading: u.raw_reading,
              nilai_listening: u.nilai_listening,
              nilai_structure: u.nilai_structure,
              nilai_reading: u.nilai_reading,
              skor_toefl: u.skor_toefl,
            },
          })),
        );

        // Catat audit log; tidak mengirim notifikasi ke peserta sesuai aturan bisnis Issue #122
        await catatAudit(tx, req, {
          aksi: 'input_nilai_toefl',
          entitas: 'sesi_toefl',
          idEntitas: idSesi,
          detail: {
            nama_sesi: sesi.nama_sesi,
            diperbarui: perubahan.length,
            pendaftaran_ids: perubahan.map((u) => u.id_pendaftaran),
          },
        });
      }

      return { diperbarui: perubahan.length };
    });

    const detail = await muatDetailNilaiSesi(prisma, idSesi);
    return res.json({
      message: hasilTx.diperbarui > 0
        ? `Nilai TOEFL ${hasilTx.diperbarui} peserta berhasil disimpan`
        : 'Tidak ada perubahan nilai untuk disimpan',
      data: detail,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[simpanNilaiSesiToefl] Internal Error:', error);
    }
    return res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal menyimpan nilai sesi TOEFL',
    });
  }
};
