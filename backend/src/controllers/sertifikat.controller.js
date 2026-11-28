// Controller validasi sertifikat publik (Issue #41).
import {
  STATUS_VALIDASI,
  normalisasiInputValidasi,
  validasiSertifikatPublik,
} from '../services/sertifikat.service.js';

const MIN_INPUT_LEN = 3;
const MAX_RAW_LEN = 512;

/**
 * Validasi sertifikat publik melalui nomor sertifikat atau kode verifikasi QR.
 * Mendukung:
 *   - GET  /api/sertifikat/validasi?kode=... (atau ?no_sertifikat=... / ?kode_verifikasi=... / ?q=...)
 *   - GET  /api/sertifikat/validasi/:kode
 *   - POST /api/sertifikat/validasi  body: { kode } | { no_sertifikat } | { kode_verifikasi }
 */
export const validasiSertifikat = async (req, res) => {
  try {
    const rawNoSertifikat = req.body?.no_sertifikat ?? req.query?.no_sertifikat;
    const rawKodeVerifikasi = req.body?.kode_verifikasi ?? req.query?.kode_verifikasi;
    const rawKode = req.params?.kode ?? req.body?.kode ?? req.query?.kode ?? req.query?.q;

    const kandidat = [rawKodeVerifikasi, rawNoSertifikat, rawKode].find(
      (val) => val !== undefined && val !== null && val !== '',
    );

    if (kandidat === undefined) {
      return res.status(400).json({
        valid: false,
        status: 'input_tidak_valid',
        message: 'Nomor sertifikat atau kode verifikasi wajib diisi',
        data: null,
      });
    }

    if (typeof kandidat !== 'string') {
      return res.status(400).json({
        valid: false,
        status: 'input_tidak_valid',
        message: 'Format nomor sertifikat atau kode verifikasi tidak valid',
        data: null,
      });
    }

    if (kandidat.length > MAX_RAW_LEN) {
      return res.status(400).json({
        valid: false,
        status: 'input_tidak_valid',
        message: 'Nomor sertifikat atau kode verifikasi terlalu panjang',
        data: null,
      });
    }

    const bersih = normalisasiInputValidasi(kandidat);
    if (!bersih) {
      return res.status(400).json({
        valid: false,
        status: 'input_tidak_valid',
        message: 'Nomor sertifikat atau kode verifikasi wajib diisi',
        data: null,
      });
    }

    if (bersih.length < MIN_INPUT_LEN) {
      return res.status(400).json({
        valid: false,
        status: 'input_tidak_valid',
        message: `Nomor sertifikat atau kode verifikasi minimal ${MIN_INPUT_LEN} karakter`,
        data: null,
      });
    }

    const hasil = await validasiSertifikatPublik({
      no_sertifikat: typeof rawNoSertifikat === 'string' ? rawNoSertifikat : undefined,
      kode_verifikasi: typeof rawKodeVerifikasi === 'string' ? rawKodeVerifikasi : undefined,
      kode: typeof rawKode === 'string' ? rawKode : undefined,
    });

    const httpStatus = hasil.status === STATUS_VALIDASI.TIDAK_DITEMUKAN ? 404 : 200;
    return res.status(httpStatus).json(hasil);
  } catch (error) {
    console.error('[validasiSertifikat] Internal Error:', error);
    return res.status(500).json({
      valid: false,
      status: 'error',
      message: 'Terjadi kesalahan saat memvalidasi sertifikat',
      data: null,
    });
  }
};
