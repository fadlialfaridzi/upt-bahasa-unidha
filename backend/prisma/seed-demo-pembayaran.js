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

// unggahJam = berapa jam lalu bukti diunggah. Nominal pembayaran = nominal tagihan/cicilan (sama seperti alur unggah asli).
const SKENARIO = [
  { peserta: 'nadia', kelas: 'conv', cicilan: 3, termin: 1, unggahJam: 2 },
  { peserta: 'andi', kelas: 'conv', unggahJam: 5 },
  { peserta: 'siti', kelas: 'ielts', cicilan: 2, termin: 2, unggahJam: 20 },
  { peserta: 'budi', kelas: 'ielts', unggahJam: 30 },
  { peserta: 'fajar', kelas: 'conv', unggahJam: 50, hasil: 'terverifikasi' },
  { peserta: 'dewi', kelas: 'ielts', unggahJam: 70, hasil: 'ditolak', catatan: 'Bukti transfer buram, nomor referensi tidak terbaca. Silakan unggah ulang.' },
];

const escXml = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const pad2 = (n) => String(n).padStart(2, '0');

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function terbilang(n) {
  n = Math.floor(n);
  if (n < 12) return SATUAN[n];
  const sisa = (x, m) => (x % m ? ' ' + terbilang(x % m) : '');
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh${sisa(n, 10)}`;
  if (n < 200) return `seratus${sisa(n, 100)}`;
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus${sisa(n, 100)}`;
  if (n < 2000) return `seribu${sisa(n, 1000)}`;
  if (n < 1e6) return `${terbilang(Math.floor(n / 1000))} ribu${sisa(n, 1000)}`;
  return `${terbilang(Math.floor(n / 1e6))} juta${sisa(n, 1e6)}`;
}

/** Pecah teks per kata agar tiap baris <= maks karakter. */
function bungkus(teks, maks) {
  const baris = [''];
  for (const kata of teks.split(' ')) {
    const akhir = baris.length - 1;
    if ((baris[akhir] + ' ' + kata).trim().length > maks) baris.push(kata);
    else baris[akhir] = (baris[akhir] + ' ' + kata).trim();
  }
  return baris;
}

/**
 * Foto tiruan (SVG) slip setoran tunai kertas dari teller Bank Nagari di kampus Unidha,
 * tergeletak di meja. Peserta membayar langsung di bank lalu memfoto slip ini.
 */
