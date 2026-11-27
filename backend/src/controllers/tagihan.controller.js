// Tagihan saya (peserta): semua tagihan TOEFL, pelatihan, dan penerjemahan dalam satu daftar seragam.
// Unggah bukti tetap memakai endpoint masing-masing layanan (alurnya berbeda); controller ini hanya
// menyatukan tampilan + membuka berkas bukti milik peserta sendiri.
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma.js';
import { fmtJam } from '../utils/waktu.js';

const UPLOAD_DIR = path.resolve('uploads');
const SELESAI = ['lunas', 'kedaluwarsa', 'dibatalkan'];
const KOSONG = (v) => !v || /^\{.*\}$/.test(v.trim()); // parameter belum diisi, mis. "{isi}"

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const milikSaya = (idPengguna) => ({
  OR: [
    { pendaftaran_pelatihan: { id_pengguna: idPengguna } },
    { pendaftaran_toefl: { id_pengguna: idPengguna } },
    { pesanan_terjemahan: { id_pemohon: idPengguna } },
  ],
});

const ringkasBayar = (p) => (p ? {
  id_pembayaran: p.id_pembayaran,
  status: p.status,
  nominal: Number(p.nominal),
  tanggal_unggah: p.tanggal_unggah,
  tanggal_verifikasi: p.tanggal_verifikasi,
  catatan: p.catatan,
} : null);

/** Nama & keterangan layanan dari sumber tagihan. */
function layananDari(t) {
  if (t.pendaftaran_pelatihan) {
    const k = t.pendaftaran_pelatihan.kelas_pelatihan;
    return {
      nama: k.nama_kelas,
      detail: `Pelatihan · ${k.jumlah_pertemuan} pertemuan`,
      id_kelas: k.id_kelas,
      status_pendaftaran: t.pendaftaran_pelatihan.status,
    };
  }
  if (t.pendaftaran_toefl) {
    const s = t.pendaftaran_toefl.sesi_toefl;
    const jadwal = [s?.tanggal && s.tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), s?.jam_mulai && `${fmtJam(s.jam_mulai)} WIB`, s?.ruang].filter(Boolean).join(' · ');
    return {
      nama: s?.nama_sesi || 'Tes TOEFL',
      detail: jadwal ? `Tes TOEFL · ${jadwal}` : 'Tes TOEFL',
      id_pendaftaran: t.pendaftaran_toefl.id_pendaftaran,
      status_pendaftaran: t.pendaftaran_toefl.status,
    };
  }
  const p = t.pesanan_terjemahan;
  return {
    nama: `Penerjemahan dokumen #${p.id_pesanan}`,
    detail: `${p.tarif_penerjemahan?.jenis_dokumen ?? 'Dokumen'} · ${p.tarif_penerjemahan?.bahasa_asal ?? ''} → ${p.tarif_penerjemahan?.bahasa_tujuan ?? ''}${p.jumlah_halaman ? ` · ${p.jumlah_halaman} halaman` : ''}`,
    id_pesanan: p.id_pesanan,
    status_pendaftaran: p.status,
  };
}

function bentukTagihan(t) {
  const skema = t.skema_angsuran.find((s) => s.status === 'disetujui') ?? null;
  const terbayar = t.pembayaran.filter((p) => p.status === 'terverifikasi').reduce((n, p) => n + Number(p.nominal), 0);
  const total = Number(t.total_tagihan);
  const jenis = t.jenis_layanan;
  const pembayaranLunas = ringkasBayar(t.pembayaran.find((p) => !p.id_cicilan) ?? null);
  const selesai = SELESAI.includes(t.status);

  // Aturan unggah mengikuti endpoint tiap layanan
  let unggah = { bisa: false, label: null, alasan: null };
  if (jenis === 'penerjemahan') {
    unggah.alasan = 'Pembayaran penerjemahan belum bisa diunggah dari sistem';
  } else if (!selesai && !skema) {
    if (jenis === 'toefl') {
      const terkunci = pembayaranLunas && pembayaranLunas.status !== 'ditolak';
      unggah = { bisa: !terkunci, label: pembayaranLunas?.status === 'ditolak' ? 'Unggah ulang bukti' : 'Unggah bukti bayar', alasan: terkunci ? 'Bukti sedang/telah diverifikasi' : null };
    } else {
      unggah = { bisa: true, label: pembayaranLunas?.status === 'menunggu' ? 'Ganti bukti' : pembayaranLunas?.status === 'ditolak' ? 'Unggah ulang bukti' : 'Unggah bukti bayar', alasan: null };
    }
  }

  const cicilan = skema
    ? skema.cicilan.map((c) => ({
      id_cicilan: c.id_cicilan,
      cicilan_ke: c.cicilan_ke,
      nominal: Number(c.nominal),
      jatuh_tempo: c.jatuh_tempo,
      kode_termin: c.kode_tagihan_termin,
      status: c.status,
      pembayaran: ringkasBayar(c.pembayaran),
      bisa_unggah: !selesai && ['menunggu_pembayaran', 'menunggu_verifikasi'].includes(c.status),
      label_unggah: c.status === 'menunggu_verifikasi' ? 'Ganti bukti' : c.pembayaran?.status === 'ditolak' ? 'Unggah ulang bukti' : 'Unggah bukti bayar',
    }))
    : null;

  // Yang harus dibayar sekarang
  let jatuhSekarang = 0;
  if (cicilan) jatuhSekarang = cicilan.filter((c) => c.status === 'menunggu_pembayaran').reduce((n, c) => n + c.nominal, 0);
  else if (!selesai && t.status !== 'menunggu_verifikasi') jatuhSekarang = Math.max(0, total - terbayar);

  return {
    id_tagihan: t.id_tagihan,
    kode_tagihan: t.kode_tagihan,
    jenis_layanan: jenis,
    status: t.status,
    total_tagihan: total,
    terbayar,
    sisa: Math.max(0, total - terbayar),
    harus_dibayar: jatuhSekarang,
    tanggal_terbit: t.tanggal_terbit,
    batas_bayar: t.batas_bayar,
    layanan: layananDari(t),
    skema: skema ? { jumlah_cicilan: skema.jumlah_cicilan } : null,
    cicilan,
    pembayaran: pembayaranLunas,
    unggah,
  };
}

