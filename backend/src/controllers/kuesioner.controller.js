// Kuesioner Evaluasi Pengajar (Dosen & Peserta)
import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';
import { persen } from '../services/pelatihan.service.js';
import { aksesKelas } from '../services/ruang-kelas.service.js';
import { fmtTanggal, sekarangWIB } from '../utils/waktu.js';

const SKOR_MIN = 1;
const SKOR_MAKS = 5;
const MAKS_KOMENTAR = 1000;

const PERTANYAAN_DEFAULT = [
  { urutan: 1, teks_pertanyaan: 'Penguasaan dan kedalaman materi pembelajaran oleh dosen pengajar' },
  { urutan: 2, teks_pertanyaan: 'Kejelasan metode penyampaian dan kemudahan materi untuk dipahami' },
  { urutan: 3, teks_pertanyaan: 'Ketepatan waktu, kedisiplinan, dan keteraturan pelaksanaan perkuliahan' },
  { urutan: 4, teks_pertanyaan: 'Kemampuan dosen dalam membangun interaksi, diskusi, dan motivasi belajar peserta' },
  { urutan: 5, teks_pertanyaan: 'Kesesuaian materi latihan/tugas dengan tujuan pelatihan bahasa' },
];

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const rataRata2 = (arr) => {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
};

export function predikatSkor(skor) {
  if (skor === null || skor === undefined) return { label: 'Belum ada penilaian', kode: 'belum' };
  if (skor >= 4.25) return { label: 'Sangat Baik', kode: 'sangat_baik' };
  if (skor >= 3.5) return { label: 'Baik', kode: 'baik' };
  if (skor >= 2.5) return { label: 'Cukup', kode: 'cukup' };
  return { label: 'Perlu Peningkatan', kode: 'kurang' };
}

/**
 * Status periode pengisian kuesioner pada suatu kelas berdasarkan tanggal hari ini (WIB).
 * Bila admin tidak mengisi kuesioner_mulai & kuesioner_selesai, kuesioner dianggap terbuka selama kelas tidak dibatalkan.
 */
export function statusPeriodeKuesioner(kelas, now = sekarangWIB()) {
  if (kelas.status === 'dibatalkan') {
    return { status: 'ditutup', bisa_isi: false, keterangan: 'Kelas dibatalkan', mulai: null, selesai: null };
  }
  const hariIni = fmtTanggal(now.tanggal);
  const mulai = kelas.kuesioner_mulai ? fmtTanggal(kelas.kuesioner_mulai) : null;
  const selesai = kelas.kuesioner_selesai ? fmtTanggal(kelas.kuesioner_selesai) : null;

  if (mulai && hariIni < mulai) {
    return { status: 'belum_dibuka', bisa_isi: false, keterangan: `Dibuka mulai ${mulai}`, mulai, selesai };
  }
  if (selesai && hariIni > selesai) {
    return { status: 'ditutup', bisa_isi: false, keterangan: `Berakhir pada ${selesai}`, mulai, selesai };
  }
  return {
    status: 'dibuka',
    bisa_isi: true,
    keterangan: selesai ? `Terbuka s.d. ${selesai}` : 'Terbuka untuk diisi peserta',
    mulai,
    selesai,
  };
}

/** Pastikan tabel pertanyaan_kuesioner memiliki instrumen pertanyaan aktif. */
async function pastikanPertanyaanAktif(db) {
  let list = await db.pertanyaan_kuesioner.findMany({
    where: { aktif: true },
    orderBy: [{ urutan: 'asc' }, { id_pertanyaan: 'asc' }],
  });
  if (list.length === 0) {
    await db.pertanyaan_kuesioner.createMany({
      data: PERTANYAAN_DEFAULT.map((q) => ({ ...q, aktif: true })),
    });
    list = await db.pertanyaan_kuesioner.findMany({
      where: { aktif: true },
      orderBy: [{ urutan: 'asc' }, { id_pertanyaan: 'asc' }],
    });
  }
  return list;
}

