import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import path from 'path';
import fs from 'fs';

const SESI_STATUS = ['terbuka', 'menunggu_override', 'ujian_dibuka', 'dijadwalkan', 'selesai', 'dibatalkan'];
const RELEASEABLE_SESI_STATUS = ['terbuka', 'menunggu_override', 'ujian_dibuka'];
const RELEASE_ALLOWED_ROLES = ['staf_upt', 'super_admin'];
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
  // Jangan pernah kirim token_qr sesi kepada peserta melalui endpoint pendaftaran/tagihan
  const sesi = item.sesi_toefl
    ? (({ token_qr: _tokenQr, ...rest }) => rest)(item.sesi_toefl)
    : null;
  return {
    id_pendaftaran: item.id_pendaftaran,
    status: item.status,
    tanggal_daftar: item.tanggal_daftar,
    pengguna: item.pengguna,
    sesi,
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
  override_kuota: { orderBy: [{ tanggal_ajuan: 'desc' }, { id_override: 'desc' }], take: 1 },
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

/**
 * Helper internal UC-21 & UC-28:
 * Memvalidasi kelayakan rilis jadwal sesi TOEFL dan melakukan update atomik di dalam transaksi.
 * - Override berstatus 'disetujui' untuk sesi terkait hanya menjadi izin melewati kuota minimum,
 *   tidak melewati validasi kelengkapan/validitas jadwal maupun status sesi.
 */
const prosesRilisSesi = async (tx, req, { id, pesanJadwalBelumLengkap, formatPesanKuota, buatAuditDetail }) => {
  const sesi = await tx.sesi_toefl.findUnique({ where: { id_sesi: id } });
  if (!sesi) {
    const err = new Error('Sesi TOEFL tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  if (!RELEASEABLE_SESI_STATUS.includes(sesi.status)) {
    const err = new Error(
      sesi.status === 'dijadwalkan'
        ? 'Jadwal sesi TOEFL sudah dirilis sebelumnya'
        : `Sesi dengan status "${sesi.status || 'tidak diketahui'}" tidak dapat dirilis`,
    );
    err.statusCode = sesi.status === 'dijadwalkan' ? 409 : 400;
    throw err;
  }

  const ruang = typeof sesi.ruang === 'string' ? sesi.ruang.trim() : '';
  if (!sesi.tanggal || !sesi.jam_mulai || !sesi.jam_selesai || !ruang) {
    const err = new Error(pesanJadwalBelumLengkap);
    err.statusCode = 400;
    throw err;
  }

  if (sesi.jam_mulai >= sesi.jam_selesai) {
    const err = new Error('Waktu selesai harus setelah waktu mulai');
    err.statusCode = 400;
    throw err;
  }

  const jumlahTerverifikasi = await tx.pendaftaran_toefl.count({
    where: { id_sesi: id, status: 'terverifikasi' },
  });

  let overrideDisetujui = null;
  if (jumlahTerverifikasi < sesi.kuota_min) {
    const overrideTerakhir = await tx.override_kuota.findFirst({
      where: { id_sesi: id },
      orderBy: [{ tanggal_ajuan: 'desc' }, { id_override: 'desc' }],
    });

    if (
      overrideTerakhir
      && overrideTerakhir.id_sesi === id
      && overrideTerakhir.status === 'disetujui'
    ) {
      overrideDisetujui = overrideTerakhir;
    } else {
      let detailOverride = '';
      if (overrideTerakhir?.id_sesi === id && overrideTerakhir.status === 'diajukan') {
        detailOverride = ' (pengajuan override masih menunggu persetujuan Kepala UPT Bahasa)';
      } else if (overrideTerakhir?.id_sesi === id && overrideTerakhir.status === 'ditolak') {
        detailOverride = ' (pengajuan override ditolak)';
      }
      const err = new Error(`${formatPesanKuota(jumlahTerverifikasi, sesi.kuota_min)}${detailOverride}`);
      err.statusCode = 400;
      throw err;
    }
  }

  const tanggalRilis = new Date();
  const klaimRilis = await tx.sesi_toefl.updateMany({
    where: {
      id_sesi: id,
      status: { in: RELEASEABLE_SESI_STATUS },
    },
    data: {
      status: 'dijadwalkan',
      tanggal_rilis: tanggalRilis,
    },
  });

  if (klaimRilis.count === 0) {
    const err = new Error('Jadwal sesi TOEFL sudah dirilis atau status sesi telah berubah');
    err.statusCode = 409;
    throw err;
  }

  await catatAudit(tx, req, {
    aksi: 'rilis',
    entitas: 'sesi_toefl',
    idEntitas: id,
    detail: buatAuditDetail({ sesi, jumlahTerverifikasi, overrideDisetujui }),
  });

  return {
    ...sesi,
    status: 'dijadwalkan',
    tanggal_rilis: tanggalRilis,
  };
};

export const rilisSesi = async (req, res) => {
  try {
    if (!RELEASE_ALLOWED_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Akses ditolak, hanya untuk admin' });
    }
    const id = parseId(req.params?.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });

    const updated = await prisma.$transaction((tx) => prosesRilisSesi(tx, req, {
      id,
      pesanJadwalBelumLengkap: 'Tanggal, waktu, dan ruang ujian wajib dilengkapi sebelum rilis',
      formatPesanKuota: (jumlahLunas, kuotaMin) => `Belum memenuhi kuota minimum. Terverifikasi ${jumlahLunas}/${kuotaMin} peserta`,
      buatAuditDetail: ({ sesi, jumlahTerverifikasi, overrideDisetujui }) => ({
        nama_sesi: sesi.nama_sesi,
        jumlah_peserta: jumlahTerverifikasi,
        via_override: Boolean(overrideDisetujui),
        ...(overrideDisetujui ? { id_override: overrideDisetujui.id_override } : {}),
      }),
    }));

    res.json({ message: 'Jadwal sesi TOEFL berhasil dirilis', data: await getSesiResponse(updated.id_sesi) });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[rilisSesi] Internal Error:', error);
    }
    res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal merilis sesi TOEFL',
    });
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
      include: {
        _count: { select: { pendaftaran_toefl: true } },
        override_kuota: {
          orderBy: [{ tanggal_ajuan: 'desc' }, { id_override: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ tanggal: 'desc' }, { id_sesi: 'desc' }],
    });
    const data = await Promise.all(sesi.map(async (item) => {
      const [jumlahTerverifikasi, jumlahMenunggu] = await Promise.all([
        prisma.pendaftaran_toefl.count({ where: { id_sesi: item.id_sesi, status: 'terverifikasi' } }),
        prisma.pendaftaran_toefl.count({ where: { id_sesi: item.id_sesi, status: 'menunggu_pembayaran' } }),
      ]);
      const { override_kuota, ...restItem } = item;
      const kandidatOverride = override_kuota?.[0] ?? null;
      const overrideTerakhir = kandidatOverride && kandidatOverride.id_sesi === item.id_sesi
        ? {
            id_override: kandidatOverride.id_override,
            id_sesi: kandidatOverride.id_sesi,
            status: kandidatOverride.status,
            alasan: kandidatOverride.alasan,
            catatan_putusan: kandidatOverride.catatan_putusan ?? null,
            tanggal_ajuan: kandidatOverride.tanggal_ajuan,
            tanggal_putusan: kandidatOverride.tanggal_putusan ?? null,
          }
        : null;
      return {
        ...restItem,
        jumlah_pendaftar: item._count.pendaftaran_toefl,
        jumlah_terverifikasi: jumlahTerverifikasi,
        jumlah_menunggu: jumlahMenunggu,
        jumlah_tersisa: Math.max(0, item.kuota_maks - jumlahTerverifikasi),
        override_terakhir: overrideTerakhir,
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
    if (!RELEASE_ALLOWED_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Akses ditolak, hanya untuk admin' });
    }
    const id = parseId(req.params?.id);
    if (!id) return res.status(400).json({ message: 'ID sesi tidak valid' });

    const updated = await prisma.$transaction((tx) => prosesRilisSesi(tx, req, {
      id,
      pesanJadwalBelumLengkap: 'Tanggal, jam, dan ruang ujian harus sudah dilengkapi pada Kelola Sesi TOEFL',
      formatPesanKuota: (terverifikasi, kuotaMin) => `Belum memenuhi kuota minimum. Pendaftar terverifikasi ${terverifikasi}/${kuotaMin}`,
      buatAuditDetail: ({ sesi, jumlahTerverifikasi, overrideDisetujui }) => ({
        nama_sesi: sesi.nama_sesi,
        jumlah_terverifikasi: jumlahTerverifikasi,
        kuota_efektif: overrideDisetujui ? jumlahTerverifikasi : sesi.kuota_min,
        via_override: Boolean(overrideDisetujui),
        ...(overrideDisetujui ? { id_override: overrideDisetujui.id_override } : {}),
      }),
    }));

    res.json({ message: 'Jadwal sesi TOEFL berhasil dirilis', data: updated });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[rilisSesiDariKuota] Internal Error:', error);
    }
    res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal merilis jadwal sesi TOEFL',
    });
  }
};

