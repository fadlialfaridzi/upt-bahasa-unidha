// Pencatatan presensi pertemuan oleh dosen: QR per pertemuan + input manual.
//
// Alur:
//   1. Pada hari pertemuan dosen mengisi masa berlaku QR (menit), lalu QR dibuat:
//      status_presensi 'dibuka', token_qr dibuat, waktu_tutup_presensi = sekarang + masa berlaku.
//      QR hanya bisa dibuat SEKALI per pertemuan (tidak bisa dibuat ulang / diganti / dibuka lagi).
//   2. Peserta memindai QR atau mengetik token di halaman Presensi & EWS (lihat "Sisi peserta" di bawah).
//   3. Dosen bisa menandai/mengoreksi manual kapan saja (hadir / izin / alpha).
//   4. Masa berlaku habis (atau dosen menutup lebih awal) -> status 'ditutup', peserta tanpa catatan = alpha.
//      Setelah itu scan tidak bisa lagi; perubahan hanya lewat input manual dosen.
//
// Sisi peserta (modul presensi & EWS mahasiswa, POST /api/pelatihan/presensi/scan):
//   - Isi QR: URL `<origin frontend>/dashboard/mahasiswa/presensi-ews?token=<token_qr>`
//     (urlPresensiQr di frontend config/pelatihan.js). Pemindai kamera membaca parameter token; kamera HP biasa membuka halaman
//     itu lalu presensi dikirim otomatis. Token juga ditampilkan agar bisa diketik manual.
//   - Scan diterima hanya jika status_presensi = 'dibuka', belum lewat waktu_tutup_presensi, dan peserta
//     terverifikasi di kelas itu.
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { fmtJam, fmtTanggal, namaHari, sekarangWIB, statusWaktu } from '../utils/waktu.js';

const STATUS_KEHADIRAN = ['hadir', 'izin', 'alpha'];
const JAM = 3600000;
export const BERLAKU_MIN = 1; // menit
export const BERLAKU_MAKS = 240; // menit (4 jam)

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Token mudah diketik (tanpa huruf/angka yang mirip: 0/O, 1/I/L), mis. PRS-7KQ2-XM4D (32^8 kombinasi)
const HURUF_TOKEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const buatToken = () => {
  const acak = Array.from({ length: 8 }, () => HURUF_TOKEN[crypto.randomInt(HURUF_TOKEN.length)]).join('');
  return `PRS-${acak.slice(0, 4)}-${acak.slice(4)}`;
};

/** Batas akhir hari pertemuan (23.59 WIB) sebagai instant sebenarnya. */
const akhirHariWIB = (tanggal) => new Date(tanggal.getTime() + 24 * JAM - 7 * JAM - 60000);

const includePertemuan = {
  kelas_pelatihan: { select: { id_kelas: true, nama_kelas: true, jenis_pelatihan: true, tipe_kelas: true, status: true } },
};

/** Ambil pertemuan milik dosen yang login; kirim respons error dan kembalikan null bila tidak boleh. */
async function pertemuanMilikDosen(req, res, db = prisma) {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ message: 'ID pertemuan tidak valid' });
    return null;
  }
  const p = await db.pertemuan_kelas.findUnique({ where: { id_pertemuan: id }, include: includePertemuan });
  if (!p) {
    res.status(404).json({ message: 'Pertemuan tidak ditemukan' });
    return null;
  }
  if (p.id_pengajar !== req.user.id) {
    res.status(403).json({ message: 'Anda bukan pengajar pertemuan ini' });
    return null;
  }
  return p;
}

const pesertaKelas = (db, idKelas) =>
  db.pendaftaran_pelatihan.findMany({
    where: { id_kelas: idKelas, status: 'terverifikasi' },
    select: { id_pendaftaran: true, pengguna: { select: { nama_lengkap: true, nim: true } } },
    orderBy: { pengguna: { nama_lengkap: 'asc' } },
  });

