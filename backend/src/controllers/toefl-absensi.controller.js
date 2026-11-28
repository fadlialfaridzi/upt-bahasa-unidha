// Pengelolaan absensi QR Code sesi TOEFL oleh Admin UPT (Issue #12).
// Mengikuti pola presensi.controller.js dengan penyesuaian aturan bisnis TOEFL:
//   - QR hanya dapat dibuka untuk sesi TOEFL berstatus 'dijadwalkan'.
//   - Admin dapat membuka ulang absensi kapan saja dengan token QR baru (token lama otomatis tidak valid).
//   - Saat absensi ditutup atau masa berlaku berakhir, peserta yang belum hadir tetap NULL (tidak otomatis alpha).
//   - Akses dibatasi untuk Admin (staf_upt dan super_admin).
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';

const ADMIN_ROLES = ['staf_upt', 'super_admin'];
export const BERLAKU_MIN = 1; // menit
export const BERLAKU_MAKS = 240; // menit (4 jam)
export const BERLAKU_DEFAULT = 30; // menit
export const STATUS_KEHADIRAN_MAP = {
  hadir: 'hadir',
  izin: 'izin',
  sakit: 'sakit',
  alpa: 'alpha',
  alpha: 'alpha',
};

const MAX_TOKEN_RETRIES = 5;

// Token mudah dibaca/diketik (tanpa karakter ambigu 0/O, 1/I/L), prefix TFL- agar terpisah dari pelatihan (PRS-)
const HURUF_TOKEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const buatTokenToefl = () => {
  const acak = Array.from({ length: 8 }, () => HURUF_TOKEN[crypto.randomInt(HURUF_TOKEN.length)]).join('');
  return `TFL-${acak.slice(0, 4)}-${acak.slice(4)}`;
};

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const ensureAdmin = (req, res) => {
  if (!ADMIN_ROLES.includes(req.user?.role)) {
    res.status(403).json({ message: 'Akses ditolak, hanya untuk admin' });
    return false;
  }
  return true;
};

/**
 * Jika absensi QR sedang berstatus 'dibuka' namun waktu_tutup_presensi sudah lewat menurut waktu server,
 * tutup otomatis status_presensi menjadi 'ditutup' tanpa mengubah status_kehadiran peserta (tetap NULL).
 */
async function finalisasiJikaLewat(sesi) {
  const now = new Date();
  if (
    sesi?.status_presensi !== 'dibuka'
    || !sesi.waktu_tutup_presensi
    || new Date(sesi.waktu_tutup_presensi) > now
  ) {
    return false;
  }

  const { count } = await prisma.sesi_toefl.updateMany({
    where: {
      id_sesi: sesi.id_sesi,
      status_presensi: 'dibuka',
      waktu_tutup_presensi: { lte: now },
    },
    data: { status_presensi: 'ditutup' },
  });
  return count > 0;
}

/**
 * Susun payload detail absensi sesi TOEFL beserta daftar peserta terverifikasi & ringkasan kehadiran.
 */
