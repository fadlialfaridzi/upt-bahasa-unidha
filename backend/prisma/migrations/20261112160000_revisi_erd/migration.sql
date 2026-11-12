-- CreateEnum
CREATE TYPE "tipe_pengguna" AS ENUM ('mahasiswa', 'umum', 'internal');

-- CreateEnum
CREATE TYPE "jenis_kelamin" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "status_sesi_toefl" AS ENUM ('terbuka', 'menunggu_override', 'ujian_dibuka', 'dijadwalkan', 'selesai', 'dibatalkan');

-- CreateEnum
CREATE TYPE "jenis_pelatihan" AS ENUM ('toefl_preparation', 'toefl', 'ielts', 'conversation');

-- CreateEnum
CREATE TYPE "tipe_kelas" AS ENUM ('kelas', 'privat');

-- CreateEnum
CREATE TYPE "status_kelas" AS ENUM ('dibuka', 'berjalan', 'selesai', 'dibatalkan');

-- CreateEnum
CREATE TYPE "status_pendaftaran" AS ENUM ('menunggu_pembayaran', 'terverifikasi', 'dibatalkan');

-- CreateEnum
CREATE TYPE "status_kelulusan" AS ENUM ('belum_dinilai', 'lulus', 'tidak_lulus');

-- CreateEnum
CREATE TYPE "status_persetujuan" AS ENUM ('diajukan', 'disetujui', 'ditolak');

-- CreateEnum
CREATE TYPE "status_presensi_pertemuan" AS ENUM ('dibuka', 'ditutup');

-- CreateEnum
CREATE TYPE "status_kehadiran" AS ENUM ('hadir', 'izin', 'alpha');

-- CreateEnum
CREATE TYPE "status_pesanan" AS ENUM ('menunggu_pengecekan', 'menunggu_pembayaran', 'menunggu_verifikasi', 'terverifikasi', 'dialokasikan', 'dikerjakan', 'selesai', 'revisi', 'dibatalkan');

-- CreateEnum
CREATE TYPE "status_job" AS ENUM ('ditugaskan', 'diterima', 'dikerjakan', 'selesai');

-- CreateEnum
CREATE TYPE "jenis_layanan" AS ENUM ('toefl', 'pelatihan', 'penerjemahan');

-- CreateEnum
CREATE TYPE "status_tagihan" AS ENUM ('menunggu_pembayaran', 'menunggu_verifikasi', 'menunggu_persetujuan_angsuran', 'sebagian', 'lunas', 'kedaluwarsa', 'dibatalkan');

-- CreateEnum
CREATE TYPE "status_cicilan" AS ENUM ('belum_terbit', 'menunggu_pembayaran', 'menunggu_verifikasi', 'lunas');

-- CreateEnum
CREATE TYPE "status_pembayaran" AS ENUM ('menunggu', 'terverifikasi', 'ditolak');

-- CreateEnum
CREATE TYPE "status_sertifikat" AS ENUM ('aktif', 'dicabut');

-- DropForeignKey
ALTER TABLE "pendaftaran_pelatihan" DROP CONSTRAINT "pendaftaran_pelatihan_pelatihanId_fkey";

-- DropForeignKey
ALTER TABLE "pendaftaran_pelatihan" DROP CONSTRAINT "pendaftaran_pelatihan_userId_fkey";

-- DropForeignKey
ALTER TABLE "pendaftaran_toefl" DROP CONSTRAINT "pendaftaran_toefl_jadwalId_fkey";

-- DropForeignKey
ALTER TABLE "pendaftaran_toefl" DROP CONSTRAINT "pendaftaran_toefl_userId_fkey";

-- DropForeignKey
ALTER TABLE "pengajuan_terjemahan" DROP CONSTRAINT "pengajuan_terjemahan_userId_fkey";

-- DropIndex
DROP INDEX "pendaftaran_pelatihan_userId_pelatihanId_key";