/** Tutup sesi: status 'ditutup', peserta yang belum tercatat diberi 'alpha'. */
async function tutupSesi(tx, p, waktuTutup) {
  const peserta = await pesertaKelas(tx, p.id_kelas);
  const sudah = new Set((await tx.presensi.findMany({ where: { id_pertemuan: p.id_pertemuan }, select: { id_pendaftaran: true } })).map((x) => x.id_pendaftaran));
  const belum = peserta.filter((d) => !sudah.has(d.id_pendaftaran));
  if (belum.length) {
    await tx.presensi.createMany({
      data: belum.map((d) => ({ id_pertemuan: p.id_pertemuan, id_pendaftaran: d.id_pendaftaran, status: 'alpha', waktu_scan: waktuTutup })),
      skipDuplicates: true,
    });
  }
  await tx.pertemuan_kelas.update({
    where: { id_pertemuan: p.id_pertemuan },
    data: { status_presensi: 'ditutup', waktu_tutup_presensi: waktuTutup },
  });
  return belum.length;
}

/** Sesi yang dibuka tetapi batas scan-nya sudah lewat ditutup otomatis saat data diminta. */
async function finalisasiJikaLewat(p) {
  if (p.status_presensi !== 'dibuka' || !p.waktu_tutup_presensi || p.waktu_tutup_presensi > new Date()) return false;
  await prisma.$transaction((tx) => tutupSesi(tx, p, p.waktu_tutup_presensi));
  return true;
}

/** Aturan aksi yang boleh dilakukan pada pertemuan saat ini. */
function aturan(p, now) {
  const hariIni = now.tanggal.getTime();
  const tgl = p.tanggal.getTime();
  let alasanBuka = null;
  if (p.status_presensi === 'dibuka') alasanBuka = 'QR presensi sedang berlaku';
  else if (p.token_qr) alasanBuka = 'QR pertemuan ini sudah pernah dibuat dan masa berlakunya telah berakhir. Koreksi kehadiran secara manual.';
  else if (tgl < hariIni) alasanBuka = 'Pertemuan sudah lewat. Catat kehadiran secara manual.';
  else if (tgl > hariIni) alasanBuka = 'Presensi QR baru bisa dibuka pada hari pertemuan';
  return {
    bisa_buka: alasanBuka === null,
    alasan_buka: alasanBuka,
    // Input manual boleh untuk pertemuan hari ini atau yang sudah lewat
    bisa_manual: tgl <= hariIni,
  };
}

async function bentukDetail(p) {
  const now = sekarangWIB();
  const [peserta, presensi, saudara] = await Promise.all([
    pesertaKelas(prisma, p.id_kelas),
    prisma.presensi.findMany({ where: { id_pertemuan: p.id_pertemuan }, select: { id_pendaftaran: true, status: true, waktu_scan: true } }),
    prisma.pertemuan_kelas.findMany({
      where: { id_kelas: p.id_kelas, id_pengajar: p.id_pengajar },
      select: { id_pertemuan: true, pertemuan_ke: true },
      orderBy: { pertemuan_ke: 'asc' },
    }),
  ]);
  const catatan = new Map(presensi.map((x) => [x.id_pendaftaran, x]));
  const daftar = peserta.map((d) => {
    const c = catatan.get(d.id_pendaftaran);
    return {
      id_pendaftaran: d.id_pendaftaran,
      nama_lengkap: d.pengguna.nama_lengkap,
      nim: d.pengguna.nim,
      status: c?.status ?? null,
      waktu: c?.waktu_scan ?? null,
    };
  });
  const hitung = (s) => daftar.filter((d) => d.status === s).length;
  const idx = saudara.findIndex((x) => x.id_pertemuan === p.id_pertemuan);

  return {
    pertemuan: {
      id_pertemuan: p.id_pertemuan,
      id_kelas: p.id_kelas,
      kelas: p.kelas_pelatihan,
      pertemuan_ke: p.pertemuan_ke,
      tanggal: fmtTanggal(p.tanggal),
      hari: namaHari(p.tanggal),
      jam_mulai: fmtJam(p.jam_mulai),
      jam_selesai: fmtJam(p.jam_selesai),
      ruang: p.ruang,
      topik: p.topik,
      status: statusWaktu(p, now),
      status_presensi: p.status_presensi,
      waktu_buka_presensi: p.waktu_buka_presensi,
      waktu_tutup_presensi: p.waktu_tutup_presensi,
      // Token hanya dikirim saat sesi dibuka, untuk ditampilkan sebagai QR
      token_qr: p.status_presensi === 'dibuka' ? p.token_qr : null,
      qr_pernah_dibuat: Boolean(p.token_qr),
      berlaku: { min: BERLAKU_MIN, maks: BERLAKU_MAKS, akhir_hari: akhirHariWIB(p.tanggal) },
      ...aturan(p, now),
    },
    peserta: daftar,
    ringkasan: { total: daftar.length, hadir: hitung('hadir'), izin: hitung('izin'), alpha: hitung('alpha'), belum: hitung(null) },
    navigasi: {
      sebelumnya: idx > 0 ? saudara[idx - 1].id_pertemuan : null,
      berikutnya: idx >= 0 && idx < saudara.length - 1 ? saudara[idx + 1].id_pertemuan : null,
      urutan: idx + 1,
      jumlah: saudara.length,
    },
  };
}

