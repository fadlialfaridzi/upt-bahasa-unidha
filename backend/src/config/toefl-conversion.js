// Tabel konversi skor TOEFL resmi dari Kepala UPT Bahasa Universitas Dharma Andalas.
// Sumber: SCORING CONVERTION TABLE (Section 1: Listening, Section 2: Structure & Written Expression, Section 3: Reading Comprehension).
//
// Aturan pemetaan:
//   - Section 1 (Listening)                        : Raw 0–50
//   - Section 2 (Structure and Written Expression) : Raw 0–40 (Raw 41–50 bertanda '-' / tidak tersedia pada tabel resmi)
//   - Section 3 (Reading Comprehension)            : Raw 0–50
//   - Final Score                                  : round(((Converted Listening + Converted Structure + Converted Reading) × 10) / 3)

export const TOEFL_RAW_LIMITS = {
  listening: { min: 0, max: 50, label: 'Listening' },
  structure: { min: 0, max: 40, label: 'Structure and Written Expression' },
  reading: { min: 0, max: 50, label: 'Reading Comprehension' },
};

// Mapping eksak sesuai gambar SCORING CONVERTION TABLE resmi Kepala UPT (baris 0..50).
// Catatan: pada cetakan tabel resmi, Section 1 Raw 14 tercetak 37 dan Raw 13 tercetak 38;
// nilai dipertahankan persis sesuai dokumen resmi tanpa modifikasi.
export const TOEFL_CONVERSION_TABLE = {
  listening: {
    50: 68, 49: 67, 48: 66, 47: 65, 46: 63,
    45: 62, 44: 61, 43: 60, 42: 59, 41: 58,
    40: 57, 39: 57, 38: 56, 37: 55, 36: 54,
    35: 54, 34: 53, 33: 52, 32: 52, 31: 51,
    30: 51, 29: 50, 28: 49, 27: 49, 26: 48,
    25: 48, 24: 47, 23: 47, 22: 46, 21: 45,
    20: 45, 19: 44, 18: 43, 17: 42, 16: 41,
    15: 41, 14: 37, 13: 38, 12: 37, 11: 35,
    10: 33, 9: 32, 8: 32, 7: 31, 6: 30,
    5: 29, 4: 28, 3: 27, 2: 26, 1: 25,
    0: 24,
  },
  structure: {
    40: 68, 39: 67, 38: 65, 37: 63, 36: 61,
    35: 60, 34: 58, 33: 57, 32: 56, 31: 55,
    30: 54, 29: 53, 28: 52, 27: 51, 26: 50,
    25: 49, 24: 48, 23: 47, 22: 46, 21: 45,
    20: 44, 19: 43, 18: 42, 17: 41, 16: 40,
    15: 40, 14: 38, 13: 37, 12: 36, 11: 35,
    10: 33, 9: 31, 8: 29, 7: 27, 6: 26,
    5: 25, 4: 23, 3: 22, 2: 21, 1: 20,
    0: 20,
  },
  reading: {
    50: 67, 49: 66, 48: 65, 47: 63, 46: 61,
    45: 60, 44: 59, 43: 58, 42: 57, 41: 56,
    40: 55, 39: 54, 38: 54, 37: 53, 36: 52,
    35: 52, 34: 51, 33: 50, 32: 49, 31: 48,
    30: 48, 29: 47, 28: 46, 27: 46, 26: 45,
    25: 44, 24: 43, 23: 43, 22: 42, 21: 41,
    20: 40, 19: 39, 18: 38, 17: 37, 16: 36,
    15: 35, 14: 34, 13: 32, 12: 31, 11: 30,
    10: 29, 9: 28, 8: 28, 7: 27, 6: 26,
    5: 25, 4: 24, 3: 23, 2: 23, 1: 22,
    0: 21,
  },
};

const INT_NON_NEG_RE = /^\d+$/;

/**
 * Validasi Raw Score (jumlah jawaban benar) untuk satu section terhadap tabel resmi.
 */
export function parseRawScore(raw, section) {
  const limit = TOEFL_RAW_LIMITS[section];
  const table = TOEFL_CONVERSION_TABLE[section];
  if (!limit || !table) {
    return { ok: false, empty: false, nilai: null, reason: 'section TOEFL tidak dikenali' };
  }

  if (raw === null || raw === undefined) {
    return { ok: true, empty: true, nilai: null };
  }

  const teks = String(raw).trim();
  if (teks === '') {
    return { ok: true, empty: true, nilai: null };
  }

  if (!INT_NON_NEG_RE.test(teks)) {
    return {
      ok: false,
      empty: false,
      nilai: null,
      reason: `harus berupa bilangan bulat ${limit.min}–${limit.max}`,
    };
  }

  const angka = Number(teks);
  if (!Number.isInteger(angka) || angka < limit.min || angka > limit.max || table[angka] === undefined) {
    return {
      ok: false,
      empty: false,
      nilai: null,
      reason: `harus berada dalam rentang ${limit.min}–${limit.max} sesuai tabel konversi resmi`,
    };
  }

  return { ok: true, empty: false, nilai: angka };
}

/**
 * Lookup Converted Score dari tabel resmi berdasarkan section dan Raw Score.
 */
export function konversiRawToefl(section, rawScore) {
  if (rawScore === null || rawScore === undefined) return null;
  const table = TOEFL_CONVERSION_TABLE[section];
  if (!table || !Number.isInteger(rawScore)) return null;
  return table[rawScore] ?? null;
}

/**
 * Hitung Final Score TOEFL ITP Level 1 dari ketiga Converted Score:
 * Final Score = round(((Converted Listening + Converted Structure + Converted Reading) × 10) / 3)
 */
export function hitungFinalScoreToefl(nilaiListening, nilaiStructure, nilaiReading) {
  if (
    nilaiListening === null || nilaiListening === undefined
    || nilaiStructure === null || nilaiStructure === undefined
    || nilaiReading === null || nilaiReading === undefined
  ) {
    return null;
  }
  return Math.round(((nilaiListening + nilaiStructure + nilaiReading) * 10) / 3);
}

/**
 * Hitung Converted Score per section & Final Score TOEFL ITP Level 1.
 */
export function hitungSkorToeflDariRaw({ raw_listening, raw_structure, raw_reading }) {
  const nilai_listening = konversiRawToefl('listening', raw_listening);
  const nilai_structure = konversiRawToefl('structure', raw_structure);
  const nilai_reading = konversiRawToefl('reading', raw_reading);

  if (nilai_listening === null || nilai_structure === null || nilai_reading === null) {
    return {
      nilai_listening: null,
      nilai_structure: null,
      nilai_reading: null,
      skor_toefl: null,
    };
  }

  return {
    nilai_listening,
    nilai_structure,
    nilai_reading,
    skor_toefl: hitungFinalScoreToefl(nilai_listening, nilai_structure, nilai_reading),
  };
}
