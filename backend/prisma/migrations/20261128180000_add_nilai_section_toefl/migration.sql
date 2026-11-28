-- Issue #122: Input dan Pengelolaan Nilai TOEFL (Listening, Structure, Reading).
-- Migration aditif pada pendaftaran_toefl; kolom skor_toefl tetap digunakan untuk menyimpan total nilai.

ALTER TABLE "pendaftaran_toefl"
ADD COLUMN IF NOT EXISTS "nilai_listening" DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS "nilai_structure" DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS "nilai_reading" DECIMAL(6, 2);
