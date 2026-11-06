-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusPendaftaran" AS ENUM ('MENUNGGU', 'DIKONFIRMASI', 'DITOLAK', 'SELESAI');

-- CreateEnum
CREATE TYPE "StatusTerjemahan" AS ENUM ('MENUNGGU', 'DIPROSES', 'SELESAI', 'DITOLAK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "noHp" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal_toefl" (
    "id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "waktu" TEXT NOT NULL,
    "lokasi" TEXT NOT NULL,
    "kuota" INTEGER NOT NULL,
    "kuotaTerisi" INTEGER NOT NULL DEFAULT 0,
    "biaya" DECIMAL(10,2) NOT NULL,
    "keterangan" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jadwal_toefl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendaftaran_toefl" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jadwalId" TEXT NOT NULL,
    "status" "StatusPendaftaran" NOT NULL DEFAULT 'MENUNGGU',
    "nilaiToefl" INTEGER,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pendaftaran_toefl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pelatihan" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "deskripsi" TEXT,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3) NOT NULL,
    "waktu" TEXT NOT NULL,
    "lokasi" TEXT NOT NULL,
    "kuota" INTEGER NOT NULL,
    "kuotaTerisi" INTEGER NOT NULL DEFAULT 0,
    "biaya" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pelatihan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendaftaran_pelatihan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pelatihanId" TEXT NOT NULL,
    "status" "StatusPendaftaran" NOT NULL DEFAULT 'MENUNGGU',
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pendaftaran_pelatihan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengajuan_terjemahan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "judulDokumen" TEXT NOT NULL,
    "bahasaAsal" TEXT NOT NULL,
    "bahasaTujuan" TEXT NOT NULL,
    "catatan" TEXT,
    "fileDokumen" TEXT,
    "fileHasil" TEXT,
    "status" "StatusTerjemahan" NOT NULL DEFAULT 'MENUNGGU',
    "harga" DECIMAL(10,2),
    "estimasiSelesai" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengajuan_terjemahan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pendaftaran_toefl_userId_jadwalId_key" ON "pendaftaran_toefl"("userId", "jadwalId");

-- CreateIndex
CREATE UNIQUE INDEX "pendaftaran_pelatihan_userId_pelatihanId_key" ON "pendaftaran_pelatihan"("userId", "pelatihanId");

-- AddForeignKey
ALTER TABLE "pendaftaran_toefl" ADD CONSTRAINT "pendaftaran_toefl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_toefl" ADD CONSTRAINT "pendaftaran_toefl_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal_toefl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_pelatihan" ADD CONSTRAINT "pendaftaran_pelatihan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran_pelatihan" ADD CONSTRAINT "pendaftaran_pelatihan_pelatihanId_fkey" FOREIGN KEY ("pelatihanId") REFERENCES "pelatihan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan_terjemahan" ADD CONSTRAINT "pengajuan_terjemahan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
