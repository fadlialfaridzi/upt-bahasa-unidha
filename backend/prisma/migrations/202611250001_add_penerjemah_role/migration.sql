INSERT INTO "role" ("id_role", "nama_role", "keterangan")
VALUES (5, 'penerjemah', 'Dosen penerjemah: mengelola job order layanan penerjemahan')
ON CONFLICT ("id_role") DO UPDATE
SET "nama_role" = EXCLUDED."nama_role",
    "keterangan" = EXCLUDED."keterangan";

SELECT setval(
  pg_get_serial_sequence('"role"', 'id_role'),
  COALESCE((SELECT MAX("id_role") FROM "role"), 1)
);