// GET /api/tagihan/saya
export const getTagihanSaya = async (req, res, next) => {
  try {
    const [daftar, param] = await Promise.all([
      prisma.tagihan.findMany({
        where: milikSaya(req.user.id),
        include: {
          pendaftaran_pelatihan: { include: { kelas_pelatihan: { select: { id_kelas: true, nama_kelas: true, jumlah_pertemuan: true } } } },
          pendaftaran_toefl: { include: { sesi_toefl: { select: { nama_sesi: true, tanggal: true, jam_mulai: true, ruang: true } } } },
          pesanan_terjemahan: { include: { tarif_penerjemahan: { select: { jenis_dokumen: true, bahasa_asal: true, bahasa_tujuan: true } } } },
          skema_angsuran: { include: { cicilan: { orderBy: { cicilan_ke: 'asc' }, include: { pembayaran: true } } } },
          pembayaran: { orderBy: { tanggal_unggah: 'desc' } },
        },
        orderBy: { tanggal_terbit: 'desc' },
      }),
      prisma.parameter_sistem.findMany({ where: { kunci: { in: ['bank_tujuan', 'no_rekening_tujuan', 'atas_nama_rekening'] } } }),
    ]);
    const p = Object.fromEntries(param.map((x) => [x.kunci, x.nilai]));
    const data = daftar.map(bentukTagihan);

    res.json({
      data,
      ringkasan: {
        harus_dibayar: data.reduce((n, t) => n + t.harus_dibayar, 0),
        perlu_dibayar: data.filter((t) => t.harus_dibayar > 0).length,
        menunggu_verifikasi: data.filter((t) => t.status === 'menunggu_verifikasi' || t.cicilan?.some((c) => c.status === 'menunggu_verifikasi')).length,
        lunas: data.filter((t) => t.status === 'lunas').length,
      },
      rekening: {
        bank: KOSONG(p.bank_tujuan) ? 'Bank Nagari Syariah' : p.bank_tujuan,
        nomor: KOSONG(p.no_rekening_tujuan) ? null : p.no_rekening_tujuan,
        atas_nama: KOSONG(p.atas_nama_rekening) ? null : p.atas_nama_rekening,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tagihan/:id/bukti?cicilan=<id_cicilan>  -> berkas bukti milik peserta sendiri
export const getBuktiTagihanSaya = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID tagihan tidak valid' });
    const tagihan = await prisma.tagihan.findFirst({ where: { id_tagihan: id, ...milikSaya(req.user.id) }, select: { id_tagihan: true } });
    if (!tagihan) return res.status(404).json({ message: 'Tagihan tidak ditemukan' });
    const idCicilan = req.query.cicilan ? parseId(req.query.cicilan) : null;
    const bayar = await prisma.pembayaran.findFirst({
      where: { id_tagihan: id, id_cicilan: idCicilan },
      orderBy: { tanggal_unggah: 'desc' },
    });
    const file = bayar && path.resolve(bayar.bukti_path);
    if (!file || !file.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(file)) {
      return res.status(404).json({ message: 'Bukti pembayaran belum tersedia' });
    }
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(file);
  } catch (err) {
    next(err);
  }
};