async function bentukDetailAbsensi(idSesi) {
  const [sesi, pendaftaran] = await Promise.all([
    prisma.sesi_toefl.findUnique({
      where: { id_sesi: idSesi },
      select: {
        id_sesi: true,
        nama_sesi: true,
        tanggal: true,
        jam_mulai: true,
        jam_selesai: true,
        ruang: true,
        kuota_min: true,
        kuota_maks: true,
        status: true,
        tanggal_rilis: true,
        token_qr: true,
        status_presensi: true,
        waktu_buka_presensi: true,
        waktu_tutup_presensi: true,
      },
    }),
    prisma.pendaftaran_toefl.findMany({
      where: { id_sesi: idSesi, status: 'terverifikasi' },
      select: {
        id_pendaftaran: true,
        id_pengguna: true,
        status_kehadiran: true,
        waktu_presensi: true,
        pengguna: {
          select: {
            id_pengguna: true,
            nama_lengkap: true,
            nim: true,
            email: true,
            program_studi: true,
          },
        },
      },
      orderBy: { pengguna: { nama_lengkap: 'asc' } },
    }),
  ]);

  if (!sesi) return null;

  const now = new Date();
  const sedangDibuka = sesi.status_presensi === 'dibuka'
    && Boolean(sesi.waktu_tutup_presensi)
    && new Date(sesi.waktu_tutup_presensi) > now;

  const sisaDetik = sedangDibuka
    ? Math.max(0, Math.ceil((new Date(sesi.waktu_tutup_presensi).getTime() - now.getTime()) / 1000))
    : 0;

  const peserta = pendaftaran.map((item) => ({
    id_pendaftaran: item.id_pendaftaran,
    id_pengguna: item.id_pengguna,
    nama_lengkap: item.pengguna?.nama_lengkap ?? '',
    nim: item.pengguna?.nim ?? null,
    email: item.pengguna?.email ?? null,
    program_studi: item.pengguna?.program_studi ?? null,
    status_kehadiran: item.status_kehadiran ?? null,
    waktu_presensi: item.waktu_presensi ?? null,
  }));

  const hitung = (status) => peserta.filter((p) => p.status_kehadiran === status).length;

  const bisaBuka = sesi.status === 'dijadwalkan';
  const alasanBuka = bisaBuka
    ? null
    : `Absensi QR hanya dapat dibuka untuk sesi berstatus "dijadwalkan" (status saat ini: "${sesi.status}")`;

  return {
    sesi: {
      id_sesi: sesi.id_sesi,
      nama_sesi: sesi.nama_sesi,
      tanggal: sesi.tanggal,
      jam_mulai: sesi.jam_mulai,
      jam_selesai: sesi.jam_selesai,
      ruang: sesi.ruang,
      kuota_min: sesi.kuota_min,
      kuota_maks: sesi.kuota_maks,
      status: sesi.status,
      tanggal_rilis: sesi.tanggal_rilis,
      status_presensi: sesi.status_presensi ?? null,
      waktu_buka_presensi: sesi.waktu_buka_presensi ?? null,
      waktu_tutup_presensi: sesi.waktu_tutup_presensi ?? null,
      // Token QR hanya dikirim saat absensi aktif dibuka
      token_qr: sedangDibuka ? sesi.token_qr : null,
      qr_pernah_dibuat: Boolean(sesi.token_qr),
      sisa_detik: sisaDetik,
      waktu_server: now.toISOString(),
      berlaku: {
        min: BERLAKU_MIN,
        maks: BERLAKU_MAKS,
        default: BERLAKU_DEFAULT,
      },
      bisa_buka: bisaBuka,
      alasan_buka: alasanBuka,
    },
    peserta,
    ringkasan: {
      total: peserta.length,
      hadir: hitung('hadir'),
      izin: hitung('izin'),
      sakit: hitung('sakit'),
      alpha: hitung('alpha'),
      belum: hitung(null),
    },
  };
}

/**
 * GET /api/toefl/sesi/:id/absensi
 * Mengambil status absensi QR, token QR (bila aktif dibuka), informasi countdown/expiry,
 * serta daftar peserta terverifikasi beserta status kehadirannya.
 */
export const getAbsensiSesiToefl = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const id = parseId(req.params?.id);
    if (!id) return res.status(400).json({ message: 'ID sesi TOEFL tidak valid' });

    const sesi = await prisma.sesi_toefl.findUnique({
      where: { id_sesi: id },
      select: { id_sesi: true, status_presensi: true, waktu_tutup_presensi: true },
    });
    if (!sesi) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });

    await finalisasiJikaLewat(sesi);

    const detail = await bentukDetailAbsensi(id);
    res.json({
      message: 'Data absensi sesi TOEFL berhasil diambil',
      data: detail,
    });
  } catch (error) {
    console.error('[getAbsensiSesiToefl] Internal Error:', error);
    res.status(500).json({ message: 'Gagal mengambil data absensi sesi TOEFL' });
  }
};

/**
 * POST /api/toefl/sesi/:id/absensi/buka
 * Body opsional: { berlaku_menit } (default 30, rentang 1–240 menit).
 * Membuka atau membuka ulang absensi QR sesi TOEFL berstatus 'dijadwalkan' dengan token QR baru.
 * Token sebelumnya otomatis ditimpa sehingga tidak lagi valid.
 */
