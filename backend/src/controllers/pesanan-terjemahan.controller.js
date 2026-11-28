import path from 'path';
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { resolvePrivateHasilPath } from '../utils/private-terjemahan-file.js';

const MIN_ALASAN_REVISI = 10;
const MAX_ALASAN_REVISI = 1000;

const parseId = (value) => {
  if (!/^\d+$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

export const getPesananTerjemahanSaya = async (req, res) => {
  try {
    const pesanan = await prisma.pesanan_terjemahan.findMany({
      where: { id_pemohon: req.user.id },
      orderBy: { tanggal_ajuan: 'desc' },
      select: {
        id_pesanan: true,
        jumlah_halaman: true,
        estimasi_biaya: true,
        estimasi_hari: true,
        status: true,
        tanggal_ajuan: true,
        riwayat_status_terjemahan: {
          orderBy: { waktu: 'asc' },
          select: {
            id_riwayat: true,
            status: true,
            keterangan: true,
            waktu: true,
          },
        },
        tarif_penerjemahan: {
          select: {
            jenis_dokumen: true,
            bahasa_asal: true,
            bahasa_tujuan: true,
          },
        },
        job_order: {
          select: {
            id_job: true,
            status: true,
            tanggal_alokasi: true,
            file_hasil_path: true,
            versi_hasil: true,
            catatan_revisi: true,
            tanggal_unggah_hasil: true,
          },
        },
      },
    });

    const data = pesanan.map(({ job_order: job, ...item }) => ({
      ...item,
      job_order: job
        ? {
          id_job: job.id_job,
          status: job.status,
          tanggal_alokasi: job.tanggal_alokasi,
          ada_hasil: Boolean(job.file_hasil_path),
          versi_hasil: job.versi_hasil,
          catatan_revisi: job.catatan_revisi,
          tanggal_unggah_hasil: job.tanggal_unggah_hasil,
        }
        : null,
    }));

    return res.json({ data });
  } catch (error) {
    console.error('Gagal mengambil pesanan terjemahan peserta:', error);
    return res.status(500).json({ message: 'Gagal memuat pesanan terjemahan Anda' });
  }
};

export const unduhHasilPesananSaya = async (req, res) => {
  const idPesanan = parseId(req.params.id);
  if (!idPesanan) {
    return res.status(400).json({ message: 'ID pesanan tidak valid' });
  }

  try {
    const pesanan = await prisma.pesanan_terjemahan.findFirst({
      where: { id_pesanan: idPesanan, id_pemohon: req.user.id },
      select: {
        job_order: {
          select: {
            file_hasil_path: true,
            versi_hasil: true,
          },
        },
      },
    });
    if (!pesanan) return res.status(404).json({ message: 'Pesanan terjemahan tidak ditemukan' });

    const job = pesanan.job_order;
    if (!job?.file_hasil_path || job.versi_hasil < 1) {
      return res.status(404).json({ message: 'Hasil terjemahan belum tersedia' });
    }

    const filePath = resolvePrivateHasilPath(job.file_hasil_path);
    if (!filePath) {
      return res.status(404).json({ message: 'File hasil terjemahan tidak ditemukan' });
    }

    const namaUnduhan = `hasil-terjemahan-${idPesanan}-v${job.versi_hasil}${path.extname(filePath)}`;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(filePath, namaUnduhan, (error) => {
      if (!error) return;
      console.error('Gagal mengirim hasil terjemahan kepada peserta:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Gagal mengunduh hasil terjemahan' });
      }
    });
  } catch (error) {
    console.error('Gagal mengambil hasil terjemahan peserta:', error);
    return res.status(500).json({ message: 'Gagal mengunduh hasil terjemahan' });
  }
};

export const ajukanRevisiTerjemahan = async (req, res) => {
  const idPesanan = parseId(req.params.id);
  if (!idPesanan) {
    return res.status(400).json({ message: 'ID pesanan tidak valid' });
  }

  const alasan = typeof req.body?.alasan === 'string' ? req.body.alasan.trim() : '';
  if (alasan.length < MIN_ALASAN_REVISI) {
    return res.status(400).json({
      message: `Jelaskan bagian yang perlu direvisi (minimal ${MIN_ALASAN_REVISI} karakter)`,
    });
  }
  if (alasan.length > MAX_ALASAN_REVISI) {
    return res.status(400).json({ message: `Alasan revisi maksimal ${MAX_ALASAN_REVISI} karakter` });
  }

  try {
    const data = await prisma.$transaction(async (tx) => {
      const pesanan = await tx.pesanan_terjemahan.findFirst({
        where: { id_pesanan: idPesanan, id_pemohon: req.user.id },
        include: { job_order: true },
      });

      if (!pesanan) throw httpError(404, 'Pesanan terjemahan tidak ditemukan');

      const job = pesanan.job_order;
      if (
        pesanan.status !== 'selesai'
        || !job
        || job.status !== 'selesai'
        || !job.file_hasil_path
        || job.versi_hasil < 1
      ) {
        throw httpError(409, 'Revisi hanya dapat diajukan setelah hasil terjemahan selesai diunggah');
      }

      const updatedJob = await tx.job_order.updateMany({
        where: {
          id_job: job.id_job,
          status: 'selesai',
          file_hasil_path: job.file_hasil_path,
          versi_hasil: job.versi_hasil,
        },
        data: { catatan_revisi: alasan },
      });
      if (!updatedJob.count) {
        throw httpError(409, 'Status hasil sudah berubah. Muat ulang halaman dan coba kembali.');
      }

      const updatedPesanan = await tx.pesanan_terjemahan.updateMany({
        where: {
          id_pesanan: idPesanan,
          id_pemohon: req.user.id,
          status: 'selesai',
        },
        data: { status: 'revisi' },
      });
      if (!updatedPesanan.count) {
        throw httpError(409, 'Pesanan sudah berubah. Muat ulang halaman dan coba kembali.');
      }

      await tx.riwayat_status_terjemahan.create({
        data: {
          id_pesanan: idPesanan,
          status: 'revisi',
          keterangan: 'Pemohon mengajukan revisi hasil terjemahan.',
        },
      });
      await tx.notifikasi.create({
        data: {
          id_pengguna: job.id_penerjemah,
          jenis: 'terjemahan_revisi',
          judul: 'Peserta mengajukan revisi',
          pesan: `Peserta meminta revisi untuk pesanan #${idPesanan}: ${alasan}`.slice(0, 255),
        },
      });
      await catatAudit(tx, req, {
        aksi: 'pengajuan_revisi_terjemahan',
        entitas: 'pesanan_terjemahan',
        idEntitas: idPesanan,
        detail: { id_job: job.id_job, versi_hasil: job.versi_hasil },
      });

      return {
        id_pesanan: idPesanan,
        status: 'revisi',
        catatan_revisi: alasan,
      };
    });

    return res.json({ message: 'Pengajuan revisi berhasil dikirim kepada dosen penerjemah', data });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Gagal mengajukan revisi terjemahan:', error);
    return res.status(500).json({ message: 'Gagal mengajukan revisi. Silakan coba kembali.' });
  }
};
