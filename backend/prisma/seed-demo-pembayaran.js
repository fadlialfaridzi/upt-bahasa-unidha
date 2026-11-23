// Data dummy permintaan verifikasi pembayaran pelatihan (untuk demo/uji halaman admin).
//
//   npm run db:seed:demo-bayar           -> buat ulang data demo (data demo lama dihapus dulu)
//   npm run db:seed:demo-bayar -- --hapus -> hapus data demo saja
//
// Penanda data demo: kode tagihan berawalan "DEMO-", nama kelas berakhiran "(demo)",
// email peserta "demo.*@uptbahasa.ac.id", berkas bukti "uploads/demo-bukti-*.svg".
// Data lain (milik pengguna) tidak disentuh.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const UPLOADS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

const PREFIX_KODE = 'DEMO-';
const AKHIRAN_KELAS = '(demo)';
const EMAIL_DEMO = { startsWith: 'demo.', endsWith: '@uptbahasa.ac.id' };
const EMAIL_NADIA = 'mahasiswa@uptbahasa.ac.id'; // akun demo mahasiswa dari seed.js

const JAM = 3600000;
const HARI = 24 * JAM;

const KELAS = [
  { kunci: 'conv', nama_kelas: `Conversation Kelas Sore ${AKHIRAN_KELAS}`, jenis_pelatihan: 'conversation', tipe_kelas: 'kelas', jumlah_pertemuan: 20, kuota_maks: 15, tarif: 600000, mulaiHari: 10 },
  { kunci: 'ielts', nama_kelas: `IELTS Intensif ${AKHIRAN_KELAS}`, jenis_pelatihan: 'ielts', tipe_kelas: 'intensif', jumlah_pertemuan: 10, kuota_maks: 8, tarif: 1200000, mulaiHari: 6 },
];

const PESERTA = [
  { kunci: 'andi', nama_lengkap: 'Andi Pratama', nim: '2023101045', no_hp: '081266781234', jenis_kelamin: 'L', program_studi: 'Teknik Informatika' },
  { kunci: 'siti', nama_lengkap: 'Siti Rahma', nim: '2022103011', no_hp: '082170045566', jenis_kelamin: 'P', program_studi: 'Manajemen' },
  { kunci: 'budi', nama_lengkap: 'Budi Saputra', nim: '2023102077', no_hp: '085263301122', jenis_kelamin: 'L', program_studi: 'Akuntansi' },
  { kunci: 'fajar', nama_lengkap: 'Fajar Ramadhan', nim: '2024101009', no_hp: '081374459988', jenis_kelamin: 'L', program_studi: 'Sistem Informasi' },
  { kunci: 'dewi', nama_lengkap: 'Dewi Anggraini', nim: '2022104030', no_hp: '081378812200', jenis_kelamin: 'P', program_studi: 'Hukum' },
];

// unggahJam = berapa jam lalu bukti diunggah; bayar = nominal yang ditransfer (bila beda dari tagihan).
const SKENARIO = [
  { peserta: 'nadia', kelas: 'conv', cicilan: 3, termin: 1, unggahJam: 2 },
  { peserta: 'andi', kelas: 'conv', unggahJam: 5 },
  { peserta: 'siti', kelas: 'ielts', cicilan: 2, termin: 2, unggahJam: 20 },
  { peserta: 'budi', kelas: 'ielts', unggahJam: 30, bayar: 1000000 },
  { peserta: 'fajar', kelas: 'conv', unggahJam: 50, hasil: 'terverifikasi' },
  { peserta: 'dewi', kelas: 'ielts', unggahJam: 70, hasil: 'ditolak', catatan: 'Bukti transfer buram, nomor referensi tidak terbaca. Silakan unggah ulang.' },
];

const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const tanggalPanjang = (d) =>
  d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
const escXml = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

