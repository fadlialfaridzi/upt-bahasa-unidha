-- Role akun disederhanakan menjadi 4: super_admin, staf_upt (Admin UPT), pengajar (Dosen), peserta (Mahasiswa).
-- Role "kepala_upt" digabung ke staf_upt, "penerjemah" digabung ke pengajar.
-- Akun yang masih memakai role lama dipindahkan dulu agar tidak melanggar foreign key.

UPDATE "pengguna" SET "id_role" = (SELECT "id_role" FROM "role" WHERE "nama_role" = 'staf_upt')
WHERE "id_role" = (SELECT "id_role" FROM "role" WHERE "nama_role" = 'kepala_upt');

UPDATE "pengguna" SET "id_role" = (SELECT "id_role" FROM "role" WHERE "nama_role" = 'pengajar')
WHERE "id_role" = (SELECT "id_role" FROM "role" WHERE "nama_role" = 'penerjemah');

-- Role tambahan (switch role) yang memakai role lama: pindahkan, atau kosongkan bila jadi sama dengan role utama
UPDATE "pengguna" SET "id_role_ekstra" = (SELECT "id_role" FROM "role" WHERE "nama_role" = 'staf_upt')
WHERE "id_role_ekstra" = (SELECT "id_role" FROM "role" WHERE "nama_role" = 'kepala_upt');

UPDATE "pengguna" SET "id_role_ekstra" = (SELECT "id_role" FROM "role" WHERE "nama_role" = 'pengajar')
WHERE "id_role_ekstra" = (SELECT "id_role" FROM "role" WHERE "nama_role" = 'penerjemah');

UPDATE "pengguna" SET "id_role_ekstra" = NULL WHERE "id_role_ekstra" = "id_role";

DELETE FROM "role" WHERE "nama_role" IN ('kepala_upt', 'penerjemah');

UPDATE "role" SET "keterangan" = 'Admin UPT: kelola layanan, jadwal, pembayaran, sertifikat, dan persetujuan'
WHERE "nama_role" = 'staf_upt';

UPDATE "role" SET "keterangan" = 'Dosen: mengajar kelas pelatihan'
WHERE "nama_role" = 'pengajar';