async function kirimDetail(res, id, extra = {}) {
  const p = await prisma.pertemuan_kelas.findUnique({ where: { id_pertemuan: id }, include: includePertemuan });
  res.json({ ...extra, data: await bentukDetail(p) });
}

// GET /api/presensi/pertemuan/:id
export const getPresensiPertemuan = async (req, res, next) => {
  try {
    const p = await pertemuanMilikDosen(req, res);
    if (!p) return;
    await finalisasiJikaLewat(p);
    await kirimDetail(res, p.id_pertemuan);
  } catch (err) {
    next(err);
  }
};

// POST /api/presensi/pertemuan/:id/buka  body: { berlaku_menit }  -> buat QR sekali dengan masa berlaku
export const bukaPresensi = async (req, res, next) => {
  try {
    const p = await pertemuanMilikDosen(req, res);
    if (!p) return;
    await finalisasiJikaLewat(p);
    const segar = await prisma.pertemuan_kelas.findUnique({ where: { id_pertemuan: p.id_pertemuan } });
    const a = aturan(segar, sekarangWIB());
    if (!a.bisa_buka) return res.status(409).json({ message: a.alasan_buka });

    const menitBerlaku = Number(req.body?.berlaku_menit);
    if (!Number.isInteger(menitBerlaku) || menitBerlaku < BERLAKU_MIN || menitBerlaku > BERLAKU_MAKS) {
      return res.status(400).json({ message: `Masa berlaku QR wajib diisi ${BERLAKU_MIN}–${BERLAKU_MAKS} menit` });
    }
    const now = new Date();
    const batas = new Date(now.getTime() + menitBerlaku * 60000);
    if (batas > akhirHariWIB(segar.tanggal)) {
      return res.status(400).json({ message: 'Masa berlaku QR tidak boleh melewati pukul 23.59 WIB hari pertemuan' });
    }

    // Klaim atomik: hanya berhasil bila QR belum pernah dibuat (mencegah klik ganda membuat 2 QR)
    const diklaim = await prisma.$transaction(async (tx) => {
      const { count } = await tx.pertemuan_kelas.updateMany({
        where: { id_pertemuan: p.id_pertemuan, token_qr: null },
        data: { status_presensi: 'dibuka', token_qr: buatToken(), waktu_buka_presensi: now, waktu_tutup_presensi: batas },
      });
      if (count) {
        await catatAudit(tx, req, {
          aksi: 'buka_presensi',
          entitas: 'pertemuan_kelas',
          idEntitas: p.id_pertemuan,
          detail: { id_kelas: p.id_kelas, pertemuan_ke: p.pertemuan_ke, berlaku_menit: menitBerlaku },
        });
      }
      return count;
    });
    if (!diklaim) return res.status(409).json({ message: 'QR pertemuan ini sudah dibuat' });
    await kirimDetail(res, p.id_pertemuan, { message: `QR presensi dibuat, berlaku ${menitBerlaku} menit.` });
  } catch (err) {
    next(err);
  }
};