export const bukaAbsensiToefl = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const id = parseId(req.params?.id);
    if (!id) return res.status(400).json({ message: 'ID sesi TOEFL tidak valid' });

    const rawMenit = req.body?.berlaku_menit;
    const menitBerlaku = (rawMenit === undefined || rawMenit === null || rawMenit === '')
      ? BERLAKU_DEFAULT
      : Number(rawMenit);

    if (!Number.isInteger(menitBerlaku) || menitBerlaku < BERLAKU_MIN || menitBerlaku > BERLAKU_MAKS) {
      return res.status(400).json({
        message: `Masa berlaku QR wajib berupa bilangan bulat ${BERLAKU_MIN}–${BERLAKU_MAKS} menit`,
      });
    }

    let hasil = null;
    for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt += 1) {
      try {
        hasil = await prisma.$transaction(async (tx) => {
          const sesi = await tx.sesi_toefl.findUnique({
            where: { id_sesi: id },
            select: {
              id_sesi: true,
              nama_sesi: true,
              status: true,
              token_qr: true,
              status_presensi: true,
            },
          });

          if (!sesi) {
            const err = new Error('Sesi TOEFL tidak ditemukan');
            err.statusCode = 404;
            throw err;
          }

          if (sesi.status !== 'dijadwalkan') {
            const err = new Error(
              `Absensi QR hanya dapat dibuka untuk sesi TOEFL berstatus "dijadwalkan" (status saat ini: "${sesi.status}")`,
            );
            err.statusCode = 400;
            throw err;
          }

          let tokenBaru = buatTokenToefl();
          while (tokenBaru === sesi.token_qr) {
            tokenBaru = buatTokenToefl();
          }

          const now = new Date();
          const waktuTutup = new Date(now.getTime() + menitBerlaku * 60000);
          const dibukaUlang = Boolean(sesi.token_qr);

          // Update kondisional untuk mencegah race condition jika status sesi berubah bersamaan
          const klaim = await tx.sesi_toefl.updateMany({
            where: { id_sesi: id, status: 'dijadwalkan' },
            data: {
              token_qr: tokenBaru,
              status_presensi: 'dibuka',
              waktu_buka_presensi: now,
              waktu_tutup_presensi: waktuTutup,
            },
          });

          if (klaim.count === 0) {
            const err = new Error('Status sesi TOEFL berubah dan tidak lagi berstatus "dijadwalkan"');
            err.statusCode = 409;
            throw err;
          }

          await catatAudit(tx, req, {
            aksi: dibukaUlang ? 'buka_ulang_absensi_toefl' : 'buka_absensi_toefl',
            entitas: 'sesi_toefl',
            idEntitas: id,
            detail: {
              nama_sesi: sesi.nama_sesi,
              berlaku_menit: menitBerlaku,
              waktu_buka_presensi: now.toISOString(),
              waktu_tutup_presensi: waktuTutup.toISOString(),
              dibuka_ulang: dibukaUlang,
            },
          });

          return { dibukaUlang, menitBerlaku };
        });
        break;
      } catch (err) {
        if (err?.code === 'P2002' && attempt < MAX_TOKEN_RETRIES - 1) {
          continue;
        }
        throw err;
      }
    }

    const detail = await bentukDetailAbsensi(id);
    res.json({
      message: hasil.dibukaUlang
        ? `QR absensi TOEFL dibuka ulang dengan token baru, berlaku ${hasil.menitBerlaku} menit.`
        : `QR absensi TOEFL berhasil dibuka, berlaku ${hasil.menitBerlaku} menit.`,
      data: detail,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[bukaAbsensiToefl] Internal Error:', error);
    }
    res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal membuka absensi QR sesi TOEFL',
    });
  }
};

/**
 * POST /api/toefl/sesi/:id/absensi/tutup
 * Menutup absensi QR sesi TOEFL secara manual.
 * Peserta yang belum hadir tetap dibiarkan NULL (tidak otomatis menjadi alpha).
 */
