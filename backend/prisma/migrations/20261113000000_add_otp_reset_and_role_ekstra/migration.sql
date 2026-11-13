-- Migration: add_otp_reset_and_role_ekstra
-- Dibuat manual karena database sedang offline saat generate.
-- Jalankan setelah database aktif, SEBELUM prisma migrate deploy.

-- 1. Tambah kolom role ekstra ke tabel pengguna
ALTER TABLE "pengguna"
  ADD COLUMN IF NOT EXISTS "id_role_ekstra" INTEGER REFERENCES "role"("id_role");

-- 2. Buat tabel otp_reset
CREATE TABLE IF NOT EXISTS "otp_reset" (
  "id"         SERIAL PRIMARY KEY,
  "email"      VARCHAR(100)  NOT NULL,
  "kode"       VARCHAR(6)    NOT NULL,
  "expired_at" TIMESTAMPTZ   NOT NULL,
  "used"       BOOLEAN       NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "otp_reset_email_used_idx"
  ON "otp_reset"("email", "used");
