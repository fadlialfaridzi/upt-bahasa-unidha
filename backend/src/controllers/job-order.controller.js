import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';

const UPLOADS_ROOT = path.resolve('uploads');
const PRIVATE_RESULTS_ROOT = path.resolve('private_uploads', 'terjemahan-hasil');

const JOB_INCLUDE = {
  pesanan_terjemahan: {
    include: {
      pemohon: { select: { id_pengguna: true, nama_lengkap: true, email: true, nim: true } },
      tarif_penerjemahan: {
        select: { jenis_dokumen: true, bahasa_asal: true, bahasa_tujuan: true },
      },
      riwayat_status_terjemahan: { orderBy: { waktu: 'asc' } },
    },
  },
};

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const namaFile = (filePath) => path.basename(String(filePath || '').replace(/\\/g, '/'));

const kategoriStatus = (job) => {
  const statusPesanan = job.pesanan_terjemahan.status;
  if (statusPesanan === 'revisi') return 'revisi';
  if (statusPesanan === 'selesai' || job.status === 'selesai') return 'selesai';
  if (job.status === 'ditugaskan') return 'baru';
  return 'dikerjakan';
};

const toResponse = (job) => {
  const pesanan = job.pesanan_terjemahan;
  const tanggalKode = new Date(job.tanggal_alokasi).getFullYear();
  const aktivitas = [
    {
      status: 'dialokasikan',
      keterangan: 'Job order ditugaskan kepada Anda',
      waktu: job.tanggal_alokasi,
    },
    ...pesanan.riwayat_status_terjemahan,
  ].sort((a, b) => new Date(a.waktu) - new Date(b.waktu));

  return {
    id_job: job.id_job,
    id_pesanan: pesanan.id_pesanan,
    kode_job: `TR-${tanggalKode}-${String(pesanan.id_pesanan).padStart(4, '0')}`,
    status_job: job.status,
    status_pesanan: pesanan.status,
    kategori: kategoriStatus(job),
    tenggat: job.tenggat,
    tanggal_alokasi: job.tanggal_alokasi,
    nama_file: namaFile(pesanan.file_asli_path),
    jenis_dokumen: pesanan.tarif_penerjemahan.jenis_dokumen,
    bahasa_asal: pesanan.tarif_penerjemahan.bahasa_asal,
    bahasa_tujuan: pesanan.tarif_penerjemahan.bahasa_tujuan,
    jumlah_halaman: pesanan.jumlah_halaman,
    estimasi_biaya: pesanan.estimasi_biaya,
    estimasi_hari: pesanan.estimasi_hari,
    pemohon: pesanan.pemohon,
    catatan_revisi: job.catatan_revisi,
    versi_hasil: job.versi_hasil,
    nama_file_hasil: namaFile(job.file_hasil_path),
    tanggal_unggah_hasil: job.tanggal_unggah_hasil,
    aktivitas,
  };
};

const jobMilikPenerjemah = (idJob, idPenerjemah, tx = prisma) =>
  tx.job_order.findFirst({
    where: { id_job: idJob, id_penerjemah: idPenerjemah },
    include: JOB_INCLUDE,
  });

