-- AlterTable
ALTER TABLE "sesi_toefl" ADD COLUMN     "token_qr" VARCHAR(64),
ADD COLUMN     "status_presensi" "status_presensi_pertemuan",
ADD COLUMN     "waktu_buka_presensi" TIMESTAMP(3),
ADD COLUMN     "waktu_tutup_presensi" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pendaftaran_toefl" ADD COLUMN     "status_kehadiran" "status_kehadiran",
ADD COLUMN     "waktu_presensi" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "sesi_toefl_token_qr_key" ON "sesi_toefl"("token_qr");
