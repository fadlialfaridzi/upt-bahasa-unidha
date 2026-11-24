import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const includeSesi = {
  _count: { select: { pendaftaran_toefl: true } },
};

const getSesiResponse = async (id) => {
  const sesi = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id }, include: includeSesi });
  if (!sesi) return null;
  const terverifikasi = await prisma.pendaftaran_toefl.count({
    where: { id_sesi: id, status: 'terverifikasi' },
  });
  const menunggu = await prisma.pendaftaran_toefl.count({
    where: { id_sesi: id, status: 'menunggu_pembayaran' },
  });
  return {
    ...sesi,
    jumlah_pendaftar: sesi._count.pendaftaran_toefl,
    jumlah_terverifikasi: terverifikasi,
    jumlah_menunggu: menunggu,
    jumlah_tersisa: Math.max(0, sesi.kuota_maks - terverifikasi),
  };
};

export const getAllJadwal = async (req, res) => {
  try {
    const sesi = await prisma.sesi_toefl.findMany({
      where: { status: { in: ['terbuka', 'dijadwalkan', 'ujian_dibuka'] } },
      include: { _count: { select: { pendaftaran_toefl: { where: { status: 'terverifikasi' } } } } },
      orderBy: [{ tanggal: 'asc' }, { id_sesi: 'asc' }],
    });
    res.json({ data: sesi.map((item) => ({
      id: item.id_sesi,
      nama_sesi: item.nama_sesi,
      tanggal: item.tanggal,
      waktu: item.jam_mulai,
      lokasi: item.ruang,
      biaya: item.tarif,
      kuota: item.kuota_maks,
      kuotaTerisi: item._count.pendaftaran_toefl,
    })) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal', error: error.message });
  }
};

export const getJadwalById = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID jadwal tidak valid' });
  const jadwal = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id } });
  if (!jadwal) return res.status(404).json({ message: 'Jadwal tidak ditemukan' });
  res.json({ data: { id: jadwal.id_sesi, ...jadwal } });
};

export const daftarTes = async (req, res) => {
  try {
    const jadwalId = parseId(req.body.jadwalId);
    if (!jadwalId) return res.status(400).json({ message: 'ID jadwal tidak valid' });
    const jadwal = await prisma.sesi_toefl.findUnique({ where: { id_sesi: jadwalId } });
    if (!jadwal) return res.status(404).json({ message: 'Jadwal tidak ditemukan' });
    if (['dibatalkan', 'selesai'].includes(jadwal.status)) return res.status(400).json({ message: 'Sesi tidak tersedia' });

    const terverifikasi = await prisma.pendaftaran_toefl.count({ where: { id_sesi: jadwalId, status: 'terverifikasi' } });
    if (terverifikasi >= jadwal.kuota_maks) return res.status(400).json({ message: 'Kuota penuh' });
    const existing = await prisma.pendaftaran_toefl.findFirst({
      where: { id_pengguna: req.user.id, id_sesi: jadwalId, status: { not: 'dibatalkan' } },
    });
    if (existing) return res.status(409).json({ message: 'Anda sudah terdaftar di jadwal ini' });
    const pendaftaran = await prisma.pendaftaran_toefl.create({
      data: { id_pengguna: req.user.id, id_sesi: jadwalId, status: 'menunggu_pembayaran' },
    });
    res.status(201).json({ message: 'Pendaftaran berhasil', data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mendaftar', error: error.message });
  }
};

export const getMyPendaftaran = async (req, res) => {
  const pendaftaran = await prisma.pendaftaran_toefl.findMany({
    where: { id_pengguna: req.user.id },
    include: { sesi_toefl: true },
    orderBy: { tanggal_daftar: 'desc' },
  });
  res.json({ data: pendaftaran });
};

export const updateStatusPendaftaran = async (req, res) => {
  const id = parseId(req.params.id);
  const valid = ['menunggu_pembayaran', 'terverifikasi', 'dibatalkan'];
  if (!id) return res.status(400).json({ message: 'ID pendaftaran tidak valid' });
  if (!valid.includes(req.body.status)) return res.status(400).json({ message: 'Status pendaftaran tidak valid' });
  const pendaftaran = await prisma.pendaftaran_toefl.update({ where: { id_pendaftaran: id }, data: { status: req.body.status } });
  res.json({ message: 'Status diperbarui', data: pendaftaran });
};

export const getKuotaToefl = async (req, res) => {
  try {
    const { status, q } = req.query;
    const where = {};
    if (status && ['terbuka', 'menunggu_override', 'dijadwalkan', 'selesai', 'dibatalkan'].includes(status)) where.status = status;
    if (q?.trim()) where.nama_sesi = { contains: q.trim(), mode: 'insensitive' };

    const sesi = await prisma.sesi_toefl.findMany({ where, include: includeSesi, orderBy: [{ tanggal: 'desc' }, { id_sesi: 'desc' }] });
    const data = await Promise.all(sesi.map(async (item) => {
      const base = await getSesiResponse(item.id_sesi);
      return base;
    }));
    const counts = await Promise.all([
      prisma.sesi_toefl.count(),
      prisma.pendaftaran_toefl.count({ where: { status: 'terverifikasi' } }),
      prisma.sesi_toefl.aggregate({ _sum: { kuota_maks: true } }),
      prisma.sesi_toefl.count({ where: { status: { in: ['terbuka', 'ujian_dibuka', 'dijadwalkan'] } } }),
    ]);
    res.json({
      data,
      ringkasan: {
        total_sesi: counts[0],
        total_terverifikasi: counts[1],
        kapasitas: counts[2]._sum.kuota_maks || 0,
        sesi_aktif: counts[3],
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data kuota TOEFL', error: error.message });
  }
};

export const updateKuotaSesi = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });
    const existing = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id } });
    if (!existing) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });

    const kuotaMin = Number(req.body.kuota_min);
    const kuotaMaks = Number(req.body.kuota_maks);
    if (!Number.isInteger(kuotaMin) || kuotaMin < 1 || kuotaMin > 24) return res.status(400).json({ message: 'Kuota minimum harus 1-24' });
    if (!Number.isInteger(kuotaMaks) || kuotaMaks < kuotaMin || kuotaMaks > 24) return res.status(400).json({ message: 'Kuota maksimum harus 1-24 dan tidak boleh kurang dari minimum' });

    const terverifikasi = await prisma.pendaftaran_toefl.count({ where: { id_sesi: id, status: 'terverifikasi' } });
    if (kuotaMaks < terverifikasi) return res.status(400).json({ message: `Kuota maksimum tidak boleh kurang dari ${terverifikasi} peserta terverifikasi` });

    const data = { kuota_min: kuotaMin, kuota_maks: kuotaMaks };
    if (req.body.tanggal !== undefined) data.tanggal = req.body.tanggal ? new Date(`${req.body.tanggal}T00:00:00.000Z`) : null;
    if (req.body.jam_mulai) data.jam_mulai = new Date(`1970-01-01T${req.body.jam_mulai}:00.000Z`);
    if (req.body.batas_pendaftaran) data.batas_pendaftaran = new Date(req.body.batas_pendaftaran);
    if (req.body.status) {
      if (!['terbuka', 'menunggu_override', 'ujian_dibuka', 'dijadwalkan', 'selesai', 'dibatalkan'].includes(req.body.status)) return res.status(400).json({ message: 'Status sesi tidak valid' });
      data.status = req.body.status;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sesi_toefl.update({ where: { id_sesi: id }, data });
      await catatAudit(tx, req, {
        aksi: 'ubah_kuota',
        entitas: 'sesi_toefl',
        idEntitas: id,
        detail: {
          kuota_min: kuotaMin,
          kuota_maks: kuotaMaks,
          alasan: String(req.body.alasan_perubahan || '').trim() || null,
        },
      });
      return result;
    });
    res.json({ message: 'Kuota sesi berhasil diperbarui', data: await getSesiResponse(updated.id_sesi) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui kuota', error: error.message });
  }
};


