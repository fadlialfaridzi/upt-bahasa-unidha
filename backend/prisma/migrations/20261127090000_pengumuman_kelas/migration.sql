-- CreateTable
CREATE TABLE "pengumuman_kelas" (
    "id_pengumuman" SERIAL NOT NULL,
    "id_kelas" INTEGER NOT NULL,
    "id_pengajar" INTEGER NOT NULL,
    "isi" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengumuman_kelas_pkey" PRIMARY KEY ("id_pengumuman")
);

-- CreateIndex
CREATE INDEX "pengumuman_kelas_id_kelas_dibuat_pada_idx" ON "pengumuman_kelas"("id_kelas", "dibuat_pada");

-- AddForeignKey
ALTER TABLE "pengumuman_kelas" ADD CONSTRAINT "pengumuman_kelas_id_kelas_fkey" FOREIGN KEY ("id_kelas") REFERENCES "kelas_pelatihan"("id_kelas") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengumuman_kelas" ADD CONSTRAINT "pengumuman_kelas_id_pengajar_fkey" FOREIGN KEY ("id_pengajar") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

