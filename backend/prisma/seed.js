import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Memulai seeding database...');

  // Buat akun admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@uptbahasa.ac.id' },
    update: {},
    create: {
      nama: 'Admin UPT Bahasa',
      email: 'admin@uptbahasa.ac.id',
      password: adminPassword,
      noHp: '08123456789',
      role: 'ADMIN',
    },
  });
  console.log('Admin dibuat:', admin.email);

  // Buat jadwal TOEFL contoh
  const jadwal1 = await prisma.jadwalToefl.upsert({
    where: { id: 'jadwal-toefl-1' },
    update: {},
    create: {
      id: 'jadwal-toefl-1',
      tanggal: new Date('2026-12-15'),
      waktu: '08:00 - 12:00 WIB',
      lokasi: 'Ruang UPT Bahasa Lantai 2',
      kuota: 30,
      biaya: 150000,
      keterangan: 'Tes TOEFL Reguler Desember 2026',
    },
  });
  console.log('Jadwal TOEFL dibuat:', jadwal1.id);

  // Buat pelatihan contoh
  const pelatihan1 = await prisma.pelatihan.upsert({
    where: { id: 'pelatihan-1' },
    update: {},
    create: {
      id: 'pelatihan-1',
      nama: 'Pelatihan TOEFL Intensif',
      deskripsi: 'Program pelatihan intensif untuk mempersiapkan peserta menghadapi tes TOEFL',
      tanggalMulai: new Date('2026-12-01'),
      tanggalSelesai: new Date('2026-12-14'),
      waktu: 'Senin - Jumat, 13:00 - 15:00 WIB',
      lokasi: 'Ruang Kelas UPT Bahasa',
      kuota: 20,
      biaya: 500000,
    },
  });
  console.log('Pelatihan dibuat:', pelatihan1.nama);

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
