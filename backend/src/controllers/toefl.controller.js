import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';

const SESI_STATUS = ['terbuka', 'menunggu_override', 'ujian_dibuka', 'dijadwalkan', 'selesai', 'dibatalkan'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseDate = (value, label, errors) => {
  if (value === undefined) return undefined;
  if (!value) return null;
  if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    errors.push(`${label} harus berformat YYYY-MM-DD`);
    return undefined;
  }
  return new Date(`${value}T00:00:00.000Z`);
};

const parseTime = (value, label, errors) => {
  if (value === undefined) return undefined;
  if (!value) return null;
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    errors.push(`${label} harus berformat HH:MM`);
    return undefined;
  }
  return new Date(`1970-01-01T${value}:00.000Z`);
};

const parseInteger = (value, label, min, max, errors) => {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (value === '' || value === null || !Number.isInteger(n) || n < min || n > max) {
    errors.push(`${label} harus bilangan bulat ${min}-${max}`);
    return undefined;
  }
  return n;
};

const parseSesiInput = (body, { partial = false } = {}) => {
  const errors = [];
  const data = {};
  const required = (field, label) => {
    if (!partial && (body[field] === undefined || body[field] === null || body[field] === '')) {
      errors.push(`${label} wajib diisi`);
      return false;
    }
    return body[field] !== undefined;
  };

  if (required('nama_sesi', 'Nama sesi')) {
    const nama = String(body.nama_sesi ?? '').trim();
    if (nama.length < 3 || nama.length > 100) errors.push('Nama sesi harus 3-100 karakter');
    else data.nama_sesi = nama;
  }

  for (const [field, label] of [
    ['batas_pendaftaran', 'Batas pendaftaran'],
    ['tanggal', 'Tanggal ujian'],
  ]) {
    if (field === 'batas_pendaftaran' && body[field]) {
      const value = typeof body[field] === 'string' && body[field].length > 10
        ? new Date(body[field])
        : parseDate(body[field], label, errors);
      if (value && !Number.isNaN(value.getTime())) data[field] = value;
    } else {
      const value = parseDate(body[field], label, errors);
      if (value !== undefined) data[field] = value;
    }
  }

  for (const [field, label] of [
    ['jam_mulai', 'Waktu mulai'],
    ['jam_selesai', 'Waktu selesai'],
  ]) {
    const value = parseTime(body[field], label, errors);
    if (value !== undefined) data[field] = value;
  }

  if (body.ruang !== undefined) {
    const ruang = String(body.ruang ?? '').trim();
    if (ruang && ruang.length > 50) errors.push('Ruang maksimal 50 karakter');
    else data.ruang = ruang || null;
  }

  const kuotaMin = parseInteger(body.kuota_min, 'Kuota minimum', 1, 24, errors);
  if (kuotaMin !== undefined) data.kuota_min = kuotaMin;
  const kuotaMaks = parseInteger(body.kuota_maks, 'Kuota maksimum', 1, 24, errors);
  if (kuotaMaks !== undefined) data.kuota_maks = kuotaMaks;
  if (kuotaMin !== undefined && kuotaMaks !== undefined && kuotaMin > kuotaMaks) {
    errors.push('Kuota minimum tidak boleh lebih besar dari kuota maksimum');
  }

  if (required('tarif', 'Tarif')) {
    const tarif = Number(body.tarif);
    if (body.tarif === '' || !Number.isFinite(tarif) || tarif < 0 || tarif > 100000000) {
      errors.push('Tarif harus angka 0 atau lebih');
    } else data.tarif = tarif;
  }

  if (body.status !== undefined) {
    if (!SESI_STATUS.includes(body.status)) errors.push('Status sesi tidak valid');
    else data.status = body.status;
  }

  return { data, errors };
};

const includeCounts = {
  _count: { select: { pendaftaran_toefl: true } },
  override_kuota: {
    orderBy: { tanggal_ajuan: 'desc' },
    take: 1,
  },
};

const toResponse = ({ _count, override_kuota, ...sesi }) => ({
  ...sesi,
  jumlah_pendaftar: _count?.pendaftaran_toefl ?? 0,
  jumlah_lunas: 0,
  override_terakhir: override_kuota?.[0] ?? null,
});