/** Gambar bukti transfer tiruan (SVG) supaya pratinjau di modal Tinjau terlihat. */
function buatBuktiSvg({ pengirim, nominal, waktu, referensi, keterangan, buram }) {
  const baris = [
    ['Tanggal', tanggalPanjang(waktu)],
    ['No. referensi', referensi],
    ['Rekening asal', `${pengirim}`],
    ['Bank tujuan', 'Bank Nagari Syariah'],
    ['Keterangan', keterangan],
  ];
  const isi = baris
    .map(([k, v], i) => {
      const y = 262 + i * 44;
      return `<text x="32" y="${y}" font-size="15" fill="#6b7280">${escXml(k)}</text>` +
        `<text x="388" y="${y}" font-size="15" fill="#111827" text-anchor="end" font-weight="600">${escXml(v)}</text>` +
        `<line x1="32" y1="${y + 16}" x2="388" y2="${y + 16}" stroke="#e5e7eb"/>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560" font-family="Arial, Helvetica, sans-serif">
  ${buram ? '<defs><filter id="b"><feGaussianBlur stdDeviation="2.6"/></filter></defs>' : ''}
  <g ${buram ? 'filter="url(#b)"' : ''}>
  <rect width="420" height="560" fill="#f3f4f6"/>
  <rect x="12" y="12" width="396" height="536" rx="14" fill="#ffffff"/>
  <rect x="12" y="12" width="396" height="70" rx="14" fill="#0f6b4f"/>
  <rect x="12" y="60" width="396" height="22" fill="#0f6b4f"/>
  <text x="32" y="55" font-size="20" fill="#ffffff" font-weight="700">Nagari Mobile</text>
  <circle cx="210" cy="128" r="26" fill="#dcfce7"/>
  <path d="M198 128 l8 8 l16 -16" stroke="#15803d" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="210" y="182" font-size="16" fill="#15803d" text-anchor="middle" font-weight="700">Transfer Berhasil</text>
  <text x="210" y="220" font-size="28" fill="#111827" text-anchor="middle" font-weight="700">${escXml(rupiah(nominal))}</text>
  ${isi}
  <text x="210" y="520" font-size="12" fill="#9ca3af" text-anchor="middle">DATA DEMO - bukan bukti transfer asli</text>
  </g>
</svg>`;
}

async function hapusDataDemo() {
  const tagihan = await prisma.tagihan.findMany({ where: { kode_tagihan: { startsWith: PREFIX_KODE } }, select: { id_tagihan: true } });
  const idTagihan = tagihan.map((t) => t.id_tagihan);
  const kelas = await prisma.kelas_pelatihan.findMany({ where: { nama_kelas: { endsWith: AKHIRAN_KELAS } }, select: { id_kelas: true } });
  const idKelas = kelas.map((k) => k.id_kelas);
  const pengguna = await prisma.pengguna.findMany({ where: { email: EMAIL_DEMO }, select: { id_pengguna: true } });
  const idPengguna = pengguna.map((p) => p.id_pengguna);

  await prisma.$transaction(async (tx) => {
    const pendaftaran = await tx.pendaftaran_pelatihan.findMany({
      where: { OR: [{ id_tagihan: { in: idTagihan } }, { id_kelas: { in: idKelas } }] },
      select: { id_pendaftaran: true },
    });
    const idDaftar = pendaftaran.map((p) => p.id_pendaftaran);
    await tx.presensi.deleteMany({ where: { OR: [{ id_pendaftaran: { in: idDaftar } }, { pertemuan_kelas: { id_kelas: { in: idKelas } } }] } });
    await tx.kuesioner_pengajar.deleteMany({ where: { id_pendaftaran: { in: idDaftar } } });
    await tx.pendaftaran_pelatihan.deleteMany({ where: { id_pendaftaran: { in: idDaftar } } });
    await tx.pembayaran.deleteMany({ where: { id_tagihan: { in: idTagihan } } });
    await tx.skema_angsuran.deleteMany({ where: { id_tagihan: { in: idTagihan } } }); // cicilan ikut terhapus (cascade)
    await tx.tagihan.deleteMany({ where: { id_tagihan: { in: idTagihan } } });
    await tx.pertemuan_kelas.deleteMany({ where: { id_kelas: { in: idKelas } } });
    await tx.materi.deleteMany({ where: { id_kelas: { in: idKelas } } });
    await tx.kelas_pelatihan.deleteMany({ where: { id_kelas: { in: idKelas } } });
    // Notifikasi pembayaran demo (termasuk yang terkirim ke akun Nadia saat admin memverifikasi data demo)
    await tx.notifikasi.deleteMany({ where: { OR: [{ id_pengguna: { in: idPengguna } }, { pesan: { contains: PREFIX_KODE } }] } });
    await tx.pengguna.deleteMany({ where: { id_pengguna: { in: idPengguna } } });
  });

  let berkas = 0;
  if (fs.existsSync(UPLOADS)) {
    for (const f of fs.readdirSync(UPLOADS)) {
      if (f.startsWith('demo-bukti-')) {
        fs.unlinkSync(path.join(UPLOADS, f));
        berkas++;
      }
    }
  }
  console.log(`Data demo dihapus: ${idTagihan.length} tagihan, ${idKelas.length} kelas, ${idPengguna.length} akun peserta, ${berkas} berkas bukti`);
}

async function buatDataDemo() {
  const sekarang = new Date();
  const tglKode = sekarang.toISOString().slice(0, 10).replace(/-/g, '');
  fs.mkdirSync(UPLOADS, { recursive: true });

  const nadia = await prisma.pengguna.findUnique({ where: { email: EMAIL_NADIA } });
  if (!nadia) throw new Error(`Akun ${EMAIL_NADIA} tidak ada. Jalankan "npm run db:seed" dulu.`);

  const hash = await bcrypt.hash('password123', 10);
  const peserta = { nadia };
  for (const p of PESERTA) {
    const { kunci, ...data } = p;
    peserta[kunci] = await prisma.pengguna.create({
      data: { ...data, id_role: 1, email: `demo.${kunci}@uptbahasa.ac.id`, password_hash: hash, tipe_pengguna: 'mahasiswa' },
    });
  }

  const kelas = {};
  for (const k of KELAS) {
    const { kunci, mulaiHari, ...data } = k;
    kelas[kunci] = await prisma.kelas_pelatihan.create({
      data: { ...data, status: 'dibuka', tanggal_mulai: new Date(sekarang.getTime() + mulaiHari * HARI) },
    });
  }

  let urut = 0;
  for (const s of SKENARIO) {
    urut++;
    const orang = peserta[s.peserta];
    const kls = kelas[s.kelas];
    const total = Number(kls.tarif);
    const kode = `${PREFIX_KODE}PLT-${tglKode}-${String(urut).padStart(4, '0')}`;
    const waktuUnggah = new Date(sekarang.getTime() - s.unggahJam * JAM);
    const waktuDaftar = new Date(waktuUnggah.getTime() - (s.termin === 2 ? 9 * HARI : 6 * JAM));
    const batasBayar = new Date(waktuDaftar.getTime() + 3 * HARI);
    const hasil = s.hasil ?? 'menunggu';

    await prisma.$transaction(async (tx) => {
      // Status tagihan & pendaftaran mengikuti alur controller (Fadli: daftar & unggah, #67: verifikasi)
      let statusTagihan = 'menunggu_verifikasi';
      let statusDaftar = 'menunggu_pembayaran';
      if (hasil === 'terverifikasi') { statusTagihan = 'lunas'; statusDaftar = 'terverifikasi'; }
      if (hasil === 'ditolak') statusTagihan = 'menunggu_pembayaran';
      if (s.termin === 2) { statusTagihan = 'menunggu_verifikasi'; statusDaftar = 'terverifikasi'; } // cicilan 1 sudah diterima

      const tagihan = await tx.tagihan.create({
        data: { kode_tagihan: kode, jenis_layanan: 'pelatihan', total_tagihan: total, status: statusTagihan, tanggal_terbit: waktuDaftar, batas_bayar: batasBayar },
      });
      await tx.pendaftaran_pelatihan.create({
        data: { id_pengguna: orang.id_pengguna, id_kelas: kls.id_kelas, id_tagihan: tagihan.id_tagihan, status: statusDaftar, tanggal_daftar: waktuDaftar },
      });

      let idCicilan = null;
      let nominalDibayar = s.bayar ?? total;
      let keterangan = `Pelatihan ${kode}`;

      if (s.cicilan) {
        const skema = await tx.skema_angsuran.create({
          data: {
            id_tagihan: tagihan.id_tagihan, jumlah_cicilan: s.cicilan, alasan: 'Pengajuan cicilan pembayaran pelatihan',
            status: 'disetujui', catatan_putusan: `Skema angsuran ${s.cicilan}x disetujui otomatis`,
            tanggal_ajuan: waktuDaftar, tanggal_putusan: waktuDaftar,
          },
        });
        const rata = Math.floor(total / s.cicilan);
        for (let i = 1; i <= s.cicilan; i++) {
          const nominal = i === s.cicilan ? total - rata * (s.cicilan - 1) : rata;
          let status = 'belum_terbit';
          if (i < s.termin) status = 'lunas';
          else if (i === s.termin) status = 'menunggu_verifikasi';
          const jatuhTempo = i === 1 ? batasBayar : new Date(kls.tanggal_mulai.getTime() + Math.round((kls.jumlah_pertemuan / s.cicilan) * i) * 3 * HARI);
          const c = await tx.cicilan.create({
            data: { id_angsuran: skema.id_angsuran, cicilan_ke: i, nominal, jatuh_tempo: jatuhTempo, kode_tagihan_termin: `${kode}-T${i}`, status },
          });
          if (i < s.termin) {
            // Riwayat cicilan sebelumnya yang sudah diterima admin
            const waktuLama = new Date(waktuDaftar.getTime() + 4 * JAM);
            const fileLama = `demo-bukti-${urut}-t${i}.svg`;
            fs.writeFileSync(path.join(UPLOADS, fileLama), buatBuktiSvg({ pengirim: orang.nama_lengkap, nominal, waktu: waktuLama, referensi: `NGR${tglKode}${urut}${i}0417`, keterangan: `${kode}-T${i}` }));
            await tx.pembayaran.create({
              data: { id_tagihan: tagihan.id_tagihan, id_cicilan: c.id_cicilan, nominal, bukti_path: `uploads/${fileLama}`, tanggal_unggah: waktuLama, status: 'terverifikasi', tanggal_verifikasi: new Date(waktuLama.getTime() + 3 * JAM) },
            });
          }
          if (i === s.termin) {
            idCicilan = c.id_cicilan;
            nominalDibayar = s.bayar ?? nominal;
            keterangan = `${kode}-T${i}`;
          }
        }
      }

      const file = `demo-bukti-${urut}.svg`;
      fs.writeFileSync(path.join(UPLOADS, file), buatBuktiSvg({
        pengirim: orang.nama_lengkap, nominal: nominalDibayar, waktu: waktuUnggah,
        referensi: `NGR${tglKode}${String(urut).padStart(2, '0')}${String(783 + urut * 37).padStart(4, '0')}`,
        keterangan, buram: hasil === 'ditolak',
      }));
      await tx.pembayaran.create({
        data: {
          id_tagihan: tagihan.id_tagihan, id_cicilan: idCicilan, nominal: nominalDibayar, bukti_path: `uploads/${file}`,
          tanggal_unggah: waktuUnggah, status: hasil,
          tanggal_verifikasi: hasil === 'menunggu' ? null : new Date(waktuUnggah.getTime() + 2 * JAM),
          catatan: s.catatan ?? null,
        },
      });
      if (hasil !== 'menunggu') {
        await tx.notifikasi.create({
          data: {
            id_pengguna: orang.id_pengguna, jenis: 'pembayaran',
            judul: hasil === 'terverifikasi' ? 'Pembayaran diterima' : 'Pembayaran ditolak',
            pesan: hasil === 'terverifikasi'
              ? `Pembayaran ${kode} untuk ${kls.nama_kelas} telah diverifikasi.`
              : `Pembayaran ${kode} ditolak: ${s.catatan}`,
            waktu: new Date(waktuUnggah.getTime() + 2 * JAM),
          },
        });
      }
    });
  }

  const [menunggu, diterima, ditolak] = await Promise.all(
    ['menunggu', 'terverifikasi', 'ditolak'].map((status) => prisma.pembayaran.count({ where: { status, tagihan: { kode_tagihan: { startsWith: PREFIX_KODE } } } })),
  );
  console.log(`Data demo dibuat: ${SKENARIO.length} pendaftar, 2 kelas. Pembayaran: ${menunggu} menunggu, ${diterima} diterima, ${ditolak} ditolak.`);
  console.log('Akun peserta demo: demo.andi / demo.siti / demo.budi / demo.fajar / demo.dewi @uptbahasa.ac.id (password123)');
}

const hanyaHapus = process.argv.includes('--hapus');
hapusDataDemo()
  .then(() => (hanyaHapus ? null : buatDataDemo()))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
