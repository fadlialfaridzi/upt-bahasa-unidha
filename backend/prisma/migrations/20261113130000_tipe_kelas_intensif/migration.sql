-- Tipe kelas "privat" tidak ada di UPT; diganti "intensif".
-- RENAME VALUE mempertahankan data: kelas yang sebelumnya "privat" otomatis menjadi "intensif".
ALTER TYPE "tipe_kelas" RENAME VALUE 'privat' TO 'intensif';