export const getJobOrderSaya = async (req, res) => {
  try {
    const jobs = await prisma.job_order.findMany({
      where: { id_penerjemah: req.user.id },
      include: JOB_INCLUDE,
      orderBy: [{ tenggat: 'asc' }, { tanggal_alokasi: 'desc' }],
    });
    const data = jobs
      .filter((job) => job.pesanan_terjemahan.status !== 'dibatalkan')
      .map(toResponse);
    const ringkasan = {
      baru: data.filter((job) => job.kategori === 'baru').length,
      dikerjakan: data.filter((job) => job.kategori === 'dikerjakan').length,
      revisi: data.filter((job) => job.kategori === 'revisi').length,
      selesai: data.filter((job) => job.kategori === 'selesai').length,
    };
    res.json({ data, ringkasan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil job order penerjemahan', error: error.message });
  }
};

export const getDokumenAsliJobOrder = async (req, res) => {
  try {
    const idJob = parseId(req.params.id);
    if (!idJob) return res.status(400).json({ message: 'ID job order tidak valid' });

    const job = await jobMilikPenerjemah(idJob, req.user.id);
    if (!job || job.pesanan_terjemahan.status === 'dibatalkan') {
      return res.status(404).json({ message: 'Job order tidak ditemukan' });
    }

    const filePath = path.resolve(job.pesanan_terjemahan.file_asli_path);
    const relativePath = path.relative(UPLOADS_ROOT, filePath);
    if (
      !relativePath
      || relativePath === '..'
      || relativePath.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativePath)
      || !fs.existsSync(filePath)
    ) {
      return res.status(404).json({ message: 'Dokumen sumber tidak ditemukan' });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(filePath, namaFile(filePath));
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunduh dokumen sumber', error: error.message });
  }
};

export const getHasilJobOrder = async (req, res) => {
  try {
    const idJob = parseId(req.params.id);
    if (!idJob) return res.status(400).json({ message: 'ID job order tidak valid' });

    const job = await jobMilikPenerjemah(idJob, req.user.id);
    if (!job || job.pesanan_terjemahan.status === 'dibatalkan') {
      return res.status(404).json({ message: 'Job order tidak ditemukan' });
    }
    if (!job.file_hasil_path) {
      return res.status(404).json({ message: 'Belum ada hasil terjemahan yang diunggah' });
    }

    const filePath = path.resolve(job.file_hasil_path);
    const relativePath = path.relative(PRIVATE_RESULTS_ROOT, filePath);
    if (
      !relativePath
      || relativePath === '..'
      || relativePath.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativePath)
      || !fs.existsSync(filePath)
    ) {
      return res.status(404).json({ message: 'File hasil terjemahan tidak ditemukan' });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(filePath, namaFile(filePath));
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunduh hasil terjemahan', error: error.message });
  }
};

const hapusFileUnggahan = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Gagal membersihkan file hasil terjemahan yang tidak tersimpan:', error.message);
    }
  }
};

export const uploadHasilJobOrder = async (req, res) => {
  const idJob = parseId(req.params.id);
  if (!idJob) {
    await hapusFileUnggahan(req.file?.path);
    return res.status(400).json({ message: 'ID job order tidak valid' });
  }
  if (!req.file) return res.status(400).json({ message: 'Pilih file hasil terjemahan terlebih dahulu' });

  let hasil;
  try {
    hasil = await prisma.$transaction(async (tx) => {
      const job = await jobMilikPenerjemah(idJob, req.user.id, tx);
      if (!job || job.pesanan_terjemahan.status === 'dibatalkan') {
        throw Object.assign(new Error('Job order tidak ditemukan'), { status: 404 });
      }
      if (job.status !== 'dikerjakan' || job.pesanan_terjemahan.status !== 'dikerjakan') {
        throw Object.assign(new Error('Mulai pengerjaan job order sebelum mengunggah hasil'), { status: 409 });
      }

      const versiBerikutnya = job.versi_hasil + 1;
      const unggahRevisi = job.versi_hasil > 0;
      const updatedJob = await tx.job_order.updateMany({
        where: { id_job: idJob, id_penerjemah: req.user.id, status: 'dikerjakan' },
        data: {
          status: 'selesai',
          file_hasil_path: req.file.path,
          versi_hasil: { increment: 1 },
          catatan_revisi: null,
          tanggal_unggah_hasil: new Date(),
        },
      });
      if (!updatedJob.count) {
        throw Object.assign(new Error('Status job order sudah berubah. Muat ulang halaman.'), { status: 409 });
      }

      const updatedPesanan = await tx.pesanan_terjemahan.updateMany({
        where: { id_pesanan: job.id_pesanan, status: 'dikerjakan' },
        data: { status: 'selesai' },
      });
      if (!updatedPesanan.count) {
        throw Object.assign(new Error('Status pesanan sudah berubah. Muat ulang halaman.'), { status: 409 });
      }

      await tx.riwayat_status_terjemahan.create({
        data: {
          id_pesanan: job.id_pesanan,
          status: 'selesai',
          keterangan: unggahRevisi
            ? `Hasil revisi versi ${versiBerikutnya} diunggah.`
            : 'Hasil terjemahan versi 1 diunggah.',
        },
      });
      await catatAudit(tx, req, {
        aksi: unggahRevisi ? 'unggah_hasil_revisi' : 'unggah_hasil_terjemahan',
        entitas: 'job_order',
        idEntitas: idJob,
        detail: { id_pesanan: job.id_pesanan, versi_hasil: versiBerikutnya },
      });

      return jobMilikPenerjemah(idJob, req.user.id, tx);
    });
  } catch (error) {
    await hapusFileUnggahan(req.file.path);
    const status = error.status ?? 500;
    return res.status(status).json({
      message: status === 500 ? 'Gagal mengunggah hasil terjemahan' : error.message,
      ...(status === 500 ? { error: error.message } : {}),
    });
  }

  const revisi = hasil.versi_hasil > 1;
  return res.status(201).json({
    message: revisi
      ? `Hasil revisi versi ${hasil.versi_hasil} berhasil diunggah`
      : 'Hasil terjemahan berhasil diunggah',
    data: toResponse(hasil),
  });
};

