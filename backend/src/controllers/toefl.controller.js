import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import path from 'path';
import fs from 'fs';

const SESI_STATUS = ['terbuka', 'menunggu_override', 'ujian_dibuka', 'dijadwalkan', 'selesai', 'dibatalkan'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

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
  for (const [field, label] of [['batas_pendaftaran', 'Batas pendaftaran'], ['tanggal', 'Tanggal ujian']]) {
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
  for (const [field, label] of [['jam_mulai', 'Waktu mulai'], ['jam_selesai', 'Waktu selesai']]) {
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
  if (kuotaMin !== undefined && kuotaMaks !== undefined && kuotaMin > kuotaMaks) errors.push('Kuota minimum tidak boleh lebih besar dari kuota maksimum');
  if (required('tarif', 'Tarif')) {
    const tarif = Number(body.tarif);
    if (body.tarif === '' || !Number.isFinite(tarif) || tarif < 0 || tarif > 100000000) errors.push('Tarif harus angka 0 atau lebih');
    else data.tarif = tarif;
  }
  if (body.status !== undefined) {
    if (!SESI_STATUS.includes(body.status)) errors.push('Status sesi tidak valid');
    else data.status = body.status;
  }
  return { data, errors };
};

const includeCounts = {
  _count: { select: { pendaftaran_toefl: true } },
  override_kuota: { orderBy: { tanggal_ajuan: 'desc' }, take: 1 },
};

const toResponse = ({ _count, override_kuota, ...sesi }) => ({
  ...sesi,
  jumlah_pendaftar: _count?.pendaftaran_toefl ?? 0,
  jumlah_lunas: 0,
  override_terakhir: override_kuota?.[0] ?? null,
});

const getSesiResponse = async (id) => {
  const sesi = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id }, include: includeCounts });
  if (!sesi) return null;
  const jumlahLunas = await prisma.pendaftaran_toefl.count({ where: { id_sesi: id, status: 'terverifikasi' } });
  return { ...toResponse(sesi), jumlah_lunas: jumlahLunas };
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
          jenis: 'pembayaran_toefl',
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

