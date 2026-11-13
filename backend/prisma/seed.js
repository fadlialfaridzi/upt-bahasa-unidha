import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Role akun hanya 4 (lihat migrasi 20261113140000_sederhanakan_role). ID lama dipertahankan.
const ROLES = [
  { id_role: 1, nama_role: 'peserta', keterangan: 'Mahasiswa atau peserta umum' },
  { id_role: 3, nama_role: 'pengajar', keterangan: 'Dosen: mengajar kelas pelatihan' },
  { id_role: 4, nama_role: 'staf_upt', keterangan: 'Admin UPT: kelola layanan, jadwal, pembayaran, sertifikat, dan persetujuan' },
  { id_role: 6, nama_role: 'super_admin', keterangan: 'Tim IT: kelola akun, hak akses, dan pemeliharaan sistem' },
];

const PARAMETER_SISTEM = [
  { kunci: 'kuota_min_toefl', nilai: '8', keterangan: 'Nilai awal kuota minimum saat sesi TOEFL dibuat (A1: 8 sampai 10)' },
  { kunci: 'kuota_maks_toefl', nilai: '10', keterangan: 'Nilai awal kuota maksimum saat sesi TOEFL dibuat (ASUMSI)' },
  { kunci: 'ambang_ews_persen', nilai: '75', keterangan: 'Ambang batas kehadiran EWS (ASUMSI, belum ditetapkan UPT)' },
  { kunci: 'kehadiran_min_lulus_persen', nilai: '75', keterangan: 'Syarat kehadiran kelulusan pelatihan (ASUMSI, belum ditetapkan UPT)' },
  { kunci: 'nilai_lulus_posttest', nilai: '70', keterangan: 'Nilai minimum post-test untuk lulus pelatihan (ASUMSI, belum ditetapkan UPT)' },
  { kunci: 'bank_tujuan', nilai: 'Bank Nagari Syariah', keterangan: 'Bank rekening resmi kampus, dicetak pada slip tagihan (UC-7)' },
  { kunci: 'no_rekening_tujuan', nilai: '{isi}', keterangan: 'Nomor rekening resmi kampus (UC-7), wajib diisi sebelum operasional' },
  { kunci: 'atas_nama_rekening', nilai: '{isi}', keterangan: 'Nama pemilik rekening resmi kampus (UC-7), wajib diisi sebelum operasional' },
  { kunci: 'batas_bayar_hari', nilai: '3', keterangan: 'Jumlah hari batas pembayaran sejak tagihan terbit (ASUMSI)' },
  { kunci: 'maks_ukuran_unggah_mb', nilai: '5', keterangan: 'Batas ukuran berkas unggahan UC-8, UC-10, UC-04, UC-26 (ASUMSI)' },
];

const PERTANYAAN_KUESIONER = [
  { id_pertanyaan: 1, teks_pertanyaan: 'Penguasaan materi oleh pengajar (contoh pertanyaan, sesuaikan dengan instrumen UPT)', urutan: 1 },
  { id_pertanyaan: 2, teks_pertanyaan: 'Metode penyampaian pembelajaran (contoh pertanyaan)', urutan: 2 },
  { id_pertanyaan: 3, teks_pertanyaan: 'Kedisiplinan pengajar (contoh pertanyaan)', urutan: 3 },
];

const DEMO_PASSWORD = 'password123';

// id_role: 1 peserta, 3 pengajar, 4 staf_upt, 6 super_admin
const DEMO_ACCOUNTS = [
  { email: 'superadmin@uptbahasa.ac.id', username: 'superadmin', nama_lengkap: 'Tim IT UPT Bahasa', id_role: 6, tipe_pengguna: 'internal', no_hp: '081200000001' },
  { email: 'admin@uptbahasa.ac.id', username: 'admin', nama_lengkap: 'Rina Kartika', id_role: 4, tipe_pengguna: 'internal', no_hp: '081200000002' },
  { email: 'dosen@uptbahasa.ac.id', username: 'dosen', nama_lengkap: 'Rizki Pratama', id_role: 3, tipe_pengguna: 'internal', no_hp: '081200000003' },
  {
    email: 'mahasiswa@uptbahasa.ac.id', username: 'mahasiswa', nama_lengkap: 'Nadia Amelia', id_role: 1,
    tipe_pengguna: 'mahasiswa', nim: '2024102018', program_studi: 'Sistem Informasi', no_hp: '081200000004',
  },
];