export const tutupAbsensiToefl = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const id = parseId(req.params?.id);
    if (!id) return res.status(400).json({ message: 'ID sesi TOEFL tidak valid' });

    await prisma.$transaction(async (tx) => {
      const sesi = await tx.sesi_toefl.findUnique({
        where: { id_sesi: id },
        select: {
          id_sesi: true,
          nama_sesi: true,
          status_presensi: true,
          waktu_tutup_presensi: true,
        },
      });

      if (!sesi) {
        const err = new Error('Sesi TOEFL tidak ditemukan');
        err.statusCode = 404;
        throw err;
      }

      if (sesi.status_presensi !== 'dibuka') {
        const err = new Error('Absensi QR untuk sesi ini tidak sedang dibuka');
        err.statusCode = 409;
        throw err;
      }

      const now = new Date();
      const klaim = await tx.sesi_toefl.updateMany({
        where: { id_sesi: id, status_presensi: 'dibuka' },
        data: {
          status_presensi: 'ditutup',
          waktu_tutup_presensi: now,
        },
      });

      if (klaim.count === 0) {
        const err = new Error('Absensi QR untuk sesi ini sudah ditutup sebelumnya');
        err.statusCode = 409;
        throw err;
      }

      // Tidak mengubah pendaftaran_toefl: peserta yang belum hadir tetap NULL (sesuai ketentuan Issue #12).
      await catatAudit(tx, req, {
        aksi: 'tutup_absensi_toefl',
        entitas: 'sesi_toefl',
        idEntitas: id,
        detail: {
          nama_sesi: sesi.nama_sesi,
          waktu_tutup_presensi: now.toISOString(),
        },
      });
    });

    const detail = await bentukDetailAbsensi(id);
    res.json({
      message: 'Absensi QR sesi TOEFL berhasil ditutup',
      data: detail,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[tutupAbsensiToefl] Internal Error:', error);
    }
    res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal menutup absensi QR sesi TOEFL',
    });
  }
};

/**
 * PATCH /api/toefl/sesi/:id/absensi/:idPendaftaran
 * Body: { status_kehadiran: 'hadir' | 'izin' | 'alpa' | 'sakit' } (menerima 'alpa' maupun 'alpha').
 * Mengubah status kehadiran peserta secara manual oleh Admin/pengawas pada sesi TOEFL terkait.
 */
export const updateKehadiranManualToefl = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const idSesi = parseId(req.params?.id);
    if (!idSesi) return res.status(400).json({ message: 'ID sesi TOEFL tidak valid' });

    const idPendaftaran = parseId(req.params?.idPendaftaran ?? req.body?.id_pendaftaran);
    if (!idPendaftaran) return res.status(400).json({ message: 'ID pendaftaran peserta tidak valid' });

    const rawStatus = String(req.body?.status_kehadiran ?? req.body?.status ?? '').trim().toLowerCase();
    const statusDb = STATUS_KEHADIRAN_MAP[rawStatus];
    if (!statusDb) {
      return res.status(400).json({
        message: 'Status kehadiran tidak valid. Pilih salah satu: hadir, izin, sakit, atau alpa',
      });
    }

    await prisma.$transaction(async (tx) => {
      const sesi = await tx.sesi_toefl.findUnique({
        where: { id_sesi: idSesi },
        select: { id_sesi: true, nama_sesi: true },
      });
      if (!sesi) {
        const err = new Error('Sesi TOEFL tidak ditemukan');
        err.statusCode = 404;
        throw err;
      }

      const pendaftaran = await tx.pendaftaran_toefl.findUnique({
        where: { id_pendaftaran: idPendaftaran },
        select: {
          id_pendaftaran: true,
          id_sesi: true,
          id_pengguna: true,
          status: true,
          status_kehadiran: true,
        },
      });

      if (!pendaftaran || pendaftaran.id_sesi !== idSesi) {
        const err = new Error('Peserta tidak terdaftar pada sesi TOEFL ini');
        err.statusCode = 404;
        throw err;
      }

      if (pendaftaran.status !== 'terverifikasi') {
        const err = new Error('Status kehadiran hanya dapat diubah untuk peserta terverifikasi');
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      await tx.pendaftaran_toefl.update({
        where: { id_pendaftaran: idPendaftaran },
        data: {
          status_kehadiran: statusDb,
          waktu_presensi: now,
        },
      });

      await catatAudit(tx, req, {
        aksi: 'ubah_kehadiran_manual_toefl',
        entitas: 'pendaftaran_toefl',
        idEntitas: idPendaftaran,
        detail: {
          id_sesi: idSesi,
          nama_sesi: sesi.nama_sesi,
          id_pengguna: pendaftaran.id_pengguna,
          status_sebelumnya: pendaftaran.status_kehadiran ?? null,
          status_baru: statusDb,
        },
      });
    });

    const detail = await bentukDetailAbsensi(idSesi);
    res.json({
      message: 'Status kehadiran peserta berhasil diperbarui',
      data: detail,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[updateKehadiranManualToefl] Internal Error:', error);
    }
    res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal memperbarui status kehadiran peserta',
    });
  }
};

