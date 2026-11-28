// Layanan validasi sertifikat publik UPT Bahasa UNIDHA (Issue #41).
// Mendukung pencarian berdasarkan no_sertifikat atau kode_verifikasi (QR Code)
// tanpa pernah mengekspos kode_verifikasi maupun data pribadi sensitif pemilik.
import prisma from '../lib/prisma.js';
import { fmtTanggal, sekarangWIB } from '../utils/waktu.js';

export const STATUS_VALIDASI = {
  VALID: 'valid',
  TIDAK_DITEMUKAN: 'tidak_ditemukan',
  DICABUT: 'dicabut',
  KEDALUWARSA: 'kedaluwarsa',
};

const LABEL_JENIS_PELATIHAN = {
  toefl_preparation: 'TOEFL Preparation',
  toefl: 'TOEFL',
  ielts: 'IELTS',
  conversation: 'Conversation',
};

// Projection ketat: hanya mengambil field publik yang diperlukan.
// kode_verifikasi, file_path, email, no_hp, password_hash, dan data pribadi lain tidak pernah dipilih.
const SERTIFIKAT_PUBLIC_SELECT = {
  id_sertifikat: true,
  no_sertifikat: true,
  hasil_ringkas: true,
  tanggal_terbit: true,
  berlaku_sampai: true,
  status: true,
  pendaftaran_toefl: {
    select: {
      pengguna: { select: { nama_lengkap: true } },
      sesi_toefl: { select: { nama_sesi: true, tanggal: true } },
    },
  },
  pendaftaran_pelatihan: {
    select: {
      pengguna: { select: { nama_lengkap: true } },
      kelas_pelatihan: { select: { nama_kelas: true, jenis_pelatihan: true } },
    },
  },
};

/**
 * Normalisasi input nomor sertifikat atau kode verifikasi.
 * Jika input berupa URL hasil scan QR yang membawa query param kode/kode_verifikasi/no_sertifikat/q,
 * ekstrak nilai parameternya; nomor sertifikat biasa (termasuk yang mengandung '/') dipertahankan utuh.
 */
export function normalisasiInputValidasi(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      for (const key of ['kode_verifikasi', 'kode', 'no_sertifikat', 'q']) {
        const val = parsed.searchParams.get(key);
        if (val && val.trim()) return val.trim();
      }
      const matchPath = parsed.pathname.match(/\/validasi-sertifikat\/([^/]+)\/?$/i);
      if (matchPath?.[1]) {
        return decodeURIComponent(matchPath[1]).trim();
      }
    } catch {
      // Bukan URL valid -> gunakan nilai trimmed apa adanya
    }
  }

  return trimmed;
}

/**
 * Cek apakah tanggal berlaku_sampai (@db.Date, tersimpan sebagai UTC midnight)
 * sudah terlewati berdasarkan tanggal kalender WIB (UTC+7).
 * Sertifikat masih dianggap berlaku sepanjang hari pada tanggal berlaku_sampai (inklusif).
 */
export function cekKedaluwarsaWIB(berlakuSampai, nowWib = sekarangWIB()) {
  if (!berlakuSampai) return false;
  const tglBatas = berlakuSampai instanceof Date ? berlakuSampai : new Date(berlakuSampai);
  if (Number.isNaN(tglBatas.getTime())) return false;

  const hariBatas = fmtTanggal(tglBatas);
  const hariIniWib = fmtTanggal(nowWib.tanggal);
  return hariBatas < hariIniWib;
}

/**
 * Susun ringkasan informasi sertifikat publik yang aman untuk verifikator.
 */
function bentukInfoPublik(sertifikat) {
  let namaPemilik = null;
  let jenisLayanan = 'UPT Bahasa';
  let program = null;

  if (sertifikat.pendaftaran_toefl) {
    namaPemilik = sertifikat.pendaftaran_toefl.pengguna?.nama_lengkap ?? null;
    jenisLayanan = 'TOEFL';
    program = sertifikat.pendaftaran_toefl.sesi_toefl?.nama_sesi ?? 'Tes TOEFL';
  } else if (sertifikat.pendaftaran_pelatihan) {
    namaPemilik = sertifikat.pendaftaran_pelatihan.pengguna?.nama_lengkap ?? null;
    jenisLayanan = 'Pelatihan';
    const kelas = sertifikat.pendaftaran_pelatihan.kelas_pelatihan;
    program = kelas?.nama_kelas
      ?? LABEL_JENIS_PELATIHAN[kelas?.jenis_pelatihan]
      ?? 'Pelatihan Bahasa';
  }

  const berlakuSampaiDate = sertifikat.berlaku_sampai ? new Date(sertifikat.berlaku_sampai) : null;
  const berlakuSampaiFmt = berlakuSampaiDate && !Number.isNaN(berlakuSampaiDate.getTime())
    ? fmtTanggal(berlakuSampaiDate)
    : null;

  return {
    no_sertifikat: sertifikat.no_sertifikat,
    nama_pemilik: namaPemilik,
    jenis_layanan: jenisLayanan,
    program,
    hasil_ringkas: sertifikat.hasil_ringkas,
    tanggal_terbit: sertifikat.tanggal_terbit,
    berlaku_sampai: berlakuSampaiFmt,
    status_sertifikat: sertifikat.status,
  };
}

