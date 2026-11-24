// Validasi / verifikasi pembayaran (admin) - #67
// Melanjutkan alur unggah bukti peserta (#6/#25): pembayaran berstatus "menunggu" diperiksa admin
// lalu diterima (terverifikasi) atau ditolak dengan alasan.
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { fmtTanggal } from '../utils/waktu.js';

const STATUS = ['menunggu', 'terverifikasi', 'ditolak'];
const JENIS_LAYANAN = ['toefl', 'pelatihan', 'penerjemahan'];
const MAKS_CATATAN = 200;
const UPLOAD_DIR = path.resolve('uploads');

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const jenisBukti = (p) => (/\.pdf$/i.test(p) ? 'pdf' : 'gambar');

const includePembayaran = {
  cicilan: true,
  tagihan: {
    include: {
      skema_angsuran: { where: { status: 'disetujui' }, include: { cicilan: { orderBy: { cicilan_ke: 'asc' } } } },
      pendaftaran_pelatihan: {
        include: {
          pengguna: { select: { id_pengguna: true, nama_lengkap: true, email: true, nim: true, no_hp: true } },
          kelas_pelatihan: { select: { id_kelas: true, nama_kelas: true } },
        },
      },
      pendaftaran_toefl: {
        include: {
          pengguna: { select: { id_pengguna: true, nama_lengkap: true, email: true, nim: true, no_hp: true } },
          sesi_toefl: { select: { id_sesi: true, nama_sesi: true } },
        },
      },
      pesanan_terjemahan: {
        include: { pemohon: { select: { id_pengguna: true, nama_lengkap: true, email: true, nim: true, no_hp: true } } },
      },
    },
  },
};

/** Sumber tagihan (pendaftaran pelatihan / TOEFL / pesanan terjemahan) dalam bentuk seragam. */
const sumberTagihan = (t) => {
  if (t.pendaftaran_pelatihan) {
    return { pengguna: t.pendaftaran_pelatihan.pengguna, nama_layanan: t.pendaftaran_pelatihan.kelas_pelatihan.nama_kelas, id_kelas: t.pendaftaran_pelatihan.kelas_pelatihan.id_kelas };
  }
  if (t.pendaftaran_toefl) return { pengguna: t.pendaftaran_toefl.pengguna, nama_layanan: t.pendaftaran_toefl.sesi_toefl.nama_sesi };
  if (t.pesanan_terjemahan) return { pengguna: t.pesanan_terjemahan.pemohon, nama_layanan: `Penerjemahan #${t.pesanan_terjemahan.id_pesanan}` };
  return { pengguna: null, nama_layanan: '—' };
};

const toResponse = (p) => {
  const t = p.tagihan;
  const skema = t.skema_angsuran[0] ?? null;
  const sumber = sumberTagihan(t);
  return {
    id_pembayaran: p.id_pembayaran,
    status: p.status,
    nominal: p.nominal,
    tanggal_unggah: p.tanggal_unggah,
    tanggal_verifikasi: p.tanggal_verifikasi,
    catatan: p.catatan,
    jenis_bukti: jenisBukti(p.bukti_path),
    tagihan: {
      id_tagihan: t.id_tagihan,
      kode_tagihan: t.kode_tagihan,
      jenis_layanan: t.jenis_layanan,
      total_tagihan: t.total_tagihan,
      status: t.status,
      batas_bayar: t.batas_bayar ? fmtTanggal(t.batas_bayar) : null,
    },
    cicilan: p.cicilan
      ? {
          cicilan_ke: p.cicilan.cicilan_ke,
          jumlah_cicilan: skema?.jumlah_cicilan ?? null,
          nominal: p.cicilan.nominal,
          jatuh_tempo: fmtTanggal(p.cicilan.jatuh_tempo),
          kode_tagihan_termin: p.cicilan.kode_tagihan_termin,
        }
      : null,
    daftar_cicilan: skema?.cicilan.map((c) => ({ cicilan_ke: c.cicilan_ke, nominal: c.nominal, status: c.status, jatuh_tempo: fmtTanggal(c.jatuh_tempo) })) ?? [],
    pendaftar: sumber.pengguna && {
      nama_lengkap: sumber.pengguna.nama_lengkap,
      email: sumber.pengguna.email,
      nim: sumber.pengguna.nim,
      no_hp: sumber.pengguna.no_hp,
    },
    layanan: { nama: sumber.nama_layanan, id_kelas: sumber.id_kelas ?? null },
  };
};