/**
 * GET /api/toefl/absensi/saya
 * Mengambil daftar sesi TOEFL milik mahasiswa/peserta yang sedang login (selain dibatalkan)
 * beserta status pendaftaran, status absensi sesi (sinkron dengan waktu server), dan status kehadiran.
 * Tidak pernah mengembalikan token_qr kepada peserta.
 */
export const getAbsensiToeflSaya = async (req, res) => {
  try {
    const idPengguna = parseId(req.user?.id);
    if (!idPengguna) return res.status(401).json({ message: 'Identitas pengguna tidak valid' });

    const pendaftaran = await prisma.pendaftaran_toefl.findMany({
      where: {
        id_pengguna: idPengguna,
        status: { not: 'dibatalkan' },
      },
      select: {
        id_pendaftaran: true,
        id_sesi: true,
        status: true,
        tanggal_daftar: true,
        status_kehadiran: true,
        waktu_presensi: true,
        sesi_toefl: {
          select: {
            id_sesi: true,
            nama_sesi: true,
            tanggal: true,
            jam_mulai: true,
            jam_selesai: true,
            ruang: true,
            status: true,
            status_presensi: true,
            waktu_buka_presensi: true,
            waktu_tutup_presensi: true,
          },
        },
      },
      orderBy: [{ tanggal_daftar: 'desc' }, { id_pendaftaran: 'desc' }],
    });

    // Finalisasi otomatis sesi yang waktu_tutup_presensi-nya sudah lewat
    const sesiPerluCek = new Map();
    for (const item of pendaftaran) {
      const s = item.sesi_toefl;
      if (s && s.status_presensi === 'dibuka' && s.waktu_tutup_presensi && !sesiPerluCek.has(s.id_sesi)) {
        sesiPerluCek.set(s.id_sesi, s);
      }
    }

    const sesiDitutupOtomatis = new Set();
    await Promise.all(
      Array.from(sesiPerluCek.values()).map(async (s) => {
        const ditutup = await finalisasiJikaLewat(s);
        if (ditutup || (s.waktu_tutup_presensi && new Date(s.waktu_tutup_presensi) <= new Date())) {
          sesiDitutupOtomatis.add(s.id_sesi);
        }
      }),
    );

    const now = new Date();
    const waktuServer = now.toISOString();

    const data = pendaftaran.map((item) => {
      const s = item.sesi_toefl;
      const statusPresensi = s
        ? (sesiDitutupOtomatis.has(s.id_sesi) ? 'ditutup' : (s.status_presensi ?? null))
        : null;
      const sedangDibuka = Boolean(
        s
        && s.status === 'dijadwalkan'
        && statusPresensi === 'dibuka'
        && s.waktu_tutup_presensi
        && new Date(s.waktu_tutup_presensi) > now,
      );
      const sisaDetik = sedangDibuka
        ? Math.max(0, Math.ceil((new Date(s.waktu_tutup_presensi).getTime() - now.getTime()) / 1000))
        : 0;

      return {
        id_pendaftaran: item.id_pendaftaran,
        status_pendaftaran: item.status,
        tanggal_daftar: item.tanggal_daftar,
        status_kehadiran: item.status_kehadiran ?? null,
        waktu_presensi: item.waktu_presensi ?? null,
        sesi: s ? {
          id_sesi: s.id_sesi,
          nama_sesi: s.nama_sesi,
          tanggal: s.tanggal,
          jam_mulai: s.jam_mulai,
          jam_selesai: s.jam_selesai,
          ruang: s.ruang,
          status: s.status,
          status_presensi: statusPresensi,
          waktu_buka_presensi: s.waktu_buka_presensi ?? null,
          waktu_tutup_presensi: s.waktu_tutup_presensi ?? null,
          sedang_dibuka: sedangDibuka,
          sisa_detik: sisaDetik,
          waktu_server: waktuServer,
        } : null,
      };
    });

    res.json({
      message: 'Data absensi TOEFL peserta berhasil diambil',
      data,
    });
  } catch (error) {
    console.error('[getAbsensiToeflSaya] Internal Error:', error);
    res.status(500).json({ message: 'Gagal mengambil data absensi TOEFL Anda' });
  }
};

const LABEL_STATUS_KEHADIRAN = {
  hadir: 'hadir',
  izin: 'izin',
  sakit: 'sakit',
  alpha: 'alpa',
};