export const ajukanOverrideToefl = async (req, res) => {
  try {
    if (req.user?.role !== 'staf_upt') {
      return res.status(403).json({ message: 'Hanya Staf UPT yang berhak mengajukan override kuota TOEFL' });
    }

    const idSesi = parseId(req.body?.id_sesi ?? req.body?.idSesi ?? req.params?.id);
    if (!idSesi) return res.status(400).json({ message: 'ID sesi TOEFL wajib diisi dan harus valid' });

    const alasan = typeof req.body.alasan === 'string' ? req.body.alasan.trim() : '';
    if (!alasan || alasan.length < 5) {
      return res.status(400).json({ message: 'Alasan override wajib diisi (minimal 5 karakter)' });
    }
    if (alasan.length > 500) {
      return res.status(400).json({ message: 'Alasan override maksimal 500 karakter' });
    }

    const hasil = await prisma.$transaction(async (tx) => {
      // 1. Klaim dan ubah status sesi secara atomik.
      // Hanya sesi berstatus "terbuka" yang bisa diklaim menjadi "menunggu_override".
      // Jika dua request bersamaan masuk, baris ini mengunci row di database (row-level lock)
      // sehingga request kedua akan mendapati count === 0 dan digagalkan.
      const klaimSesi = await tx.sesi_toefl.updateMany({
        where: { id_sesi: idSesi, status: 'terbuka' },
        data: { status: 'menunggu_override' },
      });

      if (klaimSesi.count === 0) {
        const sesiSaatIni = await tx.sesi_toefl.findUnique({
          where: { id_sesi: idSesi },
          select: { id_sesi: true, status: true },
        });

        if (!sesiSaatIni) {
          const err = new Error('Sesi TOEFL tidak ditemukan');
          err.statusCode = 404;
          throw err;
        }

        if (sesiSaatIni.status === 'menunggu_override') {
          const err = new Error('Sesi ini sudah memiliki permohonan override yang masih menunggu persetujuan');
          err.statusCode = 409;
          throw err;
        }

        const err = new Error(`Override hanya dapat diajukan untuk sesi dengan status "terbuka" (status saat ini: "${sesiSaatIni.status}")`);
        err.statusCode = 400;
        throw err;
      }

      // Ambil detail sesi setelah diklaim
      const sesi = await tx.sesi_toefl.findUnique({
        where: { id_sesi: idSesi },
      });

      // 2. Cegah request override duplikat yang masih berstatus "diajukan"
      const existingPending = await tx.override_kuota.findFirst({
        where: { id_sesi: idSesi, status: 'diajukan' },
      });
      if (existingPending) {
        const err = new Error('Sesi ini sudah memiliki permohonan override yang masih menunggu persetujuan');
        err.statusCode = 409;
        throw err;
      }

      // 3. Verifikasi kuota peserta terverifikasi di dalam transaksi
      const terverifikasi = await tx.pendaftaran_toefl.count({
        where: { id_sesi: idSesi, status: 'terverifikasi' },
      });
      if (terverifikasi >= sesi.kuota_min) {
        const err = new Error(`Kuota minimum sudah terpenuhi (${terverifikasi}/${sesi.kuota_min} peserta terverifikasi). Override tidak diperlukan.`);
        err.statusCode = 400;
        throw err;
      }

      // 4. Buat permohonan override
      const override = await tx.override_kuota.create({
        data: {
          id_sesi: idSesi,
          id_pengaju: req.user.id,
          alasan,
          status: 'diajukan',
        },
        include: {
          sesi_toefl: {
            select: {
              id_sesi: true,
              nama_sesi: true,
              kuota_min: true,
              kuota_maks: true,
              status: true,
            },
          },
          pengaju: {
            select: {
              id_pengguna: true,
              nama_lengkap: true,
              email: true,
            },
          },
        },
      });

      // 5. Catat audit log
      await catatAudit(tx, req, {
        aksi: 'ajukan_override',
        entitas: 'override_kuota',
        idEntitas: override.id_override,
        detail: {
          id_sesi: idSesi,
          nama_sesi: sesi.nama_sesi,
          alasan,
          pendaftar_terverifikasi: terverifikasi,
          kuota_min: sesi.kuota_min,
        },
      });

      // 6. Buat notifikasi ke Kepala UPT Bahasa (super_admin)
      const kepalaUpt = await tx.pengguna.findMany({
        where: {
          status_aktif: true,
          role: { nama_role: 'super_admin' },
          id_pengguna: { not: req.user.id },
        },
        select: { id_pengguna: true },
      });

      if (kepalaUpt.length > 0) {
        await tx.notifikasi.createMany({
          data: kepalaUpt.map(({ id_pengguna }) => ({
            id_pengguna,
            jenis: 'override_toefl',
            judul: 'Pengajuan override kuota TOEFL',
            pesan: `Permohonan override kuota diajukan untuk sesi "${sesi.nama_sesi}". Menunggu persetujuan Kepala UPT Bahasa.`,
          })),
        });
      }

      return override;
    });

    res.status(201).json({
      message: 'Pengajuan override kuota TOEFL berhasil diajukan dan menunggu persetujuan',
      data: hasil,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[ajukanOverrideToefl] Internal Error:', error);
    }
    res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal mengajukan override kuota TOEFL',
    });
  }
};