// GET /api/pembayaran?status=menunggu&q=nadia
export const getDaftarPembayaran = async (req, res) => {
  try {
    const status = STATUS.includes(req.query.status) ? req.query.status : 'menunggu';
    const jenisLayanan = JENIS_LAYANAN.includes(req.query.jenis_layanan) ? req.query.jenis_layanan : null;
    const q = String(req.query.q ?? '').trim();
    const filters = [];
    if (q) {
      filters.push({
        OR: [
          { tagihan: { kode_tagihan: { contains: q, mode: 'insensitive' } } },
          { tagihan: { pendaftaran_pelatihan: { pengguna: { nama_lengkap: { contains: q, mode: 'insensitive' } } } } },
          { tagihan: { pendaftaran_pelatihan: { kelas_pelatihan: { nama_kelas: { contains: q, mode: 'insensitive' } } } } },
          { tagihan: { pendaftaran_toefl: { pengguna: { nama_lengkap: { contains: q, mode: 'insensitive' } } } } },
        ],
      });
    }
    if (jenisLayanan) filters.push({ tagihan: { jenis_layanan: jenisLayanan } });
    const where = { status, ...(filters.length ? { AND: filters } : {}) };
    const whereSummary = jenisLayanan ? { tagihan: { jenis_layanan: jenisLayanan } } : {};

    const [list, jumlah] = await Promise.all([
      prisma.pembayaran.findMany({
        where,
        include: includePembayaran,
        // Menunggu: yang paling lama mengantre lebih dulu; lainnya: keputusan terbaru lebih dulu
        orderBy: status === 'menunggu' ? { tanggal_unggah: 'asc' } : { tanggal_verifikasi: 'desc' },
        take: 200,
      }),
      prisma.pembayaran.groupBy({ by: ['status'], where: whereSummary, _count: { _all: true } }),
    ]);

    const hitung = Object.fromEntries(STATUS.map((s) => [s, 0]));
    for (const j of jumlah) hitung[j.status] = j._count._all;
    res.json({ data: list.map(toResponse), jumlah: hitung });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pembayaran', error: error.message });
  }
};

