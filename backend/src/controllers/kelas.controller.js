import { jenis_pelatihan, tipe_kelas, status_kelas } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { aturanTipe } from '../config/pelatihan.js';

const JENIS = Object.values(jenis_pelatihan);
const TIPE = Object.values(tipe_kelas);
const STATUS = Object.values(status_kelas);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Hitung peserta aktif (pendaftaran yang tidak dibatalkan) dan pertemuan yang sudah dijadwalkan.
const withCounts = {
  _count: {
    select: {
      pendaftaran_pelatihan: { where: { status: { not: 'dibatalkan' } } },
      pertemuan_kelas: true,
    },
  },
};

const toResponse = ({ _count, ...kelas }) => ({
  ...kelas,
  jumlah_peserta: _count.pendaftaran_pelatihan,
  pertemuan_terjadwal: _count.pertemuan_kelas,
});

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseDate = (value, label, errors) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${label} harus berformat tanggal YYYY-MM-DD`);
    return undefined;
  }
  return new Date(`${value}T00:00:00.000Z`);
};

const parseInteger = (value, label, min, max, errors) => {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (value === '' || value === null || !Number.isInteger(n) || n < min || n > max) {
    errors.push(`${label} harus bilangan bulat ${min}–${max}`);
    return undefined;
  }
  return n;
};

/**
 * Validasi input kelas. Mode `partial` dipakai saat update (field yang tidak dikirim dibiarkan).
 * Mengembalikan { data, errors }.
 */
const parseKelasInput = (body, { partial = false } = {}) => {
  const errors = [];
  const data = {};
  const required = (field, label) => {
    if (!partial && (body[field] === undefined || body[field] === null || body[field] === '')) {
      errors.push(`${label} wajib diisi`);
      return false;
    }
    return body[field] !== undefined;
  };

  if (required('nama_kelas', 'Nama kelas')) {
    const nama = String(body.nama_kelas ?? '').trim();
    if (nama.length < 3 || nama.length > 100) errors.push('Nama kelas harus 3–100 karakter');
    else data.nama_kelas = nama;
  }

  if (required('jenis_pelatihan', 'Jenis pelatihan')) {
    if (!JENIS.includes(body.jenis_pelatihan)) errors.push('Jenis pelatihan tidak valid');
    else data.jenis_pelatihan = body.jenis_pelatihan;
  }

  if (body.tipe_kelas !== undefined) {
    if (!TIPE.includes(body.tipe_kelas)) errors.push('Tipe kelas tidak valid');
    else data.tipe_kelas = body.tipe_kelas;
  }

  if (body.status !== undefined) {
    if (!STATUS.includes(body.status)) errors.push('Status kelas tidak valid');
    else data.status = body.status;
  }

  const kuota = parseInteger(body.kuota_maks, 'Kuota maksimal', 1, 500, errors);
  if (kuota !== undefined) data.kuota_maks = kuota;

  const pertemuan = parseInteger(body.jumlah_pertemuan, 'Jumlah pertemuan', 1, 100, errors);
  if (pertemuan !== undefined) data.jumlah_pertemuan = pertemuan;

  if (required('tarif', 'Tarif')) {
    const tarif = Number(body.tarif);
    if (body.tarif === '' || !Number.isFinite(tarif) || tarif < 0 || tarif > 1e10) {
      errors.push('Tarif harus angka 0 atau lebih');
    } else {
      data.tarif = tarif;
    }
  }

  for (const [field, label] of [
    ['tanggal_mulai', 'Tanggal mulai'],
    ['kuesioner_mulai', 'Tanggal mulai kuesioner'],
    ['kuesioner_selesai', 'Tanggal selesai kuesioner'],
  ]) {
    const value = parseDate(body[field], label, errors);
    if (value !== undefined) data[field] = value;
  }

  return { data, errors };
};

/**
 * Kelas reguler selalu 20 pertemuan (lihat config/pelatihan.js); intensif bebas.
 * Mengisi/menimpa data.jumlah_pertemuan bila tipe efektifnya reguler.
 */
const terapkanAturanTipe = (data, tipe, jumlahLama) => {
  const { jumlahPertemuan } = aturanTipe(tipe);
  if (jumlahPertemuan && (data.jumlah_pertemuan !== undefined || data.tipe_kelas !== undefined || jumlahLama !== jumlahPertemuan)) {
    data.jumlah_pertemuan = jumlahPertemuan;
  }
};

const kuesionerTidakValid =(mulai, selesai) => mulai && selesai && mulai > selesai;

// GET /api/kelas?status=dibuka&jenis=ielts
export const getAllKelas = async (req, res) => {
  try {
    const { status, jenis } = req.query;
    const where = {};
    if (status) {
      const list = String(status).split(',').filter((s) => STATUS.includes(s));
      if (list.length) where.status = { in: list };
    }
    if (jenis && JENIS.includes(jenis)) where.jenis_pelatihan = jenis;

    const kelas = await prisma.kelas_pelatihan.findMany({
      where,
      include: withCounts,
      // Urutan enum status: dibuka, berjalan, selesai, dibatalkan
      orderBy: [{ status: 'asc' }, { tanggal_mulai: 'desc' }, { id_kelas: 'desc' }],
    });
    res.json({ data: kelas.map(toResponse) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data kelas', error: error.message });
  }
};

// GET /api/kelas/:id
export const getKelasById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID kelas tidak valid' });

    const kelas = await prisma.kelas_pelatihan.findUnique({ where: { id_kelas: id }, include: withCounts });
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    res.json({ data: toResponse(kelas) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data kelas', error: error.message });
  }
};

// POST /api/kelas (admin)
export const createKelas = async (req, res) => {
  try {
    const { data, errors } = parseKelasInput(req.body);
    terapkanAturanTipe(data, data.tipe_kelas ?? 'kelas');
    if (kuesionerTidakValid(data.kuesioner_mulai, data.kuesioner_selesai)) {
      errors.push('Periode kuesioner: tanggal mulai harus sebelum tanggal selesai');
    }
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const kelas = await prisma.$transaction(async (tx) => {
      const created = await tx.kelas_pelatihan.create({ data, include: withCounts });
      await catatAudit(tx, req, {
        aksi: 'tambah',
        entitas: 'kelas_pelatihan',
        idEntitas: created.id_kelas,
        detail: { nama_kelas: created.nama_kelas },
      });
      return created;
    });

    res.status(201).json({ message: 'Kelas berhasil dibuat', data: toResponse(kelas) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat kelas', error: error.message });
  }
};

// PUT /api/kelas/:id (admin) - update sebagian field
export const updateKelas = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID kelas tidak valid' });

    const existing = await prisma.kelas_pelatihan.findUnique({ where: { id_kelas: id }, include: withCounts });
    if (!existing) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

    const { data, errors } = parseKelasInput(req.body, { partial: true });
    if (!errors.length && Object.keys(data).length === 0) errors.push('Tidak ada data yang diubah');
    terapkanAturanTipe(data, data.tipe_kelas ?? existing.tipe_kelas, existing.jumlah_pertemuan);

    const pesertaAktif = existing._count.pendaftaran_pelatihan;
    if (data.kuota_maks !== undefined && data.kuota_maks < pesertaAktif) {
      errors.push(`Kuota tidak boleh kurang dari jumlah peserta terdaftar (${pesertaAktif})`);
    }
    if (data.jumlah_pertemuan !== undefined && data.jumlah_pertemuan < existing._count.pertemuan_kelas) {
      errors.push(`Jumlah pertemuan tidak boleh kurang dari pertemuan yang sudah dijadwalkan (${existing._count.pertemuan_kelas})`);
    }
    const mulai = data.kuesioner_mulai !== undefined ? data.kuesioner_mulai : existing.kuesioner_mulai;
    const selesai = data.kuesioner_selesai !== undefined ? data.kuesioner_selesai : existing.kuesioner_selesai;
    if (kuesionerTidakValid(mulai, selesai)) {
      errors.push('Periode kuesioner: tanggal mulai harus sebelum tanggal selesai');
    }
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const kelas = await prisma.$transaction(async (tx) => {
      const updated = await tx.kelas_pelatihan.update({ where: { id_kelas: id }, data, include: withCounts });
      await catatAudit(tx, req, {
        aksi: data.status && data.status !== existing.status ? 'ubah_status' : 'ubah',
        entitas: 'kelas_pelatihan',
        idEntitas: id,
        detail: { field: Object.keys(data), status_lama: existing.status, status_baru: updated.status },
      });
      return updated;
    });

    res.json({ message: 'Kelas berhasil diperbarui', data: toResponse(kelas) });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui kelas', error: error.message });
  }
};

// DELETE /api/kelas/:id (admin) - hanya untuk kelas yang belum dipakai
export const deleteKelas = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID kelas tidak valid' });

    const kelas = await prisma.kelas_pelatihan.findUnique({
      where: { id_kelas: id },
      include: { _count: { select: { pendaftaran_pelatihan: true, pertemuan_kelas: true, materi: true } } },
    });
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

    const { pendaftaran_pelatihan, pertemuan_kelas, materi } = kelas._count;
    if (pendaftaran_pelatihan || pertemuan_kelas || materi) {
      return res.status(409).json({
        message: 'Kelas sudah memiliki pendaftar, jadwal, atau materi. Ubah statusnya menjadi "Dibatalkan" sebagai gantinya.',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.kelas_pelatihan.delete({ where: { id_kelas: id } });
      await catatAudit(tx, req, {
        aksi: 'hapus',
        entitas: 'kelas_pelatihan',
        idEntitas: id,
        detail: { nama_kelas: kelas.nama_kelas },
      });
    });

    res.json({ message: 'Kelas berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus kelas', error: error.message });
  }
};