-- DropIndex
DROP INDEX "pendaftaran_toefl_userId_jadwalId_key";

-- AlterTable
ALTER TABLE "pendaftaran_pelatihan" DROP CONSTRAINT "pendaftaran_pelatihan_pkey",
DROP COLUMN "catatan",
DROP COLUMN "createdAt",
DROP COLUMN "id",
DROP COLUMN "pelatihanId",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "id_kelas" INTEGER NOT NULL,
ADD COLUMN     "id_pendaftaran" SERIAL NOT NULL,
ADD COLUMN     "id_pengguna" INTEGER NOT NULL,
ADD COLUMN     "id_sertifikat" INTEGER,
ADD COLUMN     "id_tagihan" INTEGER,
ADD COLUMN     "nilai_akhir" DECIMAL(5,2),
ADD COLUMN     "nilai_pretest" DECIMAL(5,2),
ADD COLUMN     "status_kelulusan" "status_kelulusan" NOT NULL DEFAULT 'belum_dinilai',
ADD COLUMN     "tanggal_daftar" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "status",
ADD COLUMN     "status" "status_pendaftaran" NOT NULL DEFAULT 'menunggu_pembayaran',
ADD CONSTRAINT "pendaftaran_pelatihan_pkey" PRIMARY KEY ("id_pendaftaran");

-- AlterTable
ALTER TABLE "pendaftaran_toefl" DROP CONSTRAINT "pendaftaran_toefl_pkey",
DROP COLUMN "catatan",
DROP COLUMN "createdAt",
DROP COLUMN "id",
DROP COLUMN "jadwalId",
DROP COLUMN "nilaiToefl",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "id_pendaftaran" SERIAL NOT NULL,
ADD COLUMN     "id_pengguna" INTEGER NOT NULL,
ADD COLUMN     "id_sertifikat" INTEGER,
ADD COLUMN     "id_sesi" INTEGER NOT NULL,
ADD COLUMN     "id_tagihan" INTEGER,
ADD COLUMN     "skor_toefl" DECIMAL(6,2),
ADD COLUMN     "status_kelulusan" "status_kelulusan" NOT NULL DEFAULT 'belum_dinilai',
ADD COLUMN     "tanggal_daftar" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "status",
ADD COLUMN     "status" "status_pendaftaran" NOT NULL DEFAULT 'menunggu_pembayaran',
ADD CONSTRAINT "pendaftaran_toefl_pkey" PRIMARY KEY ("id_pendaftaran");

-- DropTable
DROP TABLE "jadwal_toefl";

-- DropTable
DROP TABLE "pelatihan";

-- DropTable
DROP TABLE "pengajuan_terjemahan";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "StatusPendaftaran";

-- DropEnum
DROP TYPE "StatusTerjemahan";

-- CreateTable
CREATE TABLE "role" (
    "id_role" SERIAL NOT NULL,
    "nama_role" VARCHAR(30) NOT NULL,
    "keterangan" VARCHAR(150),

    CONSTRAINT "role_pkey" PRIMARY KEY ("id_role")
);

-- CreateTable
CREATE TABLE "pengguna" (
    "id_pengguna" SERIAL NOT NULL,
    "id_role" INTEGER NOT NULL,
    "nama_lengkap" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50),
    "password_hash" VARCHAR(100) NOT NULL,
    "no_hp" VARCHAR(20),
    "nim" VARCHAR(20),
    "program_studi" VARCHAR(100),
    "tempat_lahir" VARCHAR(50),
    "tanggal_lahir" DATE,
    "jenis_kelamin" "jenis_kelamin",
    "tipe_pengguna" "tipe_pengguna" NOT NULL DEFAULT 'mahasiswa',
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id_pengguna")
);