// GET /api/pembayaran/:id/bukti - file bukti (hanya admin; tidak lewat link publik)
export const getBuktiPembayaran = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const p = id && (await prisma.pembayaran.findUnique({ where: { id_pembayaran: id }, select: { bukti_path: true } }));
    if (!p) return res.status(404).json({ message: 'Pembayaran tidak ditemukan' });

    const file = path.resolve(p.bukti_path);
    // Cegah path traversal: file harus berada di dalam folder uploads
    if (!file.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(file)) {
      return res.status(404).json({ message: 'File bukti tidak ditemukan' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(file);
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuka file bukti', error: error.message });
  }
};

// POST /api/pembayaran/:id/verifikasi  Body: { keputusan: 'terima' | 'tolak', catatan }
export const verifikasiPembayaran = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID pembayaran tidak valid' });

    const keputusan = req.body.keputusan;
    if (!['terima', 'tolak'].includes(keputusan)) {
      return res.status(400).json({ message: 'Keputusan harus "terima" atau "tolak"' });
    }
    const catatan = String(req.body.catatan ?? '').trim() || null;
    if (keputusan === 'tolak' && (!catatan || catatan.length < 5)) {
      return res.status(400).json({ message: 'Alasan penolakan wajib diisi (minimal 5 karakter)' });
    }
    if (catatan && catatan.length > MAKS_CATATAN) {
      return res.status(400).json({ message: `Catatan maksimal ${MAKS_CATATAN} karakter` });
    }

    const hasil = await prisma.$transaction(async (tx) => {
      // Klaim pembayaran secara atomik: hanya yang masih "menunggu" yang bisa diproses (cegah proses ganda)
      const klaim = await tx.pembayaran.updateMany({
        where: { id_pembayaran: id, status: 'menunggu' },
        data: { status: keputusan === 'terima' ? 'terverifikasi' : 'ditolak', tanggal_verifikasi: new Date(), catatan },
      });
      if (klaim.count === 0) {
        const ada = await tx.pembayaran.findUnique({ where: { id_pembayaran: id }, select: { status: true } });
        throw Object.assign(new Error(ada ? `Pembayaran ini sudah diproses (${ada.status})` : 'Pembayaran tidak ditemukan'), { status: ada ? 409 : 404 });
      }

      const p = await tx.pembayaran.findUnique({ where: { id_pembayaran: id }, include: includePembayaran });
      const t = p.tagihan;
      const skema = t.skema_angsuran[0] ?? null;
      const cicilanLain = skema?.cicilan.filter((c) => c.id_cicilan !== p.id_cicilan) ?? [];
      let statusTagihan;

      if (keputusan === 'terima') {
        if (p.cicilan) {
          await tx.cicilan.update({ where: { id_cicilan: p.id_cicilan }, data: { status: 'lunas' } });
          // Terbitkan termin berikutnya
          const berikut = cicilanLain.find((c) => c.cicilan_ke === p.cicilan.cicilan_ke + 1 && c.status === 'belum_terbit');
          if (berikut) await tx.cicilan.update({ where: { id_cicilan: berikut.id_cicilan }, data: { status: 'menunggu_pembayaran' } });
          const semuaLunas = cicilanLain.every((c) => c.status === 'lunas');
          statusTagihan = semuaLunas ? 'lunas' : 'sebagian';
        } else {
          statusTagihan = 'lunas';
        }
        // Peserta resmi terdaftar sejak pembayaran pertama diterima (lunas atau cicilan pertama)
        if (t.pendaftaran_pelatihan?.status === 'menunggu_pembayaran') {
          await tx.pendaftaran_pelatihan.update({ where: { id_pendaftaran: t.pendaftaran_pelatihan.id_pendaftaran }, data: { status: 'terverifikasi' } });
        }
        if (t.pendaftaran_toefl?.status === 'menunggu_pembayaran') {
          await tx.pendaftaran_toefl.update({ where: { id_pendaftaran: t.pendaftaran_toefl.id_pendaftaran }, data: { status: 'terverifikasi' } });
        }
      } else {
        if (p.cicilan) await tx.cicilan.update({ where: { id_cicilan: p.id_cicilan }, data: { status: 'menunggu_pembayaran' } });
        // Kembali ke status sebelum bukti diunggah
        statusTagihan = cicilanLain.some((c) => c.status === 'lunas') ? 'sebagian' : 'menunggu_pembayaran';
      }
      await tx.tagihan.update({ where: { id_tagihan: t.id_tagihan }, data: { status: statusTagihan } });

      // Notifikasi ke peserta
      const sumber = sumberTagihan(t);
      const bagian = p.cicilan ? `cicilan ke-${p.cicilan.cicilan_ke} ` : '';
      if (sumber.pengguna) {
        const pembayaranToefl = Boolean(t.pendaftaran_toefl);
        const judul = pembayaranToefl
          ? keputusan === 'terima' ? 'Pendaftaran TOEFL terverifikasi' : 'Pembayaran TOEFL ditolak'
          : keputusan === 'terima' ? 'Pembayaran diterima' : 'Pembayaran ditolak';
        const pesan = keputusan === 'terima'
          ? pembayaranToefl
            ? `Pembayaran TOEFL (${t.kode_tagihan}) telah diterima. Pendaftaran Anda terverifikasi; buka menu Tes TOEFL untuk mengunduh kartu peserta.`
            : `Pembayaran ${bagian}untuk ${sumber.nama_layanan} (${t.kode_tagihan}) telah diverifikasi.`
          : pembayaranToefl
            ? `Bukti pembayaran TOEFL (${t.kode_tagihan}) ditolak: ${catatan}. Perbaiki lalu unggah ulang bukti pembayaran.`
            : `Bukti pembayaran ${bagian}untuk ${sumber.nama_layanan} (${t.kode_tagihan}) ditolak: ${catatan}. Silakan unggah ulang.`;
        await tx.notifikasi.create({
          data: {
            id_pengguna: sumber.pengguna.id_pengguna,
            jenis: pembayaranToefl ? 'pembayaran_toefl' : 'pembayaran',
            judul,
            pesan: pesan.slice(0, 255),
          },
        });
      }

      await catatAudit(tx, req, {
        aksi: keputusan === 'terima' ? 'verifikasi_pembayaran' : 'tolak_pembayaran',
        entitas: 'pembayaran',
        idEntitas: id,
        detail: { kode_tagihan: t.kode_tagihan, cicilan_ke: p.cicilan?.cicilan_ke ?? null, nominal: Number(p.nominal), status_tagihan: statusTagihan, catatan },
      });

      return tx.pembayaran.findUnique({ where: { id_pembayaran: id }, include: includePembayaran });
    });

    res.json({
      message: keputusan === 'terima' ? 'Pembayaran diterima dan terverifikasi' : 'Pembayaran ditolak, peserta diminta mengunggah ulang',
      data: toResponse(hasil),
    });
  } catch (error) {
    res.status(error.status ?? 500).json({ message: error.status ? error.message : 'Gagal memverifikasi pembayaran', error: error.message });
  }
};