export const getPendaftarSesi = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });
    const sesi = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id } });
    if (!sesi) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });

    const pendaftar = await prisma.pendaftaran_toefl.findMany({
      where: { id_sesi: id },
      include: {
        pengguna: {
          select: {
            id_pengguna: true,
            nama_lengkap: true,
            nim: true,
            email: true,
            no_hp: true,
            program_studi: true,
          },
        },
      },
      orderBy: { tanggal_daftar: 'asc' },
    });
    res.json({ data: pendaftar });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar pendaftar sesi', error: error.message });
  }
};

export const rilisSesiDariKuota = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });
    const sesi = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id } });
    if (!sesi) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });
    if (!sesi.tanggal || !sesi.jam_mulai || !sesi.jam_selesai || !sesi.ruang) {
      return res.status(400).json({ message: 'Tanggal, jam, dan ruang ujian harus sudah dilengkapi pada Kelola Sesi TOEFL' });
    }

    const terverifikasi = await prisma.pendaftaran_toefl.count({
      where: { id_sesi: id, status: 'terverifikasi' },
    });
    const kuotaEfektif = sesi.kuota_min;

    if (terverifikasi < kuotaEfektif) {
      return res.status(400).json({
        message: `Belum memenuhi kuota minimum. Pendaftar terverifikasi ${terverifikasi}/${kuotaEfektif}`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sesi_toefl.update({
        where: { id_sesi: id },
        data: { status: 'dijadwalkan', tanggal_rilis: new Date() },
      });
      await catatAudit(tx, req, {
        aksi: 'rilis',
        entitas: 'sesi_toefl',
        idEntitas: id,
        detail: { nama_sesi: sesi.nama_sesi, jumlah_terverifikasi: terverifikasi, kuota_efektif: kuotaEfektif },
      });
      return result;
    });
    res.json({ message: 'Jadwal sesi TOEFL berhasil dirilis', data: updated });
  } catch (error) {
    res.status(500).json({ message: 'Gagal merilis jadwal sesi TOEFL', error: error.message });
  }
};