/**
 * UC-28: Mengambil daftar permohonan override kuota TOEFL
 * Digunakan oleh Kepala UPT (Super Admin) untuk memeriksa pengajuan override.
 * Mendukung filter status (default: 'semua' atau 'diajukan').
 */
export const getDaftarOverrideToefl = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && ['diajukan', 'disetujui', 'ditolak'].includes(status)) {
      where.status = status;
    }

    const daftar = await prisma.override_kuota.findMany({
      where,
      include: {
        sesi_toefl: {
          select: {
            id_sesi: true,
            nama_sesi: true,
            kuota_min: true,
            kuota_maks: true,
            status: true,
            tanggal: true,
            jam_mulai: true,
            jam_selesai: true,
            ruang: true,
          },
        },
        pengaju: {
          select: {
            id_pengguna: true,
            nama_lengkap: true,
            email: true,
            role: {
              select: {
                nama_role: true,
              },
            },
          },
        },
        penyetuju: {
          select: {
            id_pengguna: true,
            nama_lengkap: true,
            email: true,
          },
        },
      },
      orderBy: [
        // Utamakan yang berstatus 'diajukan' terlebih dahulu
        { tanggal_ajuan: 'desc' },
      ],
    });

    // Urutkan status 'diajukan' di paling atas
    daftar.sort((a, b) => {
      if (a.status === 'diajukan' && b.status !== 'diajukan') return -1;
      if (a.status !== 'diajukan' && b.status === 'diajukan') return 1;
      return new Date(b.tanggal_ajuan) - new Date(a.tanggal_ajuan);
    });

    // Hitung jumlah pendaftar terverifikasi untuk setiap sesi
    const result = await Promise.all(
      daftar.map(async (item) => {
        const jumlahTerverifikasi = await prisma.pendaftaran_toefl.count({
          where: {
            id_sesi: item.id_sesi,
            status: 'terverifikasi',
          },
        });

        return {
          id_override: item.id_override,
          status: item.status,
          tanggal_ajuan: item.tanggal_ajuan,
          tanggal_putusan: item.tanggal_putusan,
          alasan: item.alasan,
          catatan_putusan: item.catatan_putusan,
          kuota_min: item.sesi_toefl.kuota_min,
          jumlah_terverifikasi: jumlahTerverifikasi,
          sesi: {
            ...item.sesi_toefl,
            jumlah_terverifikasi: jumlahTerverifikasi,
          },
          pengaju: {
            id_pengguna: item.pengaju.id_pengguna,
            nama_lengkap: item.pengaju.nama_lengkap,
            email: item.pengaju.email,
            role: item.pengaju.role?.nama_role,
          },
          penyetuju: item.penyetuju
            ? {
                id_pengguna: item.penyetuju.id_pengguna,
                nama_lengkap: item.penyetuju.nama_lengkap,
                email: item.penyetuju.email,
              }
            : null,
        };
      })
    );

    res.json({
      message: 'Daftar permohonan override kuota TOEFL berhasil diambil',
      data: result,
    });
  } catch (error) {
    console.error('[getDaftarOverrideToefl] Error:', error);
    res.status(500).json({
      message: 'Gagal mengambil daftar permohonan override kuota TOEFL',
    });
  }
};