export const getAllSesi = async (req, res) => {
  try {
    const { status, q } = req.query;
    const where = {};
    if (status && status !== 'semua' && SESI_STATUS.includes(status)) where.status = status;
    if (q?.trim()) {
      where.nama_sesi = { contains: q.trim(), mode: 'insensitive' };
    }

    const sesi = await prisma.sesi_toefl.findMany({
      where,
      include: includeCounts,
      orderBy: [{ tanggal: 'desc' }, { id_sesi: 'desc' }],
    });

    const result = await Promise.all(sesi.map(async (item) => {
      const jumlahLunas = await prisma.pendaftaran_toefl.count({
        where: { id_sesi: item.id_sesi, status: 'terverifikasi' },
      });
      return { ...toResponse(item), jumlah_lunas: jumlahLunas };
    }));

    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data sesi TOEFL', error: error.message });
  }
};

export const getSesiById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });
    const sesi = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id }, include: includeCounts });
    if (!sesi) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });
    const jumlahLunas = await prisma.pendaftaran_toefl.count({
      where: { id_sesi: id, status: 'terverifikasi' },
    });
    res.json({ data: { ...toResponse(sesi), jumlah_lunas: jumlahLunas } });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail sesi TOEFL', error: error.message });
  }
};

export const createSesi = async (req, res) => {
  try {
    const { data, errors } = parseSesiInput(req.body);
    if (data.tanggal && data.jam_mulai && data.jam_selesai && data.jam_mulai >= data.jam_selesai) {
      errors.push('Waktu selesai harus setelah waktu mulai');
    }
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const sesi = await prisma.$transaction(async (tx) => {
      const created = await tx.sesi_toefl.create({ data, include: includeCounts });
      await catatAudit(tx, req, {
        aksi: 'tambah',
        entitas: 'sesi_toefl',
        idEntitas: created.id_sesi,
        detail: { nama_sesi: created.nama_sesi },
      });
      return created;
    });
    res.status(201).json({ message: 'Sesi TOEFL berhasil dibuat', data: await getSesiResponse(sesi.id_sesi) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat sesi TOEFL', error: error.message });
  }
};

const getSesiResponse = async (id) => {
  const sesi = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id }, include: includeCounts });
  if (!sesi) return null;
  const jumlahLunas = await prisma.pendaftaran_toefl.count({ where: { id_sesi: id, status: 'terverifikasi' } });
  return { ...toResponse(sesi), jumlah_lunas: jumlahLunas };
};

export const updateSesi = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });
    const existing = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id } });
    if (!existing) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });

    const { data, errors } = parseSesiInput(req.body, { partial: true });
    if (!errors.length && Object.keys(data).length === 0) errors.push('Tidak ada data yang diubah');

    const kuotaMin = data.kuota_min ?? existing.kuota_min;
    const kuotaMaks = data.kuota_maks ?? existing.kuota_maks;
    if (kuotaMin > kuotaMaks) errors.push('Kuota minimum tidak boleh lebih besar dari kuota maksimum');

    const mulai = data.jam_mulai ?? existing.jam_mulai;
    const selesai = data.jam_selesai ?? existing.jam_selesai;
    if (mulai && selesai && mulai >= selesai) errors.push('Waktu selesai harus setelah waktu mulai');

    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const updated = await prisma.$transaction(async (tx) => {
      const sesi = await tx.sesi_toefl.update({ where: { id_sesi: id }, data });
      await catatAudit(tx, req, {
        aksi: 'ubah',
        entitas: 'sesi_toefl',
        idEntitas: id,
        detail: { nama_sesi: sesi.nama_sesi },
      });
      return sesi;
    });
    res.json({ message: 'Sesi TOEFL berhasil diperbarui', data: await getSesiResponse(updated.id_sesi) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui sesi TOEFL', error: error.message });
  }
};