/**
 * POST /api/toefl/absensi/scan
 * Body: { token_qr }
 * Peserta terverifikasi yang memindai QR Code valid pada sesi TOEFL aktif otomatis tercatat sebagai 'hadir'.
 * Hanya mengubah status_kehadiran yang masih NULL; status hadir/izin/sakit/alpha tidak boleh tertimpa.
 */
export const scanAbsensiToefl = async (req, res) => {
  try {
    const idPengguna = parseId(req.user?.id);
    if (!idPengguna) return res.status(401).json({ message: 'Identitas pengguna tidak valid' });

    const token = String(req.body?.token_qr ?? '').trim().toUpperCase();
    if (!token) return res.status(400).json({ message: 'Kode QR absensi wajib diisi' });

    const hasil = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const sesi = await tx.sesi_toefl.findUnique({
        where: { token_qr: token },
        select: {
          id_sesi: true,
          nama_sesi: true,
          tanggal: true,
          jam_mulai: true,
          jam_selesai: true,
          ruang: true,
          status: true,
          status_presensi: true,
          waktu_tutup_presensi: true,
        },
      });

      if (!sesi || sesi.status !== 'dijadwalkan' || sesi.status_presensi !== 'dibuka') {
        const err = new Error('QR Code tidak valid atau absensi sesi TOEFL sudah ditutup');
        err.statusCode = 400;
        throw err;
      }

      if (sesi.waktu_tutup_presensi && new Date(sesi.waktu_tutup_presensi) <= now) {
        // Kembalikan penanda kedaluwarsa agar auto-close dijalankan di luar transaksi (tidak ikut rollback)
        return { expired: true, sesi };
      }

      const pendaftaran = await tx.pendaftaran_toefl.findFirst({
        where: {
          id_sesi: sesi.id_sesi,
          id_pengguna: idPengguna,
          status: 'terverifikasi',
        },
        select: {
          id_pendaftaran: true,
          status_kehadiran: true,
          waktu_presensi: true,
        },
      });

      if (!pendaftaran) {
        const err = new Error('Anda tidak terdaftar sebagai peserta terverifikasi pada sesi TOEFL ini');
        err.statusCode = 403;
        throw err;
      }

      if (pendaftaran.status_kehadiran === 'hadir') {
        const err = new Error('Kehadiran Anda pada sesi TOEFL ini sudah tercatat sebelumnya');
        err.statusCode = 409;
        throw err;
      }

      if (pendaftaran.status_kehadiran !== null && pendaftaran.status_kehadiran !== undefined) {
        const label = LABEL_STATUS_KEHADIRAN[pendaftaran.status_kehadiran] || pendaftaran.status_kehadiran;
        const err = new Error(
          `Status kehadiran Anda pada sesi TOEFL ini sudah tercatat sebagai "${label}" dan tidak dapat diubah melalui scan QR`,
        );
        err.statusCode = 409;
        throw err;
      }

      const updated = await tx.pendaftaran_toefl.update({
        where: { id_pendaftaran: pendaftaran.id_pendaftaran },
        data: {
          status_kehadiran: 'hadir',
          waktu_presensi: now,
        },
        select: {
          id_pendaftaran: true,
          id_sesi: true,
          status_kehadiran: true,
          waktu_presensi: true,
        },
      });

      await catatAudit(tx, req, {
        aksi: 'scan_absensi_toefl',
        entitas: 'pendaftaran_toefl',
        idEntitas: pendaftaran.id_pendaftaran,
        detail: {
          id_sesi: sesi.id_sesi,
          nama_sesi: sesi.nama_sesi,
          status_kehadiran: 'hadir',
        },
      });

      return {
        expired: false,
        data: {
          ...updated,
          nama_sesi: sesi.nama_sesi,
          tanggal: sesi.tanggal ?? null,
          jam_mulai: sesi.jam_mulai ?? null,
          jam_selesai: sesi.jam_selesai ?? null,
          ruang: sesi.ruang ?? null,
        },
      };
    });

    if (hasil?.expired) {
      await finalisasiJikaLewat(hasil.sesi);
      return res.status(400).json({ message: 'Masa berlaku QR Code absensi TOEFL telah berakhir' });
    }

    res.json({
      message: 'Presensi TOEFL berhasil dicatat sebagai hadir',
      data: hasil.data,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[scanAbsensiToefl] Internal Error:', error);
    }
    res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal memproses scan QR absensi TOEFL',
    });
  }
};
