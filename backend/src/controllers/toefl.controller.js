import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import path from 'path';
import fs from 'fs';

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const includePendaftaran = {
  pengguna: true,
  sesi_toefl: true,
  tagihan: {
    include: {
      pembayaran: {
        orderBy: { tanggal_unggah: 'desc' },
        take: 1,
      },
    },
  },
};

const kodeTagihanToefl = async (tx) => {
  const prefix = `INV-TFL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const count = await tx.tagihan.count({ where: { kode_tagihan: { startsWith: prefix } } });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

const serializePendaftaran = (item) => {
  const pembayaran = item.tagihan?.pembayaran?.[0] ?? null;
  return {
    id_pendaftaran: item.id_pendaftaran,
    status: item.status,
    tanggal_daftar: item.tanggal_daftar,
    pengguna: item.pengguna,
    sesi: item.sesi_toefl,
    tagihan: item.tagihan ? {
      id_tagihan: item.tagihan.id_tagihan,
      kode_tagihan: item.tagihan.kode_tagihan,
      total_tagihan: Number(item.tagihan.total_tagihan),
      status: item.tagihan.status,
      batas_bayar: item.tagihan.batas_bayar,
      pembayaran: pembayaran ? {
        id_pembayaran: pembayaran.id_pembayaran,
        status: pembayaran.status,
        nominal: Number(pembayaran.nominal),
        bukti_path: pembayaran.bukti_path,
        tanggal_unggah: pembayaran.tanggal_unggah,
        tanggal_verifikasi: pembayaran.tanggal_verifikasi,
        catatan: pembayaran.catatan,
      } : null,
    } : null,
  };
};

export const getAllJadwal = async (req, res) => {
  try {
    const sesi = await prisma.sesi_toefl.findMany({
      where: {
        status: { in: ['terbuka', 'ujian_dibuka', 'dijadwalkan'] },
        OR: [{ batas_pendaftaran: null }, { batas_pendaftaran: { gte: new Date() } }],
      },
      orderBy: [{ tanggal: 'asc' }, { id_sesi: 'asc' }],
      include: {
        _count: { select: { pendaftaran_toefl: { where: { status: { not: 'dibatalkan' } } } } },
      },
    });
    res.json({
      data: sesi.map((item) => ({
        id: item.id_sesi,
        nama_sesi: item.nama_sesi,
        tanggal: item.tanggal,
        waktu: item.jam_mulai,
        lokasi: item.ruang,
        biaya: Number(item.tarif),
        kuota: item.kuota_maks,
        kuotaTerisi: item._count.pendaftaran_toefl,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal', error: error.message });
  }
};

export const getJadwalById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID jadwal tidak valid' });
    const jadwal = await prisma.sesi_toefl.findUnique({
      where: { id_sesi: id },
      include: { _count: { select: { pendaftaran_toefl: { where: { status: { not: 'dibatalkan' } } } } } },
    });
    if (!jadwal) return res.status(404).json({ message: 'Jadwal tidak ditemukan' });
    res.json({
      data: {
        id: jadwal.id_sesi,
        nama_sesi: jadwal.nama_sesi,
        tanggal: jadwal.tanggal,
        waktu: jadwal.jam_mulai,
        waktu_selesai: jadwal.jam_selesai,
        lokasi: jadwal.ruang,
        biaya: Number(jadwal.tarif),
        kuota: jadwal.kuota_maks,
        kuota_min: jadwal.kuota_min,
        kuotaTerisi: jadwal._count.pendaftaran_toefl,
        batas_pendaftaran: jadwal.batas_pendaftaran,
        status: jadwal.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail jadwal', error: error.message });
  }
};

export const daftarTes = async (req, res) => {
  try {
    const jadwalId = parseId(req.body.id_sesi ?? req.body.jadwalId);
    if (!jadwalId) return res.status(400).json({ message: 'Sesi TOEFL wajib dipilih' });
    const jadwal = await prisma.sesi_toefl.findUnique({ where: { id_sesi: jadwalId } });
    if (!jadwal) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });
    if (!['terbuka', 'ujian_dibuka'].includes(jadwal.status)) {
      return res.status(400).json({ message: 'Sesi ini sudah tidak menerima pendaftaran' });
    }
    if (jadwal.batas_pendaftaran && new Date(jadwal.batas_pendaftaran) < new Date()) {
      return res.status(400).json({ message: 'Batas pendaftaran sesi telah berakhir' });
    }

    const existing = await prisma.pendaftaran_toefl.findFirst({
      where: { id_pengguna: req.user.id, id_sesi: jadwalId, status: { not: 'dibatalkan' } },
    });
    if (existing) {
      const lengkap = await prisma.pendaftaran_toefl.findUnique({
        where: { id_pendaftaran: existing.id_pendaftaran },
        include: includePendaftaran,
      });
      return res.status(409).json({
        message: 'Anda sudah terdaftar di sesi ini',
        data: serializePendaftaran(lengkap),
      });
    }

    const terdaftar = await prisma.pendaftaran_toefl.count({
      where: { id_sesi: jadwalId, status: { not: 'dibatalkan' } },
    });
    if (terdaftar >= jadwal.kuota_maks) return res.status(400).json({ message: 'Kuota sesi sudah penuh' });

    const peserta = req.body.data_peserta || {};
    const namaLengkap = String(peserta.nama_lengkap ?? '').trim();
    if (namaLengkap && namaLengkap.length < 3) {
      return res.status(400).json({ message: 'Nama lengkap minimal 3 karakter' });
    }
    if (peserta.no_hp !== undefined && peserta.no_hp !== null) {
      const noHp = String(peserta.no_hp).trim();
      if (noHp && !/^[0-9+\s-]{8,25}$/.test(noHp)) {
        return res.status(400).json({ message: 'Nomor WhatsApp tidak valid' });
      }
    }

    const hasil = await prisma.$transaction(async (tx) => {
      if (namaLengkap) {
        await tx.pengguna.update({
          where: { id_pengguna: req.user.id },
          data: {
            nama_lengkap: namaLengkap,
            nim: peserta.nim ? String(peserta.nim).trim() : undefined,
            program_studi: peserta.program_studi ? String(peserta.program_studi).trim() : undefined,
            no_hp: peserta.no_hp ? String(peserta.no_hp).trim() : undefined,
          },
        });
      }

      const tagihan = await tx.tagihan.create({
        data: {
          kode_tagihan: await kodeTagihanToefl(tx),
          jenis_layanan: 'toefl',
          total_tagihan: jadwal.tarif,
          status: 'menunggu_pembayaran',
          batas_bayar: jadwal.batas_pendaftaran ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });
      const pendaftaran = await tx.pendaftaran_toefl.create({
        data: {
          id_pengguna: req.user.id,
          id_sesi: jadwalId,
          id_tagihan: tagihan.id_tagihan,
          status: 'menunggu_pembayaran',
        },
        include: includePendaftaran,
      });
      await catatAudit(tx, req, {
        aksi: 'daftar_toefl',
        entitas: 'pendaftaran_toefl',
        idEntitas: pendaftaran.id_pendaftaran,
        detail: { id_sesi: jadwalId, kode_tagihan: tagihan.kode_tagihan },
      });
      await tx.notifikasi.create({
        data: {
          id_pengguna: req.user.id,
          jenis: 'pembayaran',
          judul: 'Tagihan TOEFL sudah tersedia',
          pesan: `Unduh slip tagihan ${tagihan.kode_tagihan}, lakukan pembayaran melalui teller, lalu unggah bukti transfer.`,
        },
      });
      return pendaftaran;
    });

    res.status(201).json({
      message: 'Pendaftaran berhasil. Silakan lakukan pembayaran.',
      data: serializePendaftaran(hasil),
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mendaftar', error: error.message });
  }
};

export const getMyPendaftaran = async (req, res) => {
  try {
    const pendaftaran = await prisma.pendaftaran_toefl.findMany({
      where: { id_pengguna: req.user.id },
      include: includePendaftaran,
      orderBy: { tanggal_daftar: 'desc' },
    });
    res.json({ data: pendaftaran.map(serializePendaftaran) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pendaftaran', error: error.message });
  }
};

export const getBuktiToefl = async (req, res) => {
  try {
    const idPendaftaran = parseId(req.params.id);
    if (!idPendaftaran) return res.status(400).json({ message: 'Pendaftaran TOEFL tidak valid' });
    const pendaftaran = await prisma.pendaftaran_toefl.findFirst({
      where: { id_pendaftaran: idPendaftaran, id_pengguna: req.user.id },
      include: { tagihan: { include: { pembayaran: { take: 1, orderBy: { tanggal_unggah: 'desc' } } } } },
    });
    const buktiPath = pendaftaran?.tagihan?.pembayaran?.[0]?.bukti_path;
    if (!buktiPath) return res.status(404).json({ message: 'Bukti pembayaran belum tersedia' });
    const uploadsRoot = path.resolve('uploads');
    const filePath = path.resolve(buktiPath);
    if (!filePath.startsWith(uploadsRoot + path.sep) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File bukti tidak ditemukan' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuka bukti pembayaran', error: error.message });
  }
};

export const uploadBuktiToefl = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah' });
    const idPendaftaran = parseId(req.body.id_pendaftaran);
    if (!idPendaftaran) return res.status(400).json({ message: 'Pendaftaran TOEFL tidak valid' });
    const pendaftaran = await prisma.pendaftaran_toefl.findFirst({
      where: { id_pendaftaran: idPendaftaran, id_pengguna: req.user.id },
      include: { tagihan: true, sesi_toefl: true },
    });
    if (!pendaftaran?.tagihan) return res.status(404).json({ message: 'Tagihan pendaftaran tidak ditemukan' });
    if (pendaftaran.status === 'dibatalkan') return res.status(400).json({ message: 'Pendaftaran telah dibatalkan' });

    const buktiPath = req.file.path.replace(/\\/g, '/');
    const pembayaran = await prisma.$transaction(async (tx) => {
      const lama = await tx.pembayaran.findFirst({
        where: { id_tagihan: pendaftaran.tagihan.id_tagihan, id_cicilan: null },
      });
      const nominal = Number(pendaftaran.tagihan.total_tagihan);
      const result = lama
        ? await tx.pembayaran.update({
            where: { id_pembayaran: lama.id_pembayaran },
            data: { bukti_path: buktiPath, tanggal_unggah: new Date(), nominal, status: 'menunggu' },
          })
        : await tx.pembayaran.create({
            data: {
              id_tagihan: pendaftaran.tagihan.id_tagihan,
              nominal,
              bukti_path: buktiPath,
              status: 'menunggu',
            },
          });
      await tx.tagihan.update({
        where: { id_tagihan: pendaftaran.tagihan.id_tagihan },
        data: { status: 'menunggu_verifikasi' },
      });
      await catatAudit(tx, req, {
        aksi: 'unggah_bukti_toefl',
        entitas: 'pembayaran',
        idEntitas: result.id_pembayaran,
        detail: { kode_tagihan: pendaftaran.tagihan.kode_tagihan },
      });
      await tx.notifikasi.create({
        data: {
          id_pengguna: req.user.id,
          jenis: 'pembayaran',
          judul: 'Bukti pembayaran sedang diverifikasi',
          pesan: `Bukti pembayaran ${pendaftaran.tagihan.kode_tagihan} sudah dikirim dan menunggu validasi Staf UPT.`,
        },
      });
      return result;
    });

    res.json({
      message: 'Bukti pembayaran berhasil diunggah dan menunggu verifikasi',
      data: pembayaran,
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunggah bukti pembayaran', error: error.message });
  }
};

export const updateStatusPendaftaran = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID pendaftaran tidak valid' });
    if (!['menunggu_pembayaran', 'terverifikasi', 'dibatalkan'].includes(req.body.status)) {
      return res.status(400).json({ message: 'Status pendaftaran tidak valid' });
    }
    const pendaftaran = await prisma.pendaftaran_toefl.update({
      where: { id_pendaftaran: id },
      data: { status: req.body.status },
    });
    res.json({ message: 'Status diperbarui', data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui status', error: error.message });
  }
};