function buatBuktiSvg({ pengirim, nominal, waktu, referensi, keterangan, buram }) {
  // Setoran di loket (jam layanan bank 08-15 WIB), sebelum peserta memfoto & mengunggah slip
  const w = new Date(waktu.getTime() + 7 * JAM); // WIB
  if (w.getUTCHours() < 15) w.setUTCDate(w.getUTCDate() - 1);
  const h = [...referensi].reduce((x, c) => (x * 31 + c.charCodeAt(0)) % 9973, 7);
  w.setUTCHours(8 + (h % 7), (h * 7) % 60, (h * 13) % 60);
  const tgl = `${pad2(w.getUTCDate())}/${pad2(w.getUTCMonth() + 1)}/${w.getUTCFullYear()}`;
  const jam = `${pad2(w.getUTCHours())}:${pad2(w.getUTCMinutes())}:${pad2(w.getUTCSeconds())}`;
  const jumlah = `Rp ${Number(nominal).toLocaleString('id-ID')},00`;
  const kata = terbilang(Number(nominal));
  const ejaan = bungkus(`# ${kata.charAt(0).toUpperCase() + kata.slice(1)} rupiah #`, 46);

  const MONO = 'font-family="Courier New, Courier, monospace"';
  const baris = [
    ['TANGGAL', tgl],
    ['JAM', jam],
    ['NO. REF', referensi],
    ['PENYETOR', pengirim.toUpperCase()],
    ['UNTUK', 'UPT BAHASA UNIDHA'],
    ['BERITA', keterangan],
    ['TELLER', 'TLR-03 / KAS UNIDHA'],
  ]
    .map(([k, v], i) => {
      const y = 216 + i * 21;
      return `<text x="86" y="${y}">${k}</text><text x="168" y="${y}">:</text><text x="180" y="${y}">${escXml(v)}</text>`;
    })
    .join('');

  // Tepi bawah kertas bergerigi (sobekan dari printer slip)
  let gerigi = '';
  for (let x = 418; x >= 62; x -= 8) gerigi += ` L${x} ${x % 16 === 2 ? 604 : 598}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <linearGradient id="meja" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b7358"/><stop offset="1" stop-color="#5f4c3a"/>
    </linearGradient>
    <filter id="serat"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.35" numOctaves="2" seed="3"/>
      <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.13  0 0 0 0 0.07  0 0 0 0.35 0"/></filter>
    <filter id="butir"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
      <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0.12 0"/></filter>
    <filter id="bayang" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="5" dy="9" stdDeviation="7" flood-color="#000" flood-opacity="0.4"/></filter>
    <filter id="tinta"><feTurbulence baseFrequency="0.55" numOctaves="1" seed="11"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter>
    <radialGradient id="vignet" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.38"/>
    </radialGradient>
    <linearGradient id="cahaya" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="kertas"><path d="M62 40 H418 V598${gerigi} Z"/></clipPath>
    ${buram ? '<filter id="buram"><feGaussianBlur stdDeviation="2.4"/></filter>' : ''}
  </defs>
  <g ${buram ? 'filter="url(#buram)"' : ''}>
    <rect width="480" height="640" fill="url(#meja)"/>
    <rect width="480" height="640" filter="url(#serat)"/>
    <g transform="rotate(-2.4 240 320)">
      <path d="M62 40 H418 V598${gerigi} Z" fill="#fbf8f0" filter="url(#bayang)"/>
      <g clip-path="url(#kertas)">
        <rect x="62" y="40" width="356" height="570" filter="url(#butir)"/>
        <rect x="62" y="40" width="356" height="570" fill="url(#cahaya)"/>
      </g>
      <g fill="#2d2a26">
        <rect x="86" y="62" width="34" height="34" rx="7" fill="#1f6b45"/>
        <text x="103" y="86" font-size="18" font-weight="700" fill="#fbf8f0" text-anchor="middle">N</text>
        <text x="130" y="80" font-size="19" font-weight="700" fill="#1f6b45" letter-spacing="1">BANK NAGARI</text>
        <text x="131" y="95" font-size="10" fill="#1f6b45" letter-spacing="4">SYARIAH</text>
        <text x="240" y="122" font-size="10" text-anchor="middle" fill="#55514b">Kantor Kas Universitas Dharma Andalas</text>
        <line x1="84" y1="136" x2="396" y2="136" stroke="#55514b" stroke-dasharray="4 3"/>
        <g ${MONO}>
          <text x="240" y="160" font-size="15" font-weight="700" text-anchor="middle">BUKTI SETORAN TUNAI</text>
          <text x="240" y="177" font-size="10.5" text-anchor="middle">Pembayaran Layanan UPT Bahasa</text>
        </g>
        <line x1="84" y1="190" x2="396" y2="190" stroke="#55514b" stroke-dasharray="4 3"/>
        <g ${MONO} font-size="12">${baris}</g>
        <line x1="84" y1="372" x2="396" y2="372" stroke="#55514b" stroke-dasharray="4 3"/>
        <g ${MONO}>
          <text x="86" y="398" font-size="12">JUMLAH</text>
          <text x="396" y="400" font-size="19" font-weight="700" text-anchor="end">${escXml(jumlah)}</text>
          ${ejaan.map((t, i) => `<text x="86" y="${422 + i * 15}" font-size="10.5" font-style="italic">${escXml(t)}</text>`).join('')}
        </g>
        <line x1="84" y1="${434 + ejaan.length * 15}" x2="396" y2="${434 + ejaan.length * 15}" stroke="#55514b" stroke-dasharray="4 3"/>
        <g font-size="10" fill="#55514b" text-anchor="middle">
          <text x="140" y="500">Penyetor</text><text x="330" y="500">Teller</text>
          <line x1="96" y1="552" x2="184" y2="552" stroke="#8a857c"/><line x1="286" y1="552" x2="374" y2="552" stroke="#8a857c"/>
        </g>
        <path d="M104 540 c10 -22 18 -24 20 -6 c2 14 10 -18 22 -10 c8 6 4 12 14 4 c6 -4 10 -2 16 2" fill="none" stroke="#1d2a6b" stroke-width="1.6"/>
        <path d="M298 542 c6 -16 14 -20 18 -8 c4 10 8 -12 18 -6 c10 6 14 -4 30 -2" fill="none" stroke="#1d2a6b" stroke-width="1.6"/>
        <g transform="translate(326 536) rotate(-11)" opacity="0.72" filter="url(#tinta)" fill="#27449c" stroke="#27449c" text-anchor="middle">
          <rect x="-72" y="-31" width="144" height="62" rx="7" fill="none" stroke-width="2.6"/>
          <rect x="-66" y="-25" width="132" height="50" rx="5" fill="none" stroke-width="1"/>
          <text y="-10" font-size="8.5" font-weight="700" stroke="none">BANK NAGARI SYARIAH</text>
          <text y="10" font-size="18" font-weight="700" stroke="none" letter-spacing="3">LUNAS</text>
          <text y="21" font-size="8" stroke="none">${tgl}</text>
        </g>
        <text x="240" y="584" ${MONO} font-size="9" text-anchor="middle" fill="#8a857c">*** DATA DEMO - BUKAN BUKTI ASLI ***</text>
      </g>
    </g>
    <rect width="480" height="640" fill="url(#vignet)"/>
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
      let nominalDibayar = total;
      let keterangan = kode;

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
            nominalDibayar = nominal;
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