-- CreateTable
CREATE TABLE "parameter_sistem" (
    "kunci" VARCHAR(50) NOT NULL,
    "nilai" VARCHAR(100) NOT NULL,
    "keterangan" VARCHAR(150),

    CONSTRAINT "parameter_sistem_pkey" PRIMARY KEY ("kunci")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id_log" SERIAL NOT NULL,
    "id_pengguna" INTEGER NOT NULL,
    "aksi" VARCHAR(30) NOT NULL,
    "entitas" VARCHAR(50) NOT NULL,
    "id_entitas" VARCHAR(50),
    "detail" TEXT,
    "alamat_ip" VARCHAR(45),
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "notifikasi" (
    "id_notifikasi" SERIAL NOT NULL,
    "id_pengguna" INTEGER NOT NULL,
    "jenis" VARCHAR(30) NOT NULL,
    "judul" VARCHAR(100) NOT NULL,
    "pesan" VARCHAR(255) NOT NULL,
    "sudah_dibaca" BOOLEAN NOT NULL DEFAULT false,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifikasi_pkey" PRIMARY KEY ("id_notifikasi")
);

-- CreateTable
CREATE TABLE "dokumen_sop" (
    "id_dokumen_sop" SERIAL NOT NULL,
    "judul" VARCHAR(150) NOT NULL,
    "konten" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "diperbarui_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dokumen_sop_pkey" PRIMARY KEY ("id_dokumen_sop")
);

-- CreateTable
CREATE TABLE "sesi_toefl" (
    "id_sesi" SERIAL NOT NULL,
    "nama_sesi" VARCHAR(100) NOT NULL,
    "batas_pendaftaran" TIMESTAMP(3),
    "tanggal" DATE,
    "jam_mulai" TIME(0),
    "jam_selesai" TIME(0),
    "ruang" VARCHAR(50),
    "kuota_min" SMALLINT NOT NULL DEFAULT 8,
    "kuota_maks" SMALLINT NOT NULL DEFAULT 10,
    "tarif" DECIMAL(12,2) NOT NULL,
    "status" "status_sesi_toefl" NOT NULL DEFAULT 'terbuka',
    "tanggal_rilis" TIMESTAMP(3),

    CONSTRAINT "sesi_toefl_pkey" PRIMARY KEY ("id_sesi")
);

-- CreateTable
CREATE TABLE "override_kuota" (
    "id_override" SERIAL NOT NULL,
    "id_sesi" INTEGER NOT NULL,
    "id_pengaju" INTEGER NOT NULL,
    "id_penyetuju" INTEGER,
    "alasan" TEXT NOT NULL,
    "status" "status_persetujuan" NOT NULL DEFAULT 'diajukan',
    "catatan_putusan" TEXT,
    "tanggal_ajuan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_putusan" TIMESTAMP(3),

    CONSTRAINT "override_kuota_pkey" PRIMARY KEY ("id_override")
);

-- CreateTable
CREATE TABLE "kelas_pelatihan" (
    "id_kelas" SERIAL NOT NULL,
    "nama_kelas" VARCHAR(100) NOT NULL,
    "jenis_pelatihan" "jenis_pelatihan" NOT NULL,
    "tipe_kelas" "tipe_kelas" NOT NULL DEFAULT 'kelas',
    "kuota_maks" SMALLINT NOT NULL DEFAULT 12,
    "jumlah_pertemuan" SMALLINT NOT NULL DEFAULT 20,
    "tanggal_mulai" DATE,
    "tarif" DECIMAL(12,2) NOT NULL,
    "kuesioner_mulai" DATE,
    "kuesioner_selesai" DATE,
    "status" "status_kelas" NOT NULL DEFAULT 'dibuka',

    CONSTRAINT "kelas_pelatihan_pkey" PRIMARY KEY ("id_kelas")
);

-- CreateTable
CREATE TABLE "pertemuan_kelas" (
    "id_pertemuan" SERIAL NOT NULL,
    "id_kelas" INTEGER NOT NULL,
    "id_pengajar" INTEGER NOT NULL,
    "pertemuan_ke" SMALLINT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jam_mulai" TIME(0) NOT NULL,
    "jam_selesai" TIME(0) NOT NULL,
    "ruang" VARCHAR(50),
    "topik" VARCHAR(150),
    "token_qr" VARCHAR(64),
    "status_presensi" "status_presensi_pertemuan",
    "waktu_buka_presensi" TIMESTAMP(3),
    "waktu_tutup_presensi" TIMESTAMP(3),

    CONSTRAINT "pertemuan_kelas_pkey" PRIMARY KEY ("id_pertemuan")
);

-- CreateTable
CREATE TABLE "presensi" (
    "id_presensi" SERIAL NOT NULL,
    "id_pertemuan" INTEGER NOT NULL,
    "id_pendaftaran" INTEGER NOT NULL,
    "waktu_scan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "status_kehadiran" NOT NULL DEFAULT 'hadir',

    CONSTRAINT "presensi_pkey" PRIMARY KEY ("id_presensi")
);

-- CreateTable
CREATE TABLE "materi" (
    "id_materi" SERIAL NOT NULL,
    "id_kelas" INTEGER NOT NULL,
    "judul" VARCHAR(150) NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "tanggal_unggah" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materi_pkey" PRIMARY KEY ("id_materi")
);

-- CreateTable
CREATE TABLE "pertanyaan_kuesioner" (
    "id_pertanyaan" SERIAL NOT NULL,
    "teks_pertanyaan" VARCHAR(255) NOT NULL,
    "urutan" SMALLINT NOT NULL DEFAULT 1,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pertanyaan_kuesioner_pkey" PRIMARY KEY ("id_pertanyaan")
);

-- CreateTable
CREATE TABLE "kuesioner_pengajar" (
    "id_kuesioner" SERIAL NOT NULL,
    "id_pendaftaran" INTEGER NOT NULL,
    "id_pengajar" INTEGER NOT NULL,
    "komentar" TEXT,
    "tanggal_isi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kuesioner_pengajar_pkey" PRIMARY KEY ("id_kuesioner")
);

-- CreateTable
CREATE TABLE "jawaban_kuesioner" (
    "id_jawaban" SERIAL NOT NULL,
    "id_kuesioner" INTEGER NOT NULL,
    "id_pertanyaan" INTEGER NOT NULL,
    "skor" SMALLINT NOT NULL,

    CONSTRAINT "jawaban_kuesioner_pkey" PRIMARY KEY ("id_jawaban")
);

-- CreateTable
CREATE TABLE "tarif_penerjemahan" (
    "id_tarif" SERIAL NOT NULL,
    "jenis_dokumen" VARCHAR(30) NOT NULL,
    "bahasa_asal" VARCHAR(30) NOT NULL,
    "bahasa_tujuan" VARCHAR(30) NOT NULL,
    "tarif_per_halaman" DECIMAL(12,2) NOT NULL,
    "estimasi_hari_per_halaman" DECIMAL(5,2) NOT NULL DEFAULT 0.5,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tarif_penerjemahan_pkey" PRIMARY KEY ("id_tarif")
);

-- CreateTable
CREATE TABLE "pesanan_terjemahan" (
    "id_pesanan" SERIAL NOT NULL,
    "id_pemohon" INTEGER NOT NULL,
    "id_tarif" INTEGER NOT NULL,
    "id_tagihan" INTEGER,
    "jumlah_halaman" SMALLINT,
    "estimasi_biaya" DECIMAL(12,2),
    "estimasi_hari" SMALLINT,
    "file_asli_path" VARCHAR(255) NOT NULL,
    "status" "status_pesanan" NOT NULL DEFAULT 'menunggu_pengecekan',
    "tanggal_ajuan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesanan_terjemahan_pkey" PRIMARY KEY ("id_pesanan")
);

-- CreateTable
CREATE TABLE "riwayat_status_terjemahan" (
    "id_riwayat" SERIAL NOT NULL,
    "id_pesanan" INTEGER NOT NULL,
    "status" "status_pesanan" NOT NULL,
    "keterangan" VARCHAR(150),
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_status_terjemahan_pkey" PRIMARY KEY ("id_riwayat")
);

-- CreateTable
CREATE TABLE "job_order" (
    "id_job" SERIAL NOT NULL,
    "id_pesanan" INTEGER NOT NULL,
    "id_penerjemah" INTEGER NOT NULL,
    "tanggal_alokasi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenggat" DATE NOT NULL,
    "status" "status_job" NOT NULL DEFAULT 'ditugaskan',
    "file_hasil_path" VARCHAR(255),
    "versi_hasil" SMALLINT NOT NULL DEFAULT 0,
    "catatan_revisi" TEXT,
    "tanggal_unggah_hasil" TIMESTAMP(3),

    CONSTRAINT "job_order_pkey" PRIMARY KEY ("id_job")
);

-- CreateTable
CREATE TABLE "tagihan" (
    "id_tagihan" SERIAL NOT NULL,
    "kode_tagihan" VARCHAR(30) NOT NULL,
    "jenis_layanan" "jenis_layanan" NOT NULL,
    "total_tagihan" DECIMAL(12,2) NOT NULL,
    "status" "status_tagihan" NOT NULL DEFAULT 'menunggu_pembayaran',
    "tanggal_terbit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batas_bayar" TIMESTAMP(3),

    CONSTRAINT "tagihan_pkey" PRIMARY KEY ("id_tagihan")
);

-- CreateTable
CREATE TABLE "skema_angsuran" (
    "id_angsuran" SERIAL NOT NULL,
    "id_tagihan" INTEGER NOT NULL,
    "jumlah_cicilan" SMALLINT NOT NULL,
    "alasan" TEXT,
    "status" "status_persetujuan" NOT NULL DEFAULT 'diajukan',
    "catatan_putusan" TEXT,
    "tanggal_ajuan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_putusan" TIMESTAMP(3),

    CONSTRAINT "skema_angsuran_pkey" PRIMARY KEY ("id_angsuran")
);

-- CreateTable
CREATE TABLE "cicilan" (
    "id_cicilan" SERIAL NOT NULL,
    "id_angsuran" INTEGER NOT NULL,
    "cicilan_ke" SMALLINT NOT NULL,
    "nominal" DECIMAL(12,2) NOT NULL,
    "jatuh_tempo" DATE NOT NULL,
    "kode_tagihan_termin" VARCHAR(30),
    "status" "status_cicilan" NOT NULL DEFAULT 'belum_terbit',

    CONSTRAINT "cicilan_pkey" PRIMARY KEY ("id_cicilan")
);

-- CreateTable
CREATE TABLE "pembayaran" (
    "id_pembayaran" SERIAL NOT NULL,
    "id_tagihan" INTEGER NOT NULL,
    "id_cicilan" INTEGER,
    "nominal" DECIMAL(12,2) NOT NULL,
    "bukti_path" VARCHAR(255) NOT NULL,
    "tanggal_unggah" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "status_pembayaran" NOT NULL DEFAULT 'menunggu',
    "tanggal_verifikasi" TIMESTAMP(3),
    "catatan" TEXT,

    CONSTRAINT "pembayaran_pkey" PRIMARY KEY ("id_pembayaran")
);

-- CreateTable
CREATE TABLE "sertifikat" (
    "id_sertifikat" SERIAL NOT NULL,
    "no_sertifikat" VARCHAR(40) NOT NULL,
    "kode_verifikasi" CHAR(64) NOT NULL,
    "hasil_ringkas" VARCHAR(100) NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "tanggal_terbit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "berlaku_sampai" DATE,
    "status" "status_sertifikat" NOT NULL DEFAULT 'aktif',

    CONSTRAINT "sertifikat_pkey" PRIMARY KEY ("id_sertifikat")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_nama_role_key" ON "role"("nama_role");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_email_key" ON "pengguna"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_username_key" ON "pengguna"("username");

-- CreateIndex
CREATE INDEX "pengguna_id_role_idx" ON "pengguna"("id_role");

-- CreateIndex
CREATE INDEX "audit_log_waktu_idx" ON "audit_log"("waktu");

-- CreateIndex
CREATE INDEX "audit_log_id_pengguna_waktu_idx" ON "audit_log"("id_pengguna", "waktu");

-- CreateIndex
CREATE INDEX "audit_log_entitas_id_entitas_idx" ON "audit_log"("entitas", "id_entitas");

-- CreateIndex
CREATE INDEX "notifikasi_id_pengguna_sudah_dibaca_idx" ON "notifikasi"("id_pengguna", "sudah_dibaca");

-- CreateIndex
CREATE INDEX "override_kuota_id_sesi_idx" ON "override_kuota"("id_sesi");

-- CreateIndex
CREATE UNIQUE INDEX "pertemuan_kelas_token_qr_key" ON "pertemuan_kelas"("token_qr");

-- CreateIndex
CREATE INDEX "pertemuan_kelas_id_pengajar_tanggal_idx" ON "pertemuan_kelas"("id_pengajar", "tanggal");

-- CreateIndex
CREATE INDEX "pertemuan_kelas_ruang_tanggal_idx" ON "pertemuan_kelas"("ruang", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "pertemuan_kelas_id_kelas_pertemuan_ke_key" ON "pertemuan_kelas"("id_kelas", "pertemuan_ke");

-- CreateIndex
CREATE INDEX "presensi_id_pendaftaran_idx" ON "presensi"("id_pendaftaran");

-- CreateIndex
CREATE UNIQUE INDEX "presensi_id_pertemuan_id_pendaftaran_key" ON "presensi"("id_pertemuan", "id_pendaftaran");

-- CreateIndex
CREATE INDEX "materi_id_kelas_idx" ON "materi"("id_kelas");

-- CreateIndex
CREATE UNIQUE INDEX "kuesioner_pengajar_id_pendaftaran_id_pengajar_key" ON "kuesioner_pengajar"("id_pendaftaran", "id_pengajar");

-- CreateIndex
CREATE UNIQUE INDEX "jawaban_kuesioner_id_kuesioner_id_pertanyaan_key" ON "jawaban_kuesioner"("id_kuesioner", "id_pertanyaan");

-- CreateIndex
CREATE UNIQUE INDEX "tarif_penerjemahan_jenis_dokumen_bahasa_asal_bahasa_tujuan_key" ON "tarif_penerjemahan"("jenis_dokumen", "bahasa_asal", "bahasa_tujuan");

-- CreateIndex
CREATE UNIQUE INDEX "pesanan_terjemahan_id_tagihan_key" ON "pesanan_terjemahan"("id_tagihan");

-- CreateIndex
CREATE INDEX "pesanan_terjemahan_id_pemohon_status_idx" ON "pesanan_terjemahan"("id_pemohon", "status");

-- CreateIndex
CREATE INDEX "riwayat_status_terjemahan_id_pesanan_waktu_idx" ON "riwayat_status_terjemahan"("id_pesanan", "waktu");

-- CreateIndex
CREATE UNIQUE INDEX "job_order_id_pesanan_key" ON "job_order"("id_pesanan");

-- CreateIndex
CREATE INDEX "job_order_id_penerjemah_status_idx" ON "job_order"("id_penerjemah", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tagihan_kode_tagihan_key" ON "tagihan"("kode_tagihan");

-- CreateIndex
CREATE INDEX "tagihan_status_idx" ON "tagihan"("status");

-- CreateIndex
CREATE INDEX "skema_angsuran_id_tagihan_idx" ON "skema_angsuran"("id_tagihan");

-- CreateIndex
CREATE UNIQUE INDEX "cicilan_kode_tagihan_termin_key" ON "cicilan"("kode_tagihan_termin");

-- CreateIndex
CREATE UNIQUE INDEX "cicilan_id_angsuran_cicilan_ke_key" ON "cicilan"("id_angsuran", "cicilan_ke");

-- CreateIndex
CREATE UNIQUE INDEX "pembayaran_id_cicilan_key" ON "pembayaran"("id_cicilan");

-- CreateIndex
CREATE INDEX "pembayaran_id_tagihan_idx" ON "pembayaran"("id_tagihan");

-- CreateIndex
CREATE INDEX "pembayaran_status_tanggal_verifikasi_idx" ON "pembayaran"("status", "tanggal_verifikasi");

-- CreateIndex
CREATE UNIQUE INDEX "sertifikat_no_sertifikat_key" ON "sertifikat"("no_sertifikat");

-- CreateIndex
CREATE UNIQUE INDEX "sertifikat_kode_verifikasi_key" ON "sertifikat"("kode_verifikasi");

-- CreateIndex
CREATE UNIQUE INDEX "pendaftaran_pelatihan_id_tagihan_key" ON "pendaftaran_pelatihan"("id_tagihan");

-- CreateIndex
CREATE UNIQUE INDEX "pendaftaran_pelatihan_id_sertifikat_key" ON "pendaftaran_pelatihan"("id_sertifikat");

-- CreateIndex
CREATE INDEX "pendaftaran_pelatihan_id_pengguna_idx" ON "pendaftaran_pelatihan"("id_pengguna");

-- CreateIndex
CREATE INDEX "pendaftaran_pelatihan_id_kelas_status_idx" ON "pendaftaran_pelatihan"("id_kelas", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pendaftaran_toefl_id_tagihan_key" ON "pendaftaran_toefl"("id_tagihan");

-- CreateIndex
CREATE UNIQUE INDEX "pendaftaran_toefl_id_sertifikat_key" ON "pendaftaran_toefl"("id_sertifikat");

-- CreateIndex
CREATE INDEX "pendaftaran_toefl_id_pengguna_idx" ON "pendaftaran_toefl"("id_pengguna");

-- CreateIndex
CREATE INDEX "pendaftaran_toefl_id_sesi_status_idx" ON "pendaftaran_toefl"("id_sesi", "status");

-- AddForeignKey
ALTER TABLE "pengguna" ADD CONSTRAINT "pengguna_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "role"("id_role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi" ADD CONSTRAINT "notifikasi_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_toefl" ADD CONSTRAINT "pendaftaran_toefl_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_toefl" ADD CONSTRAINT "pendaftaran_toefl_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "sesi_toefl"("id_sesi") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_toefl" ADD CONSTRAINT "pendaftaran_toefl_id_tagihan_fkey" FOREIGN KEY ("id_tagihan") REFERENCES "tagihan"("id_tagihan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_toefl" ADD CONSTRAINT "pendaftaran_toefl_id_sertifikat_fkey" FOREIGN KEY ("id_sertifikat") REFERENCES "sertifikat"("id_sertifikat") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "override_kuota" ADD CONSTRAINT "override_kuota_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "sesi_toefl"("id_sesi") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "override_kuota" ADD CONSTRAINT "override_kuota_id_pengaju_fkey" FOREIGN KEY ("id_pengaju") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "override_kuota" ADD CONSTRAINT "override_kuota_id_penyetuju_fkey" FOREIGN KEY ("id_penyetuju") REFERENCES "pengguna"("id_pengguna") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_pelatihan" ADD CONSTRAINT "pendaftaran_pelatihan_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_pelatihan" ADD CONSTRAINT "pendaftaran_pelatihan_id_kelas_fkey" FOREIGN KEY ("id_kelas") REFERENCES "kelas_pelatihan"("id_kelas") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_pelatihan" ADD CONSTRAINT "pendaftaran_pelatihan_id_tagihan_fkey" FOREIGN KEY ("id_tagihan") REFERENCES "tagihan"("id_tagihan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_pelatihan" ADD CONSTRAINT "pendaftaran_pelatihan_id_sertifikat_fkey" FOREIGN KEY ("id_sertifikat") REFERENCES "sertifikat"("id_sertifikat") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan_kelas" ADD CONSTRAINT "pertemuan_kelas_id_kelas_fkey" FOREIGN KEY ("id_kelas") REFERENCES "kelas_pelatihan"("id_kelas") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan_kelas" ADD CONSTRAINT "pertemuan_kelas_id_pengajar_fkey" FOREIGN KEY ("id_pengajar") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_id_pertemuan_fkey" FOREIGN KEY ("id_pertemuan") REFERENCES "pertemuan_kelas"("id_pertemuan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_id_pendaftaran_fkey" FOREIGN KEY ("id_pendaftaran") REFERENCES "pendaftaran_pelatihan"("id_pendaftaran") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materi" ADD CONSTRAINT "materi_id_kelas_fkey" FOREIGN KEY ("id_kelas") REFERENCES "kelas_pelatihan"("id_kelas") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuesioner_pengajar" ADD CONSTRAINT "kuesioner_pengajar_id_pendaftaran_fkey" FOREIGN KEY ("id_pendaftaran") REFERENCES "pendaftaran_pelatihan"("id_pendaftaran") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuesioner_pengajar" ADD CONSTRAINT "kuesioner_pengajar_id_pengajar_fkey" FOREIGN KEY ("id_pengajar") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jawaban_kuesioner" ADD CONSTRAINT "jawaban_kuesioner_id_kuesioner_fkey" FOREIGN KEY ("id_kuesioner") REFERENCES "kuesioner_pengajar"("id_kuesioner") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jawaban_kuesioner" ADD CONSTRAINT "jawaban_kuesioner_id_pertanyaan_fkey" FOREIGN KEY ("id_pertanyaan") REFERENCES "pertanyaan_kuesioner"("id_pertanyaan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesanan_terjemahan" ADD CONSTRAINT "pesanan_terjemahan_id_pemohon_fkey" FOREIGN KEY ("id_pemohon") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesanan_terjemahan" ADD CONSTRAINT "pesanan_terjemahan_id_tarif_fkey" FOREIGN KEY ("id_tarif") REFERENCES "tarif_penerjemahan"("id_tarif") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesanan_terjemahan" ADD CONSTRAINT "pesanan_terjemahan_id_tagihan_fkey" FOREIGN KEY ("id_tagihan") REFERENCES "tagihan"("id_tagihan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_status_terjemahan" ADD CONSTRAINT "riwayat_status_terjemahan_id_pesanan_fkey" FOREIGN KEY ("id_pesanan") REFERENCES "pesanan_terjemahan"("id_pesanan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_order" ADD CONSTRAINT "job_order_id_pesanan_fkey" FOREIGN KEY ("id_pesanan") REFERENCES "pesanan_terjemahan"("id_pesanan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_order" ADD CONSTRAINT "job_order_id_penerjemah_fkey" FOREIGN KEY ("id_penerjemah") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skema_angsuran" ADD CONSTRAINT "skema_angsuran_id_tagihan_fkey" FOREIGN KEY ("id_tagihan") REFERENCES "tagihan"("id_tagihan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cicilan" ADD CONSTRAINT "cicilan_id_angsuran_fkey" FOREIGN KEY ("id_angsuran") REFERENCES "skema_angsuran"("id_angsuran") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran" ADD CONSTRAINT "pembayaran_id_tagihan_fkey" FOREIGN KEY ("id_tagihan") REFERENCES "tagihan"("id_tagihan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran" ADD CONSTRAINT "pembayaran_id_cicilan_fkey" FOREIGN KEY ("id_cicilan") REFERENCES "cicilan"("id_cicilan") ON DELETE SET NULL ON UPDATE CASCADE;