// Setelah insert dengan ID eksplisit, sequence autoincrement PostgreSQL harus disejajarkan.
async function syncSequence(table, column) {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', '${column}'), COALESCE((SELECT MAX("${column}") FROM "${table}"), 1))`
  );
}

async function main() {
  console.log('Memulai seeding database...');

  for (const r of ROLES) {
    await prisma.role.upsert({ where: { id_role: r.id_role }, update: r, create: r });
  }
  await syncSequence('role', 'id_role');
  console.log(`Role: ${ROLES.length}`);

  for (const p of PARAMETER_SISTEM) {
    await prisma.parameter_sistem.upsert({ where: { kunci: p.kunci }, update: {}, create: p });
  }
  console.log(`Parameter sistem: ${PARAMETER_SISTEM.length}`);

  for (const q of PERTANYAAN_KUESIONER) {
    await prisma.pertanyaan_kuesioner.upsert({ where: { id_pertanyaan: q.id_pertanyaan }, update: {}, create: q });
  }
  await syncSequence('pertanyaan_kuesioner', 'id_pertanyaan');
  console.log(`Pertanyaan kuesioner: ${PERTANYAAN_KUESIONER.length}`);

  // Akun demo SEMENTARA (password sama: password123). Di-reset setiap seed dijalankan.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const akun of DEMO_ACCOUNTS) {
    const data = { ...akun, password_hash: passwordHash, status_aktif: true };
    await prisma.pengguna.upsert({ where: { email: akun.email }, update: data, create: data });
  }
  console.log(`Akun demo: ${DEMO_ACCOUNTS.map((a) => a.email).join(', ')}`);

  // Contoh data (hanya dibuat jika tabel masih kosong)
  if ((await prisma.sesi_toefl.count()) === 0) {
    await prisma.sesi_toefl.create({
      data: {
        nama_sesi: 'Tes TOEFL Reguler Desember 2026',
        batas_pendaftaran: new Date('2026-12-10T23:59:00+07:00'),
        tanggal: new Date('2026-12-15'),
        jam_mulai: new Date('1970-01-01T08:00:00Z'),
        jam_selesai: new Date('1970-01-01T12:00:00Z'),
        ruang: 'Ruang UPT Bahasa Lantai 2',
        tarif: 150000,
      },
    });
    console.log('Contoh sesi TOEFL dibuat');
  }

  if ((await prisma.kelas_pelatihan.count()) === 0) {
    await prisma.kelas_pelatihan.create({
      data: {
        nama_kelas: 'Pelatihan TOEFL Intensif',
        jenis_pelatihan: 'toefl_preparation',
        tanggal_mulai: new Date('2026-12-01'),
        tarif: 500000,
      },
    });
    console.log('Contoh kelas pelatihan dibuat');
  }

  if ((await prisma.tarif_penerjemahan.count()) === 0) {
    await prisma.tarif_penerjemahan.createMany({
      data: [
        { jenis_dokumen: 'ijazah', bahasa_asal: 'Indonesia', bahasa_tujuan: 'Inggris', tarif_per_halaman: 50000 },
        { jenis_dokumen: 'jurnal', bahasa_asal: 'Indonesia', bahasa_tujuan: 'Inggris', tarif_per_halaman: 75000, estimasi_hari_per_halaman: 1 },
      ],
    });
    console.log('Contoh tarif penerjemahan dibuat');
  }

  console.log('Seeding selesai!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