export const rilisSesi = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });
    const sesi = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id }, include: includeCounts });
    if (!sesi) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });
    if (!sesi.tanggal || !sesi.jam_mulai || !sesi.jam_selesai || !sesi.ruang) {
      return res.status(400).json({ message: 'Tanggal, waktu, dan ruang ujian wajib dilengkapi sebelum rilis' });
    }

    const jumlahLunas = await prisma.pendaftaran_toefl.count({ where: { id_sesi: id, status: 'terverifikasi' } });
    const override = await prisma.override_kuota.findFirst({
      where: { id_sesi: id, status: 'disetujui' },
      orderBy: { tanggal_ajuan: 'desc' },
    });
    const kuotaEfektif = override ? sesi.kuota_min : sesi.kuota_min;
    if (jumlahLunas < kuotaEfektif) {
      return res.status(400).json({
        message: `Belum memenuhi kuota minimum. Terverifikasi ${jumlahLunas}/${kuotaEfektif} peserta`,
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
        detail: { nama_sesi: sesi.nama_sesi, jumlah_peserta: jumlahLunas },
      });
      return result;
    });
    res.json({ message: 'Jadwal sesi TOEFL berhasil dirilis', data: await getSesiResponse(updated.id_sesi) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal merilis sesi TOEFL', error: error.message });
  }
};

export const deleteSesi = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });
    const sesi = await prisma.sesi_toefl.findUnique({
      where: { id_sesi: id },
      include: { _count: { select: { pendaftaran_toefl: true } } },
    });
    if (!sesi) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });
    if (sesi._count.pendaftaran_toefl > 0) {
      return res.status(400).json({ message: 'Sesi tidak dapat dihapus karena sudah memiliki pendaftar. Batalkan sesi sebagai gantinya.' });
    }
    await prisma.$transaction(async (tx) => {
      await tx.sesi_toefl.delete({ where: { id_sesi: id } });
      await catatAudit(tx, req, {
        aksi: 'hapus',
        entitas: 'sesi_toefl',
        idEntitas: id,
        detail: { nama_sesi: sesi.nama_sesi },
      });
    });
    res.json({ message: 'Sesi TOEFL berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus sesi TOEFL', error: error.message });
  }
};

export const getAllJadwal = async (req, res) => {
  try {
    const jadwal = await prisma.sesi_toefl.findMany({
      where: { status: { in: ['terbuka', 'dijadwalkan', 'ujian_dibuka'] } },
      include: { _count: { select: { pendaftaran_toefl: { where: { status: 'terverifikasi' } } } } },
      orderBy: [{ tanggal: 'asc' }, { id_sesi: 'asc' }],
    });
    res.json({
      data: jadwal.map((item) => ({
        id: item.id_sesi,
        nama_sesi: item.nama_sesi,
        tanggal: item.tanggal,
        waktu: item.jam_mulai,
        lokasi: item.ruang,
        biaya: item.tarif,
        kuota: item.kuota_maks,
        kuotaTerisi: item._count.pendaftaran_toefl,
      })),
    });
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
    if (jadwal.status === 'dibatalkan' || jadwal.status === 'selesai') {
      return res.status(400).json({ message: 'Sesi tidak tersedia untuk pendaftaran' });
    }

    const jumlahTerdaftar = await prisma.pendaftaran_toefl.count({
      where: { id_sesi: jadwalId, status: { not: 'dibatalkan' } },
    });
    if (jumlahTerdaftar >= jadwal.kuota_maks) {
      return res.status(400).json({ message: 'Kuota penuh' });
    }

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
  try {
    const pendaftaran = await prisma.pendaftaran_toefl.findMany({
      where: { id_pengguna: req.user.id },
      include: { sesi_toefl: true },
      orderBy: { tanggal_daftar: 'desc' },
    });
    res.json({ data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pendaftaran', error: error.message });
  }
};

export const updateStatusPendaftaran = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID pendaftaran tidak valid' });
    const status = req.body.status;
    if (!['menunggu_pembayaran', 'terverifikasi', 'dibatalkan'].includes(status)) {
      return res.status(400).json({ message: 'Status pendaftaran tidak valid' });
    }
    const pendaftaran = await prisma.pendaftaran_toefl.update({
      where: { id_pendaftaran: id },
      data: { status },
    });
    res.json({ message: 'Status diperbarui', data: pendaftaran });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui status', error: error.message });
  }
};