/** Hitung agregasi skor per pertanyaan, distribusi 1..5, dan daftar komentar anonim. */
function olahHasilKuesioner(pertanyaanList, kuesionerList) {
  const semuaSkor = [];
  const distribusiTotal = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const perPertanyaan = new Map(
    pertanyaanList.map((q) => [
      q.id_pertanyaan,
      {
        id_pertanyaan: q.id_pertanyaan,
        urutan: q.urutan,
        teks_pertanyaan: q.teks_pertanyaan,
        skor_list: [],
        distribusi: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    ])
  );

  const komentar = [];

  for (const k of kuesionerList) {
    const skorKuesioner = [];
    for (const j of k.jawaban_kuesioner) {
      const s = Number(j.skor);
      if (s >= 1 && s <= 5) {
        semuaSkor.push(s);
        skorKuesioner.push(s);
        distribusiTotal[s] = (distribusiTotal[s] || 0) + 1;
        const itemQ = perPertanyaan.get(j.id_pertanyaan);
        if (itemQ) {
          itemQ.skor_list.push(s);
          itemQ.distribusi[s] = (itemQ.distribusi[s] || 0) + 1;
        }
      }
    }

    const teksKomentar = String(k.komentar ?? '').trim();
    if (teksKomentar) {
      komentar.push({
        id_kuesioner: k.id_kuesioner,
        id_kelas: k.pendaftaran_pelatihan.id_kelas,
        nama_kelas: k.pendaftaran_pelatihan.kelas_pelatihan?.nama_kelas ?? '',
        komentar: teksKomentar,
        tanggal_isi: k.tanggal_isi,
        rerata_skor: rataRata2(skorKuesioner),
      });
    }
  }

  const instrumen = [...perPertanyaan.values()].map(({ skor_list, ...q }) => {
    const rata_rata = rataRata2(skor_list);
    return {
      ...q,
      jumlah_jawaban: skor_list.length,
      rata_rata,
      persen_kepuasan: rata_rata !== null ? Math.round((rata_rata / SKOR_MAKS) * 100) : null,
      predikat: predikatSkor(rata_rata),
    };
  });

  const rerataTotal = rataRata2(semuaSkor);

  return {
    total_jawaban_item: semuaSkor.length,
    rerata_skor: rerataTotal,
    persen_kepuasan: rerataTotal !== null ? Math.round((rerataTotal / SKOR_MAKS) * 100) : null,
    predikat: predikatSkor(rerataTotal),
    distribusi: distribusiTotal,
    instrumen,
    komentar: komentar.sort((a, b) => new Date(b.tanggal_isi) - new Date(a.tanggal_isi)),
  };
}

/**
 * GET /api/dosen/kuesioner?idKelas=<opsional>
 * Rekapitulasi hasil kuesioner evaluasi pengajar milik dosen yang sedang login
 * (keseluruhan lintas kelas maupun spesifik per kelas).
 */
export const getKuesionerDosen = async (req, res, next) => {
  try {
    const idPengajar = req.user.id;
    const filterKelasId = req.query.idKelas ? parseId(req.query.idKelas) : null;
    if (req.query.idKelas && !filterKelasId) {
      return res.status(400).json({ message: 'Filter ID kelas tidak valid' });
    }

    const now = sekarangWIB();
    const [pertanyaanList, kelasList, semuaKuesioner] = await Promise.all([
      pastikanPertanyaanAktif(prisma),
      prisma.kelas_pelatihan.findMany({
        where: {
          status: { not: 'dibatalkan' },
          pertemuan_kelas: { some: { id_pengajar: idPengajar } },
        },
        select: {
          id_kelas: true,
          nama_kelas: true,
          jenis_pelatihan: true,
          tipe_kelas: true,
          status: true,
          jumlah_pertemuan: true,
          kuesioner_mulai: true,
          kuesioner_selesai: true,
          _count: {
            select: {
              pendaftaran_pelatihan: { where: { status: 'terverifikasi' } },
              pertemuan_kelas: { where: { id_pengajar: idPengajar } },
            },
          },
        },
        orderBy: [{ status: 'asc' }, { nama_kelas: 'asc' }],
      }),
      prisma.kuesioner_pengajar.findMany({
        where: {
          id_pengajar: idPengajar,
          pendaftaran_pelatihan: {
            status: 'terverifikasi',
            kelas_pelatihan: { status: { not: 'dibatalkan' } },
          },
        },
        include: {
          jawaban_kuesioner: true,
          pendaftaran_pelatihan: {
            select: {
              id_kelas: true,
              kelas_pelatihan: { select: { nama_kelas: true } },
            },
          },
        },
        orderBy: { tanggal_isi: 'desc' },
      }),
    ]);

    if (filterKelasId && !kelasList.some((k) => k.id_kelas === filterKelasId)) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan atau bukan kelas yang Anda ampu' });
    }

    // Ringkasan per kelas
    const kelas = kelasList.map((k) => {
      const kuesionerKelas = semuaKuesioner.filter((x) => x.pendaftaran_pelatihan.id_kelas === k.id_kelas);
      const peserta = k._count.pendaftaran_pelatihan;
      const responden = kuesionerKelas.length;
      const skorKelas = kuesionerKelas.flatMap((x) => x.jawaban_kuesioner.map((j) => Number(j.skor)));
      const rerata_skor = rataRata2(skorKelas);
      const jumlah_komentar = kuesionerKelas.filter((x) => String(x.komentar ?? '').trim().length > 0).length;
      const periode = statusPeriodeKuesioner(k, now);

      return {
        id_kelas: k.id_kelas,
        nama_kelas: k.nama_kelas,
        jenis_pelatihan: k.jenis_pelatihan,
        tipe_kelas: k.tipe_kelas,
        status: k.status,
        jumlah_pertemuan: k.jumlah_pertemuan,
        pertemuan_diampu: k._count.pertemuan_kelas,
        peserta,
        responden,
        belum_mengisi: Math.max(0, peserta - responden),
        partisipasi_persen: persen(responden, peserta),
        rerata_skor,
        persen_kepuasan: rerata_skor !== null ? Math.round((rerata_skor / SKOR_MAKS) * 100) : null,
        predikat: predikatSkor(rerata_skor),
        jumlah_komentar,
        periode,
      };
    });

    // Data yang dianalisis: semua kelas atau kelas terpilih
    const kuesionerTarget = filterKelasId
      ? semuaKuesioner.filter((x) => x.pendaftaran_pelatihan.id_kelas === filterKelasId)
      : semuaKuesioner;

    const kelasTarget = filterKelasId
      ? kelas.filter((k) => k.id_kelas === filterKelasId)
      : kelas;

    const totalPeserta = kelasTarget.reduce((n, k) => n + k.peserta, 0);
    const totalResponden = kuesionerTarget.length;
    const hasil = olahHasilKuesioner(pertanyaanList, kuesionerTarget);

    res.json({
      data: {
        filter_id_kelas: filterKelasId,
        kelas_aktif: filterKelasId ? kelas.find((k) => k.id_kelas === filterKelasId) ?? null : null,
        kelas,
        ringkasan: {
          jumlah_kelas: kelasTarget.length,
          total_peserta: totalPeserta,
          total_responden: totalResponden,
          belum_mengisi: Math.max(0, totalPeserta - totalResponden),
          partisipasi_persen: persen(totalResponden, totalPeserta),
          rerata_skor: hasil.rerata_skor,
          persen_kepuasan: hasil.persen_kepuasan,
          predikat: hasil.predikat,
          jumlah_komentar: hasil.komentar.length,
          total_jawaban_item: hasil.total_jawaban_item,
        },
        distribusi: hasil.distribusi,
        instrumen: hasil.instrumen,
        komentar: hasil.komentar,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ruang-kelas/:idKelas/kuesioner
 * Muat instrumen pertanyaan kuesioner & daftar pengajar kelas beserta jawaban peserta (jika role = peserta)
 * atau ringkasan evaluasi pengajar di kelas tersebut (jika role = pengajar / admin).
 */
export const getKuesionerRuangKelas = async (req, res, next) => {
  try {
    const idKelas = parseId(req.params.idKelas);
    if (!idKelas) return res.status(400).json({ message: 'ID kelas tidak valid' });

    const akses = await aksesKelas(prisma, req.user, idKelas);
    if (!akses) return res.status(403).json({ message: 'Anda tidak terdaftar di kelas ini' });

    const [kelas, pertanyaan, pertemuan] = await Promise.all([
      prisma.kelas_pelatihan.findUnique({
        where: { id_kelas: idKelas },
        select: {
          id_kelas: true,
          nama_kelas: true,
          status: true,
          kuesioner_mulai: true,
          kuesioner_selesai: true,
          _count: { select: { pendaftaran_pelatihan: { where: { status: 'terverifikasi' } } } },
        },
      }),
      pastikanPertanyaanAktif(prisma),
      prisma.pertemuan_kelas.findMany({
        where: { id_kelas: idKelas },
        select: {
          id_pengajar: true,
          pengajar: { select: { id_pengguna: true, nama_lengkap: true } },
        },
        orderBy: { pertemuan_ke: 'asc' },
      }),
    ]);

    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

    const periode = statusPeriodeKuesioner(kelas);
    const pengajarMap = new Map();
    for (const p of pertemuan) {
      const cur = pengajarMap.get(p.id_pengajar) || {
        id_pengajar: p.pengajar.id_pengguna,
        nama_lengkap: p.pengajar.nama_lengkap,
        jumlah_pertemuan: 0,
      };
      cur.jumlah_pertemuan += 1;
      pengajarMap.set(p.id_pengajar, cur);
    }
    const daftarPengajar = [...pengajarMap.values()];

    if (req.user.role === 'peserta') {
      const pendaftaran = await prisma.pendaftaran_pelatihan.findFirst({
        where: { id_kelas: idKelas, id_pengguna: req.user.id, status: 'terverifikasi' },
        select: { id_pendaftaran: true },
      });
      if (!pendaftaran) return res.status(403).json({ message: 'Pendaftaran Anda belum terverifikasi' });

      const isianSaya = await prisma.kuesioner_pengajar.findMany({
        where: { id_pendaftaran: pendaftaran.id_pendaftaran },
        include: { jawaban_kuesioner: true },
      });

      const isianPerPengajar = new Map(isianSaya.map((k) => [k.id_pengajar, k]));

      const pengajar = daftarPengajar.map((pg) => {
        const isian = isianPerPengajar.get(pg.id_pengajar);
        const jawaban = {};
        if (isian) {
          for (const j of isian.jawaban_kuesioner) {
            jawaban[j.id_pertanyaan] = j.skor;
          }
        }
        return {
          ...pg,
          sudah_diisi: Boolean(isian),
          tanggal_isi: isian?.tanggal_isi ?? null,
          komentar: isian?.komentar ?? '',
          jawaban,
          rerata_skor: isian
            ? rataRata2(isian.jawaban_kuesioner.map((j) => Number(j.skor)))
            : null,
        };
      });

      return res.json({
        data: {
          mode: 'peserta',
          periode,
          pertanyaan: pertanyaan.map((q) => ({
            id_pertanyaan: q.id_pertanyaan,
            urutan: q.urutan,
            teks_pertanyaan: q.teks_pertanyaan,
          })),
          pengajar,
          ringkasan: {
            total_pengajar: pengajar.length,
            sudah_diisi: pengajar.filter((p) => p.sudah_diisi).length,
          },
        },
      });
    }

    // Untuk dosen atau admin: tampilkan ringkasan respons kuesioner di kelas ini
    const kuesionerKelas = await prisma.kuesioner_pengajar.findMany({
      where: {
        pendaftaran_pelatihan: { id_kelas: idKelas, status: 'terverifikasi' },
        ...(req.user.role === 'pengajar' ? { id_pengajar: req.user.id } : {}),
      },
      include: {
        jawaban_kuesioner: true,
        pendaftaran_pelatihan: {
          select: { id_kelas: true, kelas_pelatihan: { select: { nama_kelas: true } } },
        },
      },
    });

    const hasil = olahHasilKuesioner(pertanyaan, kuesionerKelas);
    const totalPeserta = kelas._count.pendaftaran_pelatihan;

    return res.json({
      data: {
        mode: 'pengajar',
        periode,
        ringkasan: {
          total_peserta: totalPeserta,
          total_responden: kuesionerKelas.length,
          partisipasi_persen: persen(kuesionerKelas.length, totalPeserta),
          rerata_skor: hasil.rerata_skor,
          persen_kepuasan: hasil.persen_kepuasan,
          predikat: hasil.predikat,
          jumlah_komentar: hasil.komentar.length,
        },
        instrumen: hasil.instrumen,
        komentar: hasil.komentar.slice(0, 5),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ruang-kelas/:idKelas/kuesioner
 * Peserta menyimpan atau memperbarui evaluasi untuk seorang dosen pengajar di kelas tersebut.
 * Body: { id_pengajar, komentar?, jawaban: [{ id_pertanyaan, skor }] }
 */
export const simpanKuesionerPeserta = async (req, res, next) => {
  try {
    const idKelas = parseId(req.params.idKelas);
    if (!idKelas) return res.status(400).json({ message: 'ID kelas tidak valid' });
    if (req.user.role !== 'peserta') {
      return res.status(403).json({ message: 'Hanya peserta kelas yang dapat mengisi kuesioner evaluasi dosen' });
    }

    const idPengajar = parseId(req.body?.id_pengajar);
    if (!idPengajar) return res.status(400).json({ message: 'ID dosen pengajar tidak valid' });

    const [kelas, pendaftaran, mengajarDiKelas, pertanyaanAktif] = await Promise.all([
      prisma.kelas_pelatihan.findUnique({
        where: { id_kelas: idKelas },
        select: { id_kelas: true, nama_kelas: true, status: true, kuesioner_mulai: true, kuesioner_selesai: true },
      }),
      prisma.pendaftaran_pelatihan.findFirst({
        where: { id_kelas: idKelas, id_pengguna: req.user.id, status: 'terverifikasi' },
        select: { id_pendaftaran: true },
      }),
      prisma.pertemuan_kelas.count({
        where: { id_kelas: idKelas, id_pengajar: idPengajar },
      }),
      pastikanPertanyaanAktif(prisma),
    ]);

    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    if (!pendaftaran) return res.status(403).json({ message: 'Anda tidak terdaftar sebagai peserta terverifikasi di kelas ini' });
    if (mengajarDiKelas === 0) {
      return res.status(400).json({ message: 'Dosen tersebut tidak terjadwal mengajar di kelas ini' });
    }

    const periode = statusPeriodeKuesioner(kelas);
    if (!periode.bisa_isi) {
      return res.status(400).json({ message: `Kuesioner tidak dapat diisi (${periode.keterangan})` });
    }

    const komentar = String(req.body?.komentar ?? '').trim();
    if (komentar.length > MAKS_KOMENTAR) {
      return res.status(400).json({ message: `Komentar maksimal ${MAKS_KOMENTAR} karakter` });
    }

    const daftarJawaban = Array.isArray(req.body?.jawaban) ? req.body.jawaban : [];
    const mapJawaban = new Map();
    for (const item of daftarJawaban) {
      const idQ = parseId(item?.id_pertanyaan);
      const skor = Number(item?.skor);
      if (!idQ || !Number.isInteger(skor) || skor < SKOR_MIN || skor > SKOR_MAKS) {
        return res.status(400).json({ message: 'Setiap pertanyaan wajib diberi skor bilangan bulat 1 sampai 5' });
      }
      mapJawaban.set(idQ, skor);
    }

    for (const q of pertanyaanAktif) {
      if (!mapJawaban.has(q.id_pertanyaan)) {
        return res.status(400).json({ message: 'Mohon lengkapi penilaian untuk seluruh pertanyaan kuesioner' });
      }
    }

    await prisma.$transaction(async (tx) => {
      const kuesioner = await tx.kuesioner_pengajar.upsert({
        where: {
          id_pendaftaran_id_pengajar: {
            id_pendaftaran: pendaftaran.id_pendaftaran,
            id_pengajar: idPengajar,
          },
        },
        update: {
          komentar: komentar || null,
          tanggal_isi: new Date(),
        },
        create: {
          id_pendaftaran: pendaftaran.id_pendaftaran,
          id_pengajar: idPengajar,
          komentar: komentar || null,
        },
      });

      await tx.jawaban_kuesioner.deleteMany({
        where: { id_kuesioner: kuesioner.id_kuesioner },
      });

      await tx.jawaban_kuesioner.createMany({
        data: pertanyaanAktif.map((q) => ({
          id_kuesioner: kuesioner.id_kuesioner,
          id_pertanyaan: q.id_pertanyaan,
          skor: mapJawaban.get(q.id_pertanyaan),
        })),
      });

      await catatAudit(tx, req, {
        aksi: 'isi_kuesioner_pengajar',
        entitas: 'kuesioner_pengajar',
        idEntitas: kuesioner.id_kuesioner,
        detail: { id_kelas: idKelas, id_pengajar: idPengajar },
      });
    });

    res.status(201).json({
      message: 'Terima kasih! Kuesioner evaluasi dosen berhasil disimpan.',
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// MANAJEMEN INSTRUMEN PERTANYAAN KUESIONER (ADMIN UPT)
// ============================================================================

const MIN_TEKS_PERTANYAAN = 5;
const MAKS_TEKS_PERTANYAAN = 255;

function validasiInputPertanyaan(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.teks_pertanyaan !== undefined) {
    const teks = String(body.teks_pertanyaan ?? '').replace(/\s+/g, ' ').trim();
    if (!teks) {
      errors.push('Teks pertanyaan wajib diisi');
    } else if (teks.length < MIN_TEKS_PERTANYAAN || teks.length > MAKS_TEKS_PERTANYAAN) {
      errors.push(`Teks pertanyaan harus ${MIN_TEKS_PERTANYAAN}–${MAKS_TEKS_PERTANYAAN} karakter`);
    } else {
      data.teks_pertanyaan = teks;
    }
  }

  if (body.urutan !== undefined && body.urutan !== null && body.urutan !== '') {
    const u = Number(body.urutan);
    if (!Number.isInteger(u) || u < 1 || u > 100) {
      errors.push('Urutan pertanyaan harus bilangan bulat 1–100');
    } else {
      data.urutan = u;
    }
  }

  if (body.aktif !== undefined) {
    if (typeof body.aktif !== 'boolean') {
      errors.push('Status aktif harus berupa boolean');
    } else {
      data.aktif = body.aktif;
    }
  }

  return { data, errors };
}

/**
 * GET /api/admin-pelatihan/kuesioner
 * Daftar seluruh instrumen pertanyaan kuesioner (aktif & nonaktif) beserta statistik penggunaan
 * dan rekapitulasi partisipasi kuesioner per kelas/pengajar.
 */
export const getAdminKuesioner = async (req, res, next) => {
  try {
    // Pastikan minimal ada instrumen default bila tabel benar-benar kosong
    const totalDb = await prisma.pertanyaan_kuesioner.count();
    if (totalDb === 0) {
      await pastikanPertanyaanAktif(prisma);
    }

    const now = sekarangWIB();
    const [pertanyaanList, kuesionerList, kelasList] = await Promise.all([
      prisma.pertanyaan_kuesioner.findMany({
        include: {
          jawaban_kuesioner: { select: { skor: true } },
        },
        orderBy: [{ urutan: 'asc' }, { id_pertanyaan: 'asc' }],
      }),
      prisma.kuesioner_pengajar.findMany({
        include: {
          pengajar: { select: { id_pengguna: true, nama_lengkap: true } },
          jawaban_kuesioner: { select: { skor: true } },
          pendaftaran_pelatihan: {
            select: {
              id_kelas: true,
              kelas_pelatihan: { select: { nama_kelas: true } },
            },
          },
        },
        orderBy: { tanggal_isi: 'desc' },
      }),
      prisma.kelas_pelatihan.findMany({
        where: { status: { not: 'dibatalkan' } },
        select: {
          id_kelas: true,
          nama_kelas: true,
          jenis_pelatihan: true,
          tipe_kelas: true,
          status: true,
          kuesioner_mulai: true,
          kuesioner_selesai: true,
          _count: { select: { pendaftaran_pelatihan: { where: { status: 'terverifikasi' } } } },
          pertemuan_kelas: {
            select: { pengajar: { select: { id_pengguna: true, nama_lengkap: true } } },
          },
        },
        orderBy: [{ status: 'asc' }, { nama_kelas: 'asc' }],
      }),
    ]);

    const pertanyaan = pertanyaanList.map((q) => {
      const skorList = q.jawaban_kuesioner.map((j) => Number(j.skor));
      const rata_rata = rataRata2(skorList);
      return {
        id_pertanyaan: q.id_pertanyaan,
        teks_pertanyaan: q.teks_pertanyaan,
        urutan: q.urutan,
        aktif: q.aktif,
        jumlah_jawaban: skorList.length,
        rata_rata,
        predikat: predikatSkor(rata_rata),
      };
    });

    // Rekap per pengajar
    const pengajarMap = new Map();
    for (const k of kuesionerList) {
      const idP = k.pengajar.id_pengguna;
      const cur = pengajarMap.get(idP) || {
        id_pengajar: idP,
        nama_lengkap: k.pengajar.nama_lengkap,
        responden: 0,
        komentar: 0,
        skor_list: [],
        kelas_set: new Set(),
      };
      cur.responden += 1;
      if (String(k.komentar ?? '').trim()) cur.komentar += 1;
      for (const j of k.jawaban_kuesioner) cur.skor_list.push(Number(j.skor));
      cur.kelas_set.add(k.pendaftaran_pelatihan.kelas_pelatihan?.nama_kelas ?? '');
      pengajarMap.set(idP, cur);
    }

    const rekap_pengajar = [...pengajarMap.values()]
      .map(({ skor_list, kelas_set, ...p }) => {
        const rerata_skor = rataRata2(skor_list);
        return {
          ...p,
          kelas: [...kelas_set].filter(Boolean),
          rerata_skor,
          persen_kepuasan: rerata_skor !== null ? Math.round((rerata_skor / SKOR_MAKS) * 100) : null,
          predikat: predikatSkor(rerata_skor),
        };
      })
      .sort((a, b) => (b.rerata_skor ?? 0) - (a.rerata_skor ?? 0));

    const rekap_kelas = kelasList.map((k) => {
      const kuesionerKelas = kuesionerList.filter((x) => x.pendaftaran_pelatihan.id_kelas === k.id_kelas);
      const skorKelas = kuesionerKelas.flatMap((x) => x.jawaban_kuesioner.map((j) => Number(j.skor)));
      const rerata_skor = rataRata2(skorKelas);
      const pengajar = [...new Set(k.pertemuan_kelas.map((p) => p.pengajar.nama_lengkap))];
      return {
        id_kelas: k.id_kelas,
        nama_kelas: k.nama_kelas,
        jenis_pelatihan: k.jenis_pelatihan,
        tipe_kelas: k.tipe_kelas,
        status: k.status,
        pengajar,
        peserta: k._count.pendaftaran_pelatihan,
        isian_kuesioner: kuesionerKelas.length,
        rerata_skor,
        predikat: predikatSkor(rerata_skor),
        periode: statusPeriodeKuesioner(k, now),
      };
    });

    res.json({
      data: {
        pertanyaan,
        ringkasan: {
          total_pertanyaan: pertanyaan.length,
          pertanyaan_aktif: pertanyaan.filter((q) => q.aktif).length,
          pertanyaan_nonaktif: pertanyaan.filter((q) => !q.aktif).length,
          total_isian_kuesioner: kuesionerList.length,
        },
        rekap_pengajar,
        rekap_kelas,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin-pelatihan/kuesioner
 * Buat pertanyaan kuesioner baru.
 */
export const createPertanyaanKuesioner = async (req, res, next) => {
  try {
    const { data, errors } = validasiInputPertanyaan(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    if (data.urutan === undefined) {
      const maxRow = await prisma.pertanyaan_kuesioner.aggregate({ _max: { urutan: true } });
      data.urutan = Math.min(100, (maxRow._max.urutan || 0) + 1);
    }
    if (data.aktif === undefined) data.aktif = true;

    const created = await prisma.$transaction(async (tx) => {
      const q = await tx.pertanyaan_kuesioner.create({ data });
      await catatAudit(tx, req, {
        aksi: 'tambah_pertanyaan_kuesioner',
        entitas: 'pertanyaan_kuesioner',
        idEntitas: q.id_pertanyaan,
        detail: { urutan: q.urutan, aktif: q.aktif, teks: q.teks_pertanyaan },
      });
      return q;
    });

    res.status(201).json({
      message: 'Pertanyaan kuesioner berhasil ditambahkan',
      data: { ...created, jumlah_jawaban: 0, rata_rata: null, predikat: predikatSkor(null) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin-pelatihan/kuesioner/urutan
 * Perbarui urutan beberapa pertanyaan sekaligus (saat tombol naik/turun ditekan).
 * Body: { daftar: [{ id_pertanyaan, urutan }] }
 */
export const urutkanPertanyaanKuesioner = async (req, res, next) => {
  try {
    const daftar = req.body?.daftar;
    if (!Array.isArray(daftar) || daftar.length === 0) {
      return res.status(400).json({ message: 'Daftar urutan pertanyaan tidak valid' });
    }

    const bersih = [];
    for (const item of daftar) {
      const id = parseId(item?.id_pertanyaan);
      const urutan = Number(item?.urutan);
      if (!id || !Number.isInteger(urutan) || urutan < 1 || urutan > 100) {
        return res.status(400).json({ message: 'ID atau nomor urutan pertanyaan tidak valid' });
      }
      bersih.push({ id_pertanyaan: id, urutan });
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        bersih.map((u) =>
          tx.pertanyaan_kuesioner.update({
            where: { id_pertanyaan: u.id_pertanyaan },
            data: { urutan: u.urutan },
          })
        )
      );
      await catatAudit(tx, req, {
        aksi: 'urutkan_pertanyaan_kuesioner',
        entitas: 'pertanyaan_kuesioner',
        idEntitas: null,
        detail: { jumlah: bersih.length },
      });
    });

    res.json({ message: 'Urutan pertanyaan berhasil diperbarui' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin-pelatihan/kuesioner/:id
 * Ubah teks, urutan, atau status aktif pertanyaan kuesioner.
 */
export const updatePertanyaanKuesioner = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID pertanyaan tidak valid' });

    const existing = await prisma.pertanyaan_kuesioner.findUnique({ where: { id_pertanyaan: id } });
    if (!existing) return res.status(404).json({ message: 'Pertanyaan kuesioner tidak ditemukan' });

    const { data, errors } = validasiInputPertanyaan(req.body, { partial: true });
    if (!errors.length && Object.keys(data).length === 0) {
      errors.push('Tidak ada perubahan data');
    }
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.pertanyaan_kuesioner.update({
        where: { id_pertanyaan: id },
        data,
        include: { jawaban_kuesioner: { select: { skor: true } } },
      });
      await catatAudit(tx, req, {
        aksi: 'ubah_pertanyaan_kuesioner',
        entitas: 'pertanyaan_kuesioner',
        idEntitas: id,
        detail: data,
      });
      return q;
    });

    const skorList = updated.jawaban_kuesioner.map((j) => Number(j.skor));
    const rata_rata = rataRata2(skorList);

    res.json({
      message: 'Pertanyaan kuesioner berhasil diperbarui',
      data: {
        id_pertanyaan: updated.id_pertanyaan,
        teks_pertanyaan: updated.teks_pertanyaan,
        urutan: updated.urutan,
        aktif: updated.aktif,
        jumlah_jawaban: skorList.length,
        rata_rata,
        predikat: predikatSkor(rata_rata),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin-pelatihan/kuesioner/:id
 * Hapus pertanyaan kuesioner (hanya jika belum memiliki jawaban mahasiswa).
 */
export const deletePertanyaanKuesioner = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID pertanyaan tidak valid' });

    const existing = await prisma.pertanyaan_kuesioner.findUnique({
      where: { id_pertanyaan: id },
      include: { _count: { select: { jawaban_kuesioner: true } } },
    });
    if (!existing) return res.status(404).json({ message: 'Pertanyaan kuesioner tidak ditemukan' });

    if (existing._count.jawaban_kuesioner > 0) {
      return res.status(409).json({
        message: `Pertanyaan ini sudah memiliki ${existing._count.jawaban_kuesioner} jawaban dari peserta. Nonaktifkan pertanyaan agar riwayat nilai evaluasi tetap terjaga.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.pertanyaan_kuesioner.delete({ where: { id_pertanyaan: id } });
      await catatAudit(tx, req, {
        aksi: 'hapus_pertanyaan_kuesioner',
        entitas: 'pertanyaan_kuesioner',
        idEntitas: id,
        detail: { teks: existing.teks_pertanyaan },
      });
    });

    res.json({ message: 'Pertanyaan kuesioner berhasil dihapus' });
  } catch (err) {
    next(err);
  }
};
