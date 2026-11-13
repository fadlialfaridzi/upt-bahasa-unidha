-- CreateTable
CREATE TABLE "kegiatan_dosen" (
    "id_kegiatan" SERIAL NOT NULL,
    "id_pengajar" INTEGER NOT NULL,
    "judul" VARCHAR(100) NOT NULL,
    "hari" SMALLINT NOT NULL,
    "jam_mulai" TIME(0) NOT NULL,
    "jam_selesai" TIME(0) NOT NULL,
    "tanggal_mulai" DATE NOT NULL,
    "tanggal_selesai" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kegiatan_dosen_pkey" PRIMARY KEY ("id_kegiatan")
);

-- CreateIndex
CREATE INDEX "kegiatan_dosen_id_pengajar_hari_idx" ON "kegiatan_dosen"("id_pengajar", "hari");

-- AddForeignKey
ALTER TABLE "kegiatan_dosen" ADD CONSTRAINT "kegiatan_dosen_id_pengajar_fkey" FOREIGN KEY ("id_pengajar") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;