// POST /api/presensi/pertemuan/:id/tutup  -> akhiri masa berlaku QR lebih awal (tidak bisa dibuka lagi)
export const tutupPresensi = async (req, res, next) => {
  try {
    const p = await pertemuanMilikDosen(req, res);
    if (!p) return;
    if (p.status_presensi !== 'dibuka') return res.status(409).json({ message: 'Presensi pertemuan ini tidak sedang dibuka' });

    const alpha = await prisma.$transaction(async (tx) => {
      const n = await tutupSesi(tx, p, new Date());
      await catatAudit(tx, req, { aksi: 'tutup_presensi', entitas: 'pertemuan_kelas', idEntitas: p.id_pertemuan, detail: { otomatis_alpha: n } });
      return n;
    });
    await kirimDetail(res, p.id_pertemuan, {
      message: alpha ? `Presensi ditutup. ${alpha} peserta yang belum tercatat ditandai alpha.` : 'Presensi ditutup',
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/presensi/pertemuan/:id  body: { daftar: [{ id_pendaftaran, status: 'hadir'|'izin'|'alpha'|null }] }
export const simpanPresensiManual = async (req, res, next) => {
  try {
    const p = await pertemuanMilikDosen(req, res);
    if (!p) return;
    await finalisasiJikaLewat(p);
    const segar = await prisma.pertemuan_kelas.findUnique({ where: { id_pertemuan: p.id_pertemuan } });
    if (!aturan(segar, sekarangWIB()).bisa_manual) {
      return res.status(409).json({ message: 'Kehadiran belum bisa dicatat karena pertemuan belum berlangsung' });
    }

    const daftar = req.body?.daftar;
    if (!Array.isArray(daftar) || daftar.length === 0) return res.status(400).json({ message: 'Daftar kehadiran kosong' });
    const valid = new Set((await pesertaKelas(prisma, p.id_kelas)).map((d) => d.id_pendaftaran));
    const sudah = new Set();
    for (const item of daftar) {
      const id = parseId(item?.id_pendaftaran);
      if (!id || !valid.has(id)) return res.status(400).json({ message: 'Ada peserta yang tidak terdaftar di kelas ini' });
      if (sudah.has(id)) return res.status(400).json({ message: 'Peserta tidak boleh muncul dua kali' });
      if (item.status !== null && !STATUS_KEHADIRAN.includes(item.status)) return res.status(400).json({ message: 'Status kehadiran tidak valid' });
      sudah.add(id);
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const { id_pendaftaran, status } of daftar) {
        const kunci = { id_pertemuan_id_pendaftaran: { id_pertemuan: p.id_pertemuan, id_pendaftaran: Number(id_pendaftaran) } };
        if (status === null) {
          await tx.presensi.deleteMany({ where: { id_pertemuan: p.id_pertemuan, id_pendaftaran: Number(id_pendaftaran) } });
        } else {
          const lama = await tx.presensi.findUnique({ where: kunci });
          if (!lama) await tx.presensi.create({ data: { id_pertemuan: p.id_pertemuan, id_pendaftaran: Number(id_pendaftaran), status, waktu_scan: now } });
          else if (lama.status !== status) await tx.presensi.update({ where: kunci, data: { status, waktu_scan: now } });
        }
      }
      // Pertemuan yang dicatat manual tanpa membuka QR dianggap sesi presensi yang sudah ditutup
      if (!segar.status_presensi) {
        await tx.pertemuan_kelas.update({
          where: { id_pertemuan: p.id_pertemuan },
          data: { status_presensi: 'ditutup', waktu_buka_presensi: now, waktu_tutup_presensi: now },
        });
      }
      await catatAudit(tx, req, { aksi: 'catat_presensi_manual', entitas: 'pertemuan_kelas', idEntitas: p.id_pertemuan, detail: { jumlah: daftar.length } });
    });
    await kirimDetail(res, p.id_pertemuan, { message: 'Kehadiran disimpan' });
  } catch (err) {
    next(err);
  }
};
