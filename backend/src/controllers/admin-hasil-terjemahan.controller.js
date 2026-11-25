import path from 'path';
import prisma from '../lib/prisma.js';
import { resolvePrivateHasilPath } from '../utils/private-terjemahan-file.js';

const parseId = (value) => {
  if (!/^\d+$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const namaUnduhan = (idPesanan, versi, filePath) =>
  `hasil-terjemahan-${idPesanan}-v${versi}${path.extname(filePath)}`;

export const getHasilTerjemahanUntukAdmin = async (req, res) => {
  try {
    const pesanan = await prisma.pesanan_terjemahan.findMany({
      where: {
        job_order: {
          is: {
            file_hasil_path: { not: null },
            versi_hasil: { gt: 0 },
          },
        },
      },
      orderBy: { tanggal_ajuan: 'desc' },
      select: {
        id_pesanan: true,
        status: true,
        tanggal_ajuan: true,
        jumlah_halaman: true,
        tarif_penerjemahan: {
          select: {
            jenis_dokumen: true,
            bahasa_asal: true,
            bahasa_tujuan: true,
          },
        },
        pemohon: {
          select: {
            id_pengguna: true,
            nama_lengkap: true,
            email: true,
            nim: true,
          },
        },
        job_order: {
          select: {
            id_job: true,
            status: true,
            versi_hasil: true,
            tanggal_unggah_hasil: true,
            penerjemah: {
              select: {
                id_pengguna: true,
                nama_lengkap: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return res.json({ data: pesanan });
  } catch (error) {
    console.error('Gagal mengambil daftar hasil terjemahan untuk admin:', error);
    return res.status(500).json({ message: 'Gagal memuat daftar hasil terjemahan' });
  }
};

export const unduhHasilTerjemahanUntukAdmin = async (req, res) => {
  const idPesanan = parseId(req.params.id);
  if (!idPesanan) {
    return res.status(400).json({ message: 'ID pesanan tidak valid' });
  }

  try {
    const pesanan = await prisma.pesanan_terjemahan.findUnique({
      where: { id_pesanan: idPesanan },
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

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(filePath, namaUnduhan(idPesanan, job.versi_hasil, filePath), (error) => {
      if (!error) return;
      console.error('Gagal mengirim hasil terjemahan kepada admin:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Gagal mengunduh hasil terjemahan' });
      }
    });
  } catch (error) {
    console.error('Gagal mengunduh hasil terjemahan untuk admin:', error);
    return res.status(500).json({ message: 'Gagal mengunduh hasil terjemahan' });
  }
};