export const ubahStatusJobOrder = async (req, res) => {
  const idJob = parseId(req.params.id);
  if (!idJob) return res.status(400).json({ message: 'ID job order tidak valid' });
  if (!['terima', 'mulai'].includes(req.body.action)) {
    return res.status(400).json({ message: 'Aksi job order tidak valid' });
  }

  try {
    const hasil = await prisma.$transaction(async (tx) => {
      const job = await jobMilikPenerjemah(idJob, req.user.id, tx);
      if (!job || job.pesanan_terjemahan.status === 'dibatalkan') {
        throw Object.assign(new Error('Job order tidak ditemukan'), { status: 404 });
      }

      if (req.body.action === 'terima') {
        if (job.status !== 'ditugaskan' || job.pesanan_terjemahan.status !== 'dialokasikan') {
          throw Object.assign(new Error('Penugasan ini sudah diterima atau tidak dapat diproses'), { status: 409 });
        }
        const updated = await tx.job_order.updateMany({
          where: { id_job: idJob, id_penerjemah: req.user.id, status: 'ditugaskan' },
          data: { status: 'diterima' },
        });
        if (!updated.count) {
          throw Object.assign(new Error('Status job order sudah berubah. Muat ulang halaman.'), { status: 409 });
        }
        await catatAudit(tx, req, {
          aksi: 'terima_job',
          entitas: 'job_order',
          idEntitas: idJob,
          detail: { id_pesanan: job.id_pesanan },
        });
      } else {
        const mulaiRevisi = job.status === 'selesai' && job.pesanan_terjemahan.status === 'revisi';
        const mulaiPekerjaan = job.status === 'diterima' && job.pesanan_terjemahan.status === 'dialokasikan';
        if (!mulaiRevisi && !mulaiPekerjaan) {
          throw Object.assign(new Error('Job order belum siap untuk mulai dikerjakan'), { status: 409 });
        }

        const updatedJob = await tx.job_order.updateMany({
          where: { id_job: idJob, id_penerjemah: req.user.id, status: job.status },
          data: { status: 'dikerjakan' },
        });
        if (!updatedJob.count) {
          throw Object.assign(new Error('Status job order sudah berubah. Muat ulang halaman.'), { status: 409 });
        }

        const statusSebelumnya = job.pesanan_terjemahan.status;
        const updatedPesanan = await tx.pesanan_terjemahan.updateMany({
          where: { id_pesanan: job.id_pesanan, status: statusSebelumnya },
          data: { status: 'dikerjakan' },
        });
        if (!updatedPesanan.count) {
          throw Object.assign(new Error('Status pesanan sudah berubah. Muat ulang halaman.'), { status: 409 });
        }

        await tx.riwayat_status_terjemahan.create({
          data: {
            id_pesanan: job.id_pesanan,
            status: 'dikerjakan',
            keterangan: mulaiRevisi ? 'Penerjemah mulai mengerjakan revisi.' : 'Penerjemah mulai mengerjakan terjemahan.',
          },
        });
        await catatAudit(tx, req, {
          aksi: mulaiRevisi ? 'mulai_revisi_terjemahan' : 'mulai_terjemahan',
          entitas: 'job_order',
          idEntitas: idJob,
          detail: { id_pesanan: job.id_pesanan },
        });
      }

      return jobMilikPenerjemah(idJob, req.user.id, tx);
    });

    res.json({
      message: req.body.action === 'terima' ? 'Job order berhasil diterima' : 'Pengerjaan job order dimulai',
      data: toResponse(hasil),
    });
  } catch (error) {
    res.status(error.status ?? 500).json({
      message: error.status ? error.message : 'Gagal memperbarui job order',
      ...(error.status ? {} : { error: error.message }),
    });
  }
};