/**
 * UC-28: Memproses keputusan approval atau rejection Override Kuota TOEFL
 * Ketentuan:
 * - Hanya role super_admin (Kepala UPT Bahasa) yang berhak memproses.
 * - Prinsip Four-Eyes: id_penyetuju tidak boleh sama dengan id_pengaju.
 * - Override harus masih berstatus 'diajukan'.
 * - Approval: status override -> 'disetujui', status sesi tetap 'menunggu_override' (TIDAK langsung dirilis/dijadwalkan).
 * - Rejection: status override -> 'ditolak', status sesi kembali 'terbuka'. Wajib menyertakan alasan penolakan.
 * - Audit log dan notifikasi dikirimkan ke pengaju.
 */
export const putusanOverrideToefl = async (req, res) => {
  try {
    const idOverride = parseId(req.params?.id ?? req.body?.id_override);
    if (!idOverride) {
      return res.status(400).json({ message: 'ID override tidak valid' });
    }

    // Role check: hanya super_admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({
        message: 'Hanya Kepala UPT Bahasa (Super Admin) yang berhak memberikan keputusan override',
      });
    }

    const keputusan = req.body?.keputusan?.toLowerCase()?.trim();
    if (!keputusan || !['setuju', 'tolak'].includes(keputusan)) {
      return res.status(400).json({
        message: 'Keputusan tidak valid. Pilih "setuju" atau "tolak"',
      });
    }

    const catatanPutusan = (req.body?.catatan_putusan ?? req.body?.alasan_penolakan ?? '')?.trim();

    // Rejection wajib memiliki alasan/catatan
    if (keputusan === 'tolak') {
      if (!catatanPutusan || catatanPutusan.length < 5) {
        return res.status(400).json({
          message: 'Alasan penolakan wajib diisi minimal 5 karakter',
        });
      }
      if (catatanPutusan.length > 500) {
        return res.status(400).json({
          message: 'Alasan penolakan maksimal 500 karakter',
        });
      }
    }

    const hasil = await prisma.$transaction(async (tx) => {
      // 1. Ambil data override dengan lock/cek status
      const override = await tx.override_kuota.findUnique({
        where: { id_override: idOverride },
        include: {
          sesi_toefl: true,
          pengaju: {
            select: {
              id_pengguna: true,
              nama_lengkap: true,
              email: true,
            },
          },
        },
      });

      if (!override) {
        const err = new Error('Permohonan override kuota tidak ditemukan');
        err.statusCode = 404;
        throw err;
      }

      // Pastikan status masih 'diajukan'
      if (override.status !== 'diajukan') {
        const err = new Error(`Permohonan override sudah diputuskan sebelumnya dengan status "${override.status}"`);
        err.statusCode = 409;
        throw err;
      }

      // 2. Four-Eyes Principle: Penyetuju !== Pengaju
      const idPenyetuju = req.user.id;
      if (override.id_pengaju === idPenyetuju) {
        const err = new Error('Prinsip four-eyes: Penyetuju tidak boleh merupakan pengguna yang sama dengan pengaju');
        err.statusCode = 403;
        throw err;
      }

      const waktuPutusan = new Date();
      const statusOverrideBaru = keputusan === 'setuju' ? 'disetujui' : 'ditolak';

      // 3. Update status override_kuota
      // Gunakan conditional update untuk mencegah race condition
      const updateResult = await tx.override_kuota.updateMany({
        where: {
          id_override: idOverride,
          status: 'diajukan',
        },
        data: {
          status: statusOverrideBaru,
          id_penyetuju: idPenyetuju,
          catatan_putusan: catatanPutusan || null,
          tanggal_putusan: waktuPutusan,
        },
      });

      if (updateResult.count === 0) {
        const err = new Error('Permohonan override telah diproses oleh request lain');
        err.statusCode = 409;
        throw err;
      }

      // 4. Update status sesi
      // Sesuai A3 & UC-28:
      // - Jika disetujui: status sesi TETAP (atau berada pada state yang memungkinkan Staf UPT merilis di UC-21),
      //   TIDAK langsung dirilis/dijadwalkan.
      // - Jika ditolak: status sesi DIKEMBALIKAN menjadi 'terbuka'.
      if (keputusan === 'tolak') {
        await tx.sesi_toefl.update({
          where: { id_sesi: override.id_sesi },
          data: { status: 'terbuka' },
        });
      }

      // 5. Catat audit log
      await catatAudit(tx, req, {
        aksi: keputusan === 'setuju' ? 'setujui_override' : 'tolak_override',
        entitas: 'override_kuota',
        idEntitas: idOverride,
        detail: {
          id_sesi: override.id_sesi,
          nama_sesi: override.sesi_toefl.nama_sesi,
          keputusan,
          catatan_putusan: catatanPutusan || null,
          id_pengaju: override.id_pengaju,
          id_penyetuju: idPenyetuju,
        },
      });

      // 6. Buat notifikasi hasil keputusan kepada pengaju
      const pesanNotif = keputusan === 'setuju'
        ? `Permohonan override kuota untuk sesi "${override.sesi_toefl.nama_sesi}" telah DISETUJUI oleh Kepala UPT Bahasa. Silakan lengkapi jadwal dan rilis sesi.`
        : `Permohonan override kuota untuk sesi "${override.sesi_toefl.nama_sesi}" DITOLAK oleh Kepala UPT Bahasa. Alasan: ${catatanPutusan}`;

      await tx.notifikasi.create({
        data: {
          id_pengguna: override.id_pengaju,
          jenis: 'override_toefl',
          judul: `Permohonan Override TOEFL ${keputusan === 'setuju' ? 'Disetujui' : 'Ditolak'}`,
          pesan: pesanNotif,
        },
      });

      return {
        id_override: idOverride,
        id_sesi: override.id_sesi,
        nama_sesi: override.sesi_toefl.nama_sesi,
        status: statusOverrideBaru,
        id_penyetuju: idPenyetuju,
        catatan_putusan: catatanPutusan || null,
        tanggal_putusan: waktuPutusan,
      };
    });

    res.json({
      message: keputusan === 'setuju'
        ? 'Permohonan override kuota TOEFL berhasil disetujui'
        : 'Permohonan override kuota TOEFL berhasil ditolak',
      data: hasil,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    if (statusCode === 500) {
      console.error('[putusanOverrideToefl] Internal Error:', error);
    }
    res.status(statusCode).json({
      message: statusCode !== 500 ? error.message : 'Gagal memproses keputusan override kuota TOEFL',
    });
  }
};