/**
 * Validasi sertifikat berdasarkan nomor sertifikat atau kode verifikasi QR.
 *
 * @param {{ kode?: string, no_sertifikat?: string, kode_verifikasi?: string }} params
 * @param {{ nowWib?: { tanggal: Date, menit: number } }} [options]
 */
export async function validasiSertifikatPublik(params = {}, options = {}) {
  const noSertifikat = normalisasiInputValidasi(params.no_sertifikat);
  const kodeVerifikasi = normalisasiInputValidasi(params.kode_verifikasi);
  const kodeUmum = normalisasiInputValidasi(params.kode);

  let where = null;

  if (kodeVerifikasi) {
    if (kodeVerifikasi.length > 64) {
      return {
        valid: false,
        status: STATUS_VALIDASI.TIDAK_DITEMUKAN,
        message: 'Sertifikat tidak ditemukan atau tidak valid',
        data: null,
      };
    }
    where = { kode_verifikasi: kodeVerifikasi };
  } else if (noSertifikat) {
    if (noSertifikat.length > 40) {
      return {
        valid: false,
        status: STATUS_VALIDASI.TIDAK_DITEMUKAN,
        message: 'Sertifikat tidak ditemukan atau tidak valid',
        data: null,
      };
    }
    where = { no_sertifikat: { equals: noSertifikat, mode: 'insensitive' } };
  } else if (kodeUmum) {
    const orConditions = [];
    if (kodeUmum.length <= 40) {
      orConditions.push({ no_sertifikat: { equals: kodeUmum, mode: 'insensitive' } });
    }
    if (kodeUmum.length <= 64) {
      orConditions.push({ kode_verifikasi: kodeUmum });
    }
    if (orConditions.length === 0) {
      return {
        valid: false,
        status: STATUS_VALIDASI.TIDAK_DITEMUKAN,
        message: 'Sertifikat tidak ditemukan atau tidak valid',
        data: null,
      };
    }
    where = orConditions.length === 1 ? orConditions[0] : { OR: orConditions };
  } else {
    return {
      valid: false,
      status: STATUS_VALIDASI.TIDAK_DITEMUKAN,
      message: 'Sertifikat tidak ditemukan atau tidak valid',
      data: null,
    };
  }

  const sertifikat = await prisma.sertifikat.findFirst({
    where,
    select: SERTIFIKAT_PUBLIC_SELECT,
  });

  if (!sertifikat) {
    return {
      valid: false,
      status: STATUS_VALIDASI.TIDAK_DITEMUKAN,
      message: 'Sertifikat tidak ditemukan atau tidak valid',
      data: null,
    };
  }

  const infoPublik = bentukInfoPublik(sertifikat);

  // Prioritas 1: Sertifikat dicabut oleh UPT Bahasa
  if (sertifikat.status === 'dicabut') {
    return {
      valid: false,
      status: STATUS_VALIDASI.DICABUT,
      message: 'Sertifikat ini telah dicabut dan tidak lagi berlaku',
      data: infoPublik,
    };
  }

  // Prioritas 2: Sertifikat melewati tanggal masa berlaku (berdasarkan WIB)
  const nowWib = options.nowWib ?? sekarangWIB();
  if (cekKedaluwarsaWIB(sertifikat.berlaku_sampai, nowWib)) {
    return {
      valid: false,
      status: STATUS_VALIDASI.KEDALUWARSA,
      message: 'Sertifikat ini telah melewati masa berlaku (kedaluwarsa)',
      data: infoPublik,
    };
  }

  // Sertifikat aktif dan belum melewati masa berlaku
  return {
    valid: true,
    status: STATUS_VALIDASI.VALID,
    message: 'Sertifikat valid dan terdaftar resmi di UPT Bahasa Universitas Dharma Andalas',
    data: infoPublik,
  };
}