export const getTagihanToeflPeserta = async (req, res) => {
  try {
    const pendaftaran = await prisma.pendaftaran_toefl.findMany({
      where: {
        id_pengguna: req.user.id,
        status: { not: 'dibatalkan' },
      },
      include: includePendaftaran,
      orderBy: { tanggal_daftar: 'desc' },
    });

    const parameter = await prisma.parameter_sistem.findMany({
      where: {
        kunci: { in: ['bank_tujuan', 'no_rekening_tujuan', 'atas_nama_rekening', 'batas_bayar_hari'] },
      },
    });
    const rekening = Object.fromEntries(parameter.map((item) => [item.kunci, item.nilai]));

    const data = pendaftaran.map((item) => {
      const serialized = serializePendaftaran(item);
      return {
        ...serialized,
        rekening: {
          bank: rekening.bank_tujuan || 'Bank Nagari Syariah',
          nomor_rekening: rekening.no_rekening_tujuan || 'Belum dikonfigurasi',
          atas_nama: rekening.atas_nama_rekening || 'UPT Bahasa UNIDHA',
        },
      };
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil tagihan TOEFL', error: error.message });
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
  const hapusBerkasUnggahan = async () => {
    if (!req.file?.path) return;
    try {
      await fs.promises.unlink(req.file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  };

  try {
    if (!req.file) return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah' });
    const idPendaftaran = parseId(req.body.id_pendaftaran);
    if (!idPendaftaran) {
      await hapusBerkasUnggahan();
      return res.status(400).json({ message: 'Pendaftaran TOEFL tidak valid' });
    }
    const pendaftaran = await prisma.pendaftaran_toefl.findFirst({
      where: { id_pendaftaran: idPendaftaran, id_pengguna: req.user.id },
      include: {
        tagihan: true,
        sesi_toefl: true,
        pengguna: { select: { nama_lengkap: true } },
      },
    });
    if (!pendaftaran?.tagihan) {
      await hapusBerkasUnggahan();
      return res.status(404).json({ message: 'Tagihan pendaftaran tidak ditemukan' });
    }
    if (pendaftaran.status === 'dibatalkan' || ['dibatalkan', 'kedaluwarsa', 'lunas'].includes(pendaftaran.tagihan.status)) {
      await hapusBerkasUnggahan();
      return res.status(400).json({ message: 'Tagihan ini tidak dapat menerima bukti pembayaran' });
    }

    const buktiPath = req.file.path.replace(/\\/g, '/');
    const pembayaran = await prisma.$transaction(async (tx) => {
      const lama = await tx.pembayaran.findFirst({
        where: { id_tagihan: pendaftaran.tagihan.id_tagihan, id_cicilan: null },
      });
      if (lama && lama.status !== 'ditolak') {
        throw Object.assign(
          new Error(lama.status === 'menunggu'
            ? 'Bukti pembayaran masih menunggu verifikasi'
            : 'Pembayaran telah terverifikasi'),
          { status: 409 },
        );
      }
      const nominal = Number(pendaftaran.tagihan.total_tagihan);
      const result = lama
        ? await tx.pembayaran.update({
            where: { id_pembayaran: lama.id_pembayaran },
            data: {
              bukti_path: buktiPath,
              tanggal_unggah: new Date(),
              nominal,
              status: 'menunggu',
              tanggal_verifikasi: null,
              catatan: null,
            },
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
          jenis: 'pembayaran_toefl',
          judul: 'Bukti pembayaran sedang diverifikasi',
          pesan: `Bukti pembayaran ${pendaftaran.tagihan.kode_tagihan} sudah dikirim dan menunggu validasi Staf UPT.`,
        },
      });
      const stafUpt = await tx.pengguna.findMany({
        where: { status_aktif: true, role: { nama_role: 'staf_upt' } },
        select: { id_pengguna: true },
      });
      if (stafUpt.length > 0) {
        await tx.notifikasi.createMany({
          data: stafUpt.map(({ id_pengguna }) => ({
            id_pengguna,
            jenis: 'pembayaran_toefl',
            judul: 'Bukti pembayaran TOEFL perlu divalidasi',
            pesan: `${pendaftaran.pengguna.nama_lengkap} mengunggah bukti pembayaran untuk tagihan ${pendaftaran.tagihan.kode_tagihan}. Buka Validasi TOEFL untuk meninjau.`,
          })),
        });
      }
      return result;
    });

    res.json({
      message: 'Bukti pembayaran berhasil diunggah dan menunggu verifikasi',
      data: pembayaran,
    });
  } catch (error) {
    try {
      await hapusBerkasUnggahan();
    } catch (cleanupError) {
      console.error('Gagal menghapus berkas bukti TOEFL yang tidak tersimpan:', cleanupError);
    }
    if (error.status) return res.status(error.status).json({ message: error.message });
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

export const getAllSesi = async (req, res) => {
  try {
    const { status, q } = req.query;
    const where = {};
    if (status && status !== 'semua' && SESI_STATUS.includes(status)) where.status = status;
    if (q?.trim()) where.nama_sesi = { contains: q.trim(), mode: 'insensitive' };
    const sesi = await prisma.sesi_toefl.findMany({
      where,
      include: includeCounts,
      orderBy: [{ tanggal: 'desc' }, { id_sesi: 'desc' }],
    });
    const result = await Promise.all(sesi.map(async (item) => {
      const jumlahLunas = await prisma.pendaftaran_toefl.count({ where: { id_sesi: item.id_sesi, status: 'terverifikasi' } });
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
    const jumlahLunas = await prisma.pendaftaran_toefl.count({ where: { id_sesi: id, status: 'terverifikasi' } });
    res.json({ data: { ...toResponse(sesi), jumlah_lunas: jumlahLunas } });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail sesi TOEFL', error: error.message });
  }
};

export const createSesi = async (req, res) => {
  try {
    const { data, errors } = parseSesiInput(req.body);
    if (data.tanggal && data.jam_mulai && data.jam_selesai && data.jam_mulai >= data.jam_selesai) errors.push('Waktu selesai harus setelah waktu mulai');
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const sesi = await prisma.$transaction(async (tx) => {
      const created = await tx.sesi_toefl.create({ data, include: includeCounts });
      await catatAudit(tx, req, { aksi: 'tambah', entitas: 'sesi_toefl', idEntitas: created.id_sesi, detail: { nama_sesi: created.nama_sesi } });
      return created;
    });
    res.status(201).json({ message: 'Sesi TOEFL berhasil dibuat', data: await getSesiResponse(sesi.id_sesi) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat sesi TOEFL', error: error.message });
  }
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
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const updated = await prisma.$transaction(async (tx) => {
      const sesi = await tx.sesi_toefl.update({ where: { id_sesi: id }, data });
      await catatAudit(tx, req, { aksi: 'ubah', entitas: 'sesi_toefl', idEntitas: id, detail: { nama_sesi: sesi.nama_sesi } });
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
    if (!sesi.tanggal || !sesi.jam_mulai || !sesi.jam_selesai || !sesi.ruang) return res.status(400).json({ message: 'Tanggal, waktu, dan ruang ujian wajib dilengkapi sebelum rilis' });
    const jumlahLunas = await prisma.pendaftaran_toefl.count({ where: { id_sesi: id, status: 'terverifikasi' } });
    if (jumlahLunas < sesi.kuota_min) return res.status(400).json({ message: `Belum memenuhi kuota minimum. Terverifikasi ${jumlahLunas}/${sesi.kuota_min} peserta` });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sesi_toefl.update({ where: { id_sesi: id }, data: { status: 'dijadwalkan', tanggal_rilis: new Date() } });
      await catatAudit(tx, req, { aksi: 'rilis', entitas: 'sesi_toefl', idEntitas: id, detail: { nama_sesi: sesi.nama_sesi, jumlah_peserta: jumlahLunas } });
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
    const sesi = await prisma.sesi_toefl.findUnique({ where: { id_sesi: id }, include: { _count: { select: { pendaftaran_toefl: true } } } });
    if (!sesi) return res.status(404).json({ message: 'Sesi TOEFL tidak ditemukan' });
    if (sesi._count.pendaftaran_toefl > 0) return res.status(400).json({ message: 'Sesi tidak dapat dihapus karena sudah memiliki pendaftar. Batalkan sesi sebagai gantinya.' });
    await prisma.$transaction(async (tx) => {
      await tx.sesi_toefl.delete({ where: { id_sesi: id } });
      await catatAudit(tx, req, { aksi: 'hapus', entitas: 'sesi_toefl', idEntitas: id, detail: { nama_sesi: sesi.nama_sesi } });
    });
    res.json({ message: 'Sesi TOEFL berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus sesi TOEFL', error: error.message });
  }
};

export const getKuotaToefl = async (req, res) => {
  try {
    const { status, q } = req.query;
    const where = {};
    if (status && ['terbuka', 'menunggu_override', 'dijadwalkan', 'selesai', 'dibatalkan'].includes(status)) where.status = status;
    if (q?.trim()) where.nama_sesi = { contains: q.trim(), mode: 'insensitive' };
    const sesi = await prisma.sesi_toefl.findMany({
      where,
      include: { _count: { select: { pendaftaran_toefl: true } } },
      orderBy: [{ tanggal: 'desc' }, { id_sesi: 'desc' }],
    });
    const data = await Promise.all(sesi.map(async (item) => {
      const [jumlahTerverifikasi, jumlahMenunggu] = await Promise.all([
        prisma.pendaftaran_toefl.count({ where: { id_sesi: item.id_sesi, status: 'terverifikasi' } }),
        prisma.pendaftaran_toefl.count({ where: { id_sesi: item.id_sesi, status: 'menunggu_pembayaran' } }),
      ]);
      return {
        ...item,
        jumlah_pendaftar: item._count.pendaftaran_toefl,
        jumlah_terverifikasi: jumlahTerverifikasi,
        jumlah_menunggu: jumlahMenunggu,
        jumlah_tersisa: Math.max(0, item.kuota_maks - jumlahTerverifikasi),
      };
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
    if (req.body.batas_pendaftaran) data.batas_pendaftaran = new Date(req.body.batas_pendaftaran);
    if (req.body.status) data.status = req.body.status;
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sesi_toefl.update({ where: { id_sesi: id }, data });
      await catatAudit(tx, req, { aksi: 'ubah_kuota', entitas: 'sesi_toefl', idEntitas: id, detail: { kuota_min: kuotaMin, kuota_maks: kuotaMaks } });
      return result;
    });
    res.json({ message: 'Kuota sesi berhasil diperbarui', data: updated });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui kuota', error: error.message });
  }
};

export const getPendaftarSesi = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });
    const pendaftar = await prisma.pendaftaran_toefl.findMany({
      where: { id_sesi: id },
      include: { pengguna: { select: { id_pengguna: true, nama_lengkap: true, nim: true, email: true, no_hp: true, program_studi: true } } },
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
    if (!sesi.tanggal || !sesi.jam_mulai || !sesi.jam_selesai || !sesi.ruang) return res.status(400).json({ message: 'Tanggal, jam, dan ruang ujian harus sudah dilengkapi pada Kelola Sesi TOEFL' });
    const terverifikasi = await prisma.pendaftaran_toefl.count({ where: { id_sesi: id, status: 'terverifikasi' } });
    if (terverifikasi < sesi.kuota_min) return res.status(400).json({ message: `Belum memenuhi kuota minimum. Pendaftar terverifikasi ${terverifikasi}/${sesi.kuota_min}` });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sesi_toefl.update({ where: { id_sesi: id }, data: { status: 'dijadwalkan', tanggal_rilis: new Date() } });
      await catatAudit(tx, req, { aksi: 'rilis', entitas: 'sesi_toefl', idEntitas: id, detail: { nama_sesi: sesi.nama_sesi, jumlah_terverifikasi: terverifikasi, kuota_efektif: sesi.kuota_min } });
      return result;
    });
    res.json({ message: 'Jadwal sesi TOEFL berhasil dirilis', data: updated });
  } catch (error) {
    res.status(500).json({ message: 'Gagal merilis jadwal sesi TOEFL', error: error.message });
  }
};
