-- Issue #122 (Revisi): Tambah kolom Raw Score TOEFL per section pada pendaftaran_toefl.
-- Migration aditif; tidak mengubah kolom Converted Score (nilai_*) maupun Final Score (skor_toefl).
-- Rentang valid sesuai SCORING CONVERTION TABLE resmi Kepala UPT:
--   - raw_listening : 0–50 (Section 1: Listening)
--   - raw_structure : 0–40 (Section 2: Structure and Written Expression)
--   - raw_reading   : 0–50 (Section 3: Reading Comprehension)

ALTER TABLE "pendaftaran_toefl"
ADD COLUMN IF NOT EXISTS "raw_listening" SMALLINT,
ADD COLUMN IF NOT EXISTS "raw_structure" SMALLINT,
ADD COLUMN IF NOT EXISTS "raw_reading" SMALLINT;
