// Utilitas status override TOEFL dan kelayakan rilis jadwal (UC-21 & UC-28)
// Selaras dengan aturan validasi utama di backend (prosesRilisSesi).

export const OVERRIDE_STATUS_META = {
  diajukan: {
    label: 'Menunggu Persetujuan Kepala UPT',
    badge: 'badge-warning',
  },
  disetujui: {
    label: 'Override Disetujui',
    badge: 'badge-success',
  },
  ditolak: {
    label: 'Override Ditolak',
    badge: 'badge-danger',
  },
};

// Selaras dengan RELEASEABLE_SESI_STATUS di backend (prosesRilisSesi).
// Catatan domain: `ujian_dibuka` adalah status pra-rilis (pendaftaran masih dibuka bersama `terbuka`),
// sedangkan status pasca-rilis adalah `dijadwalkan` -> `selesai`.
export const RELEASEABLE_SESI_STATUS = ['terbuka', 'menunggu_override', 'ujian_dibuka'];

/**
 * Mengambil informasi override terakhir yang benar-benar milik sesi terkait.
 * Mencegah data override dari sesi lain tercampur.
 */
export function getOverrideSesi(sesi) {
  const override = sesi?.override_terakhir;
  if (!override) return null;
  if (override.id_sesi != null && sesi?.id_sesi != null && override.id_sesi !== sesi.id_sesi) {
    return null;
  }
  return override;
}

const toComparableTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const str = String(value);
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    return Date.parse(`1970-01-01T${str.length === 5 ? `${str}:00` : str}.000Z`);
  }
  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Memeriksa kelengkapan dan validitas jadwal sesi TOEFL (tanggal, jam mulai, jam selesai, ruang).
 */
export function cekKelengkapanJadwal(sesi) {
  const ruang = typeof sesi?.ruang === 'string' ? sesi.ruang.trim() : '';
  if (!sesi?.tanggal || !sesi?.jam_mulai || !sesi?.jam_selesai || !ruang) {
    return {
      valid: false,
      reason: 'Tanggal, jam mulai/selesai, dan ruang ujian wajib dilengkapi sebelum rilis jadwal.',
    };
  }

  const mulai = toComparableTime(sesi.jam_mulai);
  const selesai = toComparableTime(sesi.jam_selesai);
  if (mulai === null || selesai === null) {
    return {
      valid: false,
      reason: 'Format waktu mulai atau waktu selesai tidak valid.',
    };
  }
  if (mulai >= selesai) {
    return {
      valid: false,
      reason: 'Waktu selesai harus setelah waktu mulai.',
    };
  }

  return { valid: true, reason: null };
}

/**
 * Mengevaluasi kelayakan tombol rilis jadwal untuk UI Staf UPT.
 * Backend tetap menjadi validator otoritatif utama.
 */
export function evaluasiRilisSesi(sesi, jumlahTerverifikasi = 0) {
  if (!sesi) {
    return { canRelease: false, showReleaseButton: false, viaOverride: false, reason: null, override: null };
  }

  const override = getOverrideSesi(sesi);

  if (!RELEASEABLE_SESI_STATUS.includes(sesi.status)) {
    return {
      canRelease: false,
      showReleaseButton: false,
      viaOverride: false,
      reason: null,
      override,
    };
  }

  const rawKuotaMin = sesi.kuota_min;
  const kuotaMin = (rawKuotaMin === null || rawKuotaMin === undefined || rawKuotaMin === '')
    ? Number.NaN
    : Number(rawKuotaMin);
  if (!Number.isInteger(kuotaMin) || kuotaMin < 1) {
    return {
      canRelease: false,
      showReleaseButton: true,
      viaOverride: false,
      reason: 'Data kuota minimum sesi tidak valid atau belum tersedia.',
      override,
    };
  }

  const rawTerverifikasi = jumlahTerverifikasi;
  const terverifikasi = (rawTerverifikasi === null || rawTerverifikasi === undefined || rawTerverifikasi === '')
    ? 0
    : Number(rawTerverifikasi);
  if (!Number.isFinite(terverifikasi) || terverifikasi < 0) {
    return {
      canRelease: false,
      showReleaseButton: true,
      viaOverride: false,
      reason: 'Data jumlah peserta terverifikasi tidak valid.',
      override,
    };
  }

  const kuotaTerpenuhi = terverifikasi >= kuotaMin;
  const jadwal = cekKelengkapanJadwal(sesi);

  if (kuotaTerpenuhi) {
    if (!jadwal.valid) {
      return {
        canRelease: false,
        showReleaseButton: true,
        viaOverride: false,
        reason: jadwal.reason,
        override,
      };
    }
    return {
      canRelease: true,
      showReleaseButton: true,
      viaOverride: false,
      reason: null,
      override,
    };
  }

  // Kuota belum terpenuhi -> cek status override terakhir milik sesi ini
  if (override?.status === 'diajukan') {
    return {
      canRelease: false,
      showReleaseButton: true,
      viaOverride: false,
      reason: 'Pengajuan override masih menunggu persetujuan Kepala UPT Bahasa.',
      override,
    };
  }

  if (override?.status === 'ditolak') {
    return {
      canRelease: false,
      showReleaseButton: true,
      viaOverride: false,
      reason: `Override ditolak Kepala UPT dan kuota minimum belum terpenuhi (${terverifikasi}/${kuotaMin} peserta).`,
      override,
    };
  }

  if (override?.status !== 'disetujui') {
    return {
      canRelease: false,
      showReleaseButton: true,
      viaOverride: false,
      reason: `Belum memenuhi kuota minimum (${terverifikasi}/${kuotaMin} peserta). Ajukan override kuota terlebih dahulu.`,
      override,
    };
  }

  // Override berstatus 'disetujui' -> jadwal tetap wajib lengkap dan valid
  if (!jadwal.valid) {
    return {
      canRelease: false,
      showReleaseButton: true,
      viaOverride: true,
      reason: `Override disetujui, namun ${jadwal.reason.charAt(0).toLowerCase()}${jadwal.reason.slice(1)}`,
      override,
    };
  }

  return {
    canRelease: true,
    showReleaseButton: true,
    viaOverride: true,
    reason: null,
    override,
  };
}
