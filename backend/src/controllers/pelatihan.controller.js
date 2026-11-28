import prisma from '../lib/prisma.js';
import { catatAudit } from '../utils/audit.js';

// Helper membuat kode tagihan unik: TAG-PLT-YYYYMMDD-XXXX
const generateKodeTagihan = () => {
  const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TAG-PLT-${tgl}-${rand}`;
};

// GET /api/pelatihan - Daftar kelas pelatihan yang dibuka untuk pendaftaran
export const getAllPelatihan = async (req, res) => {
  try {
    const listKelas = await prisma.kelas_pelatihan.findMany({
      where: { status: 'dibuka' },
      include: {
        _count: {
          select: {
            pendaftaran_pelatihan: { where: { status: { not: 'dibatalkan' } } },
            pertemuan_kelas: true,
          },
        },
        pertemuan_kelas: {
          orderBy: { pertemuan_ke: 'asc' },
          select: {
            pertemuan_ke: true,
            tanggal: true,
            jam_mulai: true,
            jam_selesai: true,
            ruang: true,
            pengajar: { select: { nama_lengkap: true } },
          },
        },
      },
      orderBy: [{ tanggal_mulai: 'asc' }, { id_kelas: 'desc' }],
    });

    // Jika pengguna sedang login, ambil juga ID kelas yang sudah didaftar
    let pendaftaranSaya = [];
    if (req.user?.id) {
      const terdaftar = await prisma.pendaftaran_pelatihan.findMany({
        where: { id_pengguna: req.user.id, status: { not: 'dibatalkan' } },
        select: { id_kelas: true, status: true, id_pendaftaran: true },
      });
      pendaftaranSaya = terdaftar;
    }

    const data = listKelas.map((k) => {
      const terdaftar = pendaftaranSaya.find((p) => p.id_kelas === k.id_kelas);
      const kuotaTerisi = k._count.pendaftaran_pelatihan;
      const sisaKuota = Math.max(0, k.kuota_maks - kuotaTerisi);

      // Ambil ringkasan pengajar utama & jadwal
      const namaPengajar = [...new Set(k.pertemuan_kelas.map((p) => p.pengajar?.nama_lengkap).filter(Boolean))];
      const sesiJadwal = k.pertemuan_kelas[0]
        ? `${k.pertemuan_kelas[0].jam_mulai.toISOString().slice(11, 16)}–${k.pertemuan_kelas[0].jam_selesai.toISOString().slice(11, 16)}`
        : null;

      return {
        id_kelas: k.id_kelas,
        nama_kelas: k.nama_kelas,
        jenis_pelatihan: k.jenis_pelatihan,
        tipe_kelas: k.tipe_kelas,
        tarif: Number(k.tarif),
        kuota_maks: k.kuota_maks,
        kuota_terisi: kuotaTerisi,
        sisa_kuota: sisaKuota,
        jumlah_pertemuan: k.jumlah_pertemuan,
        pertemuan_terjadwal: k._count.pertemuan_kelas,
        tanggal_mulai: k.tanggal_mulai,
        pengajar: namaPengajar,
        jam_sesi: sesiJadwal,
        status: k.status,
        sudah_terdaftar: Boolean(terdaftar),
        status_pendaftaran_saya: terdaftar?.status ?? null,
        id_pendaftaran_saya: terdaftar?.id_pendaftaran ?? null,
      };
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar pelatihan', error: error.message });
  }
};

// GET /api/pelatihan/:id - Detail satu kelas pelatihan
export const getPelatihanById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID kelas tidak valid' });

    const k = await prisma.kelas_pelatihan.findUnique({
      where: { id_kelas: id },
      include: {
        _count: {
          select: {
            pendaftaran_pelatihan: { where: { status: { not: 'dibatalkan' } } },
            pertemuan_kelas: true,
          },
        },
        pertemuan_kelas: {
          orderBy: { pertemuan_ke: 'asc' },
          include: { pengajar: { select: { nama_lengkap: true } } },
        },
      },
    });

    if (!k) return res.status(404).json({ message: 'Kelas pelatihan tidak ditemukan' });

    const kuotaTerisi = k._count.pendaftaran_pelatihan;
    res.json({
      data: {
        ...k,
        tarif: Number(k.tarif),
        kuota_terisi: kuotaTerisi,
        sisa_kuota: Math.max(0, k.kuota_maks - kuotaTerisi),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail kelas', error: error.message });
  }
};

// POST /api/pelatihan/daftar - Mendaftar ke kelas pelatihan dengan skema pembayaran (Lunas vs Cicilan)
export const daftarPelatihan = async (req, res) => {
  try {
    const idPengguna = req.user.id;
    const { id_kelas, metode_pembayaran = 'lunas', jumlah_cicilan = 3, alasan_cicilan = '' } = req.body;

    const kelasId = Number(id_kelas);
    if (!Number.isInteger(kelasId) || kelasId <= 0) {
      return res.status(400).json({ message: 'ID kelas pelatihan wajib diisi' });
    }

    const cicilanJml = Number(jumlah_cicilan);
    if (metode_pembayaran === 'cicilan' && (![2, 3].includes(cicilanJml))) {
      return res.status(400).json({ message: 'Skema cicilan maksimal 3 kali (pilih 2 atau 3 kali)' });
    }

    // 1. Cek ketersediaan kelas & kuota
    const kelas = await prisma.kelas_pelatihan.findUnique({
      where: { id_kelas: kelasId },
      include: {
        _count: {
          select: { pendaftaran_pelatihan: { where: { status: { not: 'dibatalkan' } } } },
        },
        pertemuan_kelas: {
          orderBy: { pertemuan_ke: 'asc' },
          select: { pertemuan_ke: true, tanggal: true },
        },
      },
    });

    if (!kelas) return res.status(404).json({ message: 'Kelas pelatihan tidak ditemukan' });
    if (kelas.status !== 'dibuka') {
      return res.status(400).json({ message: `Pendaftaran tidak dibuka untuk kelas berstatus "${kelas.status}"` });
    }

    if (kelas._count.pendaftaran_pelatihan >= kelas.kuota_maks) {
      return res.status(400).json({ message: 'Kuota kelas pelatihan sudah penuh' });
    }

    // 2. Cek apakah pengguna sudah mendaftar kelas ini sebelumnya
    const pendaftaranAda = await prisma.pendaftaran_pelatihan.findFirst({
      where: {
        id_pengguna: idPengguna,
        id_kelas: kelasId,
        status: { not: 'dibatalkan' },
      },
    });

    if (pendaftaranAda) {
      return res.status(409).json({ message: 'Anda sudah terdaftar di kelas pelatihan ini' });
    }

    const totalTarif = Number(kelas.tarif);
    const kodeTagihan = generateKodeTagihan();

    // Tentukan batas bayar awal: tanggal pertemuan 1 atau 7 hari dari sekarang
    const pertemuan1 = kelas.pertemuan_kelas.find((p) => p.pertemuan_ke === 1);
    const batasBayarAwal = pertemuan1?.tanggal ?? new Date(Date.now() + 7 * 86400000);

    // 3. Eksekusi transaksi pembuatan pendaftaran & tagihan (serta cicilan jika dipilih)
    const result = await prisma.$transaction(async (tx) => {
      // Buat tagihan induk
      const tagihanBaru = await tx.tagihan.create({
        data: {
          kode_tagihan: kodeTagihan,
          jenis_layanan: 'pelatihan',
          total_tagihan: totalTarif,
          status: 'menunggu_pembayaran',
          batas_bayar: batasBayarAwal,
        },
      });

      // Buat pendaftaran pelatihan
      const pendaftaranBaru = await tx.pendaftaran_pelatihan.create({
        data: {
          id_pengguna: idPengguna,
          id_kelas: kelasId,
          id_tagihan: tagihanBaru.id_tagihan,
          status: 'menunggu_pembayaran',
        },
      });

      let skema = null;
      let daftarCicilan = [];

      // Jika skema cicilan dipilih
      if (metode_pembayaran === 'cicilan') {
        skema = await tx.skema_angsuran.create({
          data: {
            id_tagihan: tagihanBaru.id_tagihan,
            jumlah_cicilan: cicilanJml,
            alasan: alasan_cicilan || 'Pengajuan cicilan pembayaran pelatihan',
            status: 'disetujui', // Otomatis disetujui sesuai aturan sistem
            catatan_putusan: `Skema angsuran ${cicilanJml}x disetujui otomatis`,
            tanggal_putusan: new Date(),
          },
        });

        // Hitung nominal per cicilan (sisa pembulatan ditaruh di cicilan terakhir)
        const nominalRata = Math.floor(totalTarif / cicilanJml);
        const sisaPembulatan = totalTarif - nominalRata * cicilanJml;

        // Tentukan jatuh tempo cicilan:
        // Cicilan 1: Diawal (pertemuan 1)
        // Cicilan 2: Ditengah (pertemuan ~N/2)
        // Cicilan 3: Diakhir (pertemuan N)
        const totalPertemuan = kelas.jumlah_pertemuan || 20;
        const keTengah = Math.round(totalPertemuan / 2);
        const pertemuanTengah = kelas.pertemuan_kelas.find((p) => p.pertemuan_ke === keTengah);
        const pertemuanAkhir = kelas.pertemuan_kelas.find((p) => p.pertemuan_ke === totalPertemuan);

        const jatuhTempoTengah = pertemuanTengah?.tanggal ?? new Date(batasBayarAwal.getTime() + 30 * 86400000);
        const jatuhTempoAkhir = pertemuanAkhir?.tanggal ?? new Date(batasBayarAwal.getTime() + 60 * 86400000);

        for (let i = 1; i <= cicilanJml; i++) {
          const nominal = i === cicilanJml ? nominalRata + sisaPembulatan : nominalRata;
          let jatuhTempo = batasBayarAwal;
          if (cicilanJml === 3) {
            if (i === 2) jatuhTempo = jatuhTempoTengah;
            if (i === 3) jatuhTempo = jatuhTempoAkhir;
          } else if (cicilanJml === 2) {
            if (i === 2) jatuhTempo = jatuhTempoAkhir;
          }

          const cicilanRow = await tx.cicilan.create({
            data: {
              id_angsuran: skema.id_angsuran,
              cicilan_ke: i,
              nominal,
              jatuh_tempo: jatuhTempo,
              kode_tagihan_termin: `${kodeTagihan}-T${i}`,
              status: i === 1 ? 'menunggu_pembayaran' : 'belum_terbit',
            },
          });
          daftarCicilan.push(cicilanRow);
        }
      }

      await catatAudit(tx, req, {
        aksi: 'daftar_pelatihan',
        entitas: 'pendaftaran_pelatihan',
        idEntitas: pendaftaranBaru.id_pendaftaran,
        detail: {
          id_kelas: kelasId,
          nama_kelas: kelas.nama_kelas,
          metode_pembayaran,
          kode_tagihan: kodeTagihan,
          total: totalTarif,
        },
      });

      return {
        pendaftaran: pendaftaranBaru,
        tagihan: tagihanBaru,
        skema,
        cicilan: daftarCicilan,
      };
    });

    res.status(201).json({
      message: 'Pendaftaran kelas pelatihan berhasil! Silakan lakukan pembayaran via setor tunai/transfer bank.',
      data: result,
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan pendaftaran pelatihan', error: error.message });
  }
};

// GET /api/pelatihan/my-pendaftaran - Daftar pelatihan yang diikuti pengguna aktif beserta status tagihan & cicilan
export const getMyPelatihan = async (req, res) => {
  try {
    const idPengguna = req.user.id;
    const list = await prisma.pendaftaran_pelatihan.findMany({
      where: { id_pengguna: idPengguna },
      include: {
        kelas_pelatihan: {
          include: {
            pertemuan_kelas: {
              orderBy: { pertemuan_ke: 'asc' },
              select: {
                id_pertemuan: true,
                pertemuan_ke: true,
                tanggal: true,
                jam_mulai: true,
                jam_selesai: true,
                ruang: true,
                topik: true,
                pengajar: { select: { nama_lengkap: true } },
              },
            },
          },
        },
        tagihan: {
          include: {
            pembayaran: {
              orderBy: { tanggal_unggah: 'desc' },
            },
            skema_angsuran: {
              include: {
                cicilan: {
                  orderBy: { cicilan_ke: 'asc' },
                  include: {
                    pembayaran: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { tanggal_daftar: 'desc' },
    });

    const data = list.map((item) => {
      const tagihan = item.tagihan;
      const skema = tagihan?.skema_angsuran?.[0] ?? null;
      const isCicilan = Boolean(skema);

      return {
        id_pendaftaran: item.id_pendaftaran,
        status_pendaftaran: item.status,
        tanggal_daftar: item.tanggal_daftar,
        nilai_pretest: item.nilai_pretest !== null ? Number(item.nilai_pretest) : null,
        nilai_akhir: item.nilai_akhir !== null ? Number(item.nilai_akhir) : null,
        kelas: {
          id_kelas: item.kelas_pelatihan.id_kelas,
          nama_kelas: item.kelas_pelatihan.nama_kelas,
          jenis_pelatihan: item.kelas_pelatihan.jenis_pelatihan,
          tipe_kelas: item.kelas_pelatihan.tipe_kelas,
          tarif: Number(item.kelas_pelatihan.tarif),
          jumlah_pertemuan: item.kelas_pelatihan.jumlah_pertemuan,
          tanggal_mulai: item.kelas_pelatihan.tanggal_mulai,
          pertemuan: item.kelas_pelatihan.pertemuan_kelas,
        },
        tagihan: tagihan
          ? {
              id_tagihan: tagihan.id_tagihan,
              kode_tagihan: tagihan.kode_tagihan,
              total_tagihan: Number(tagihan.total_tagihan),
              status: tagihan.status,
              batas_bayar: tagihan.batas_bayar,
              is_cicilan: isCicilan,
              skema_angsuran: skema
                ? {
                    id_angsuran: skema.id_angsuran,
                    jumlah_cicilan: skema.jumlah_cicilan,
                    status: skema.status,
                    cicilan: skema.cicilan.map((c) => ({
                      id_cicilan: c.id_cicilan,
                      cicilan_ke: c.cicilan_ke,
                      nominal: Number(c.nominal),
                      jatuh_tempo: c.jatuh_tempo,
                      kode_termin: c.kode_tagihan_termin,
                      status: c.status,
                      pembayaran: c.pembayaran
                        ? {
                            id_pembayaran: c.pembayaran.id_pembayaran,
                            nominal: Number(c.pembayaran.nominal),
                            bukti_path: c.pembayaran.bukti_path,
                            status: c.pembayaran.status,
                            tanggal_unggah: c.pembayaran.tanggal_unggah,
                          }
                        : null,
                    })),
                  }
                : null,
              pembayaran_lunas: !isCicilan && tagihan.pembayaran?.[0]
                ? {
                    id_pembayaran: tagihan.pembayaran[0].id_pembayaran,
                    nominal: Number(tagihan.pembayaran[0].nominal),
                    bukti_path: tagihan.pembayaran[0].bukti_path,
                    status: tagihan.pembayaran[0].status,
                    tanggal_unggah: tagihan.pembayaran[0].tanggal_unggah,
                  }
                : null,
            }
          : null,
      };
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil riwayat pelatihan', error: error.message });
  }
};

// POST /api/pelatihan/pembayaran/upload - Unggah bukti pembayaran bank (lunas atau termin cicilan)
export const uploadBuktiPembayaran = async (req, res) => {
  try {
    const idPengguna = req.user.id;
    if (!req.file) {
      return res.status(400).json({ message: 'File bukti pembayaran wajib diunggah (JPG/PNG/PDF)' });
    }

    const id_tagihan = Number(req.body.id_tagihan);
    const id_cicilan = req.body.id_cicilan ? Number(req.body.id_cicilan) : null;

    if (!Number.isInteger(id_tagihan) || id_tagihan <= 0) {
      return res.status(400).json({ message: 'ID tagihan tidak valid' });
    }

    // Pastikan tagihan ini milik pendaftaran pengguna yang sedang login
    const tagihan = await prisma.tagihan.findFirst({
      where: {
        id_tagihan,
        pendaftaran_pelatihan: { id_pengguna: idPengguna },
      },
      include: {
        skema_angsuran: {
          include: { cicilan: true },
        },
      },
    });

    if (!tagihan) {
      return res.status(404).json({ message: 'Data tagihan tidak ditemukan atau bukan milik Anda' });
    }

    const buktiPath = req.file.path.replace(/\\/g, '/');
    let nominalBayar = Number(tagihan.total_tagihan);

    const hasil = await prisma.$transaction(async (tx) => {
      // 1. Pembayaran cicilan termin
      if (id_cicilan) {
        const cicilan = await tx.cicilan.findUnique({
          where: { id_cicilan },
          include: { pembayaran: true },
        });

        if (!cicilan) throw new Error('Data cicilan tidak ditemukan');
        nominalBayar = Number(cicilan.nominal);

        // Jika pembayaran untuk cicilan ini sudah pernah ada, perbarui bukti & tanggal
        let pembayaranRecord;
        if (cicilan.pembayaran) {
          pembayaranRecord = await tx.pembayaran.update({
            where: { id_pembayaran: cicilan.pembayaran.id_pembayaran },
            data: {
              bukti_path: buktiPath,
              tanggal_unggah: new Date(),
              status: 'menunggu',
              nominal: nominalBayar,
            },
          });
        } else {
          pembayaranRecord = await tx.pembayaran.create({
            data: {
              id_tagihan,
              id_cicilan,
              nominal: nominalBayar,
              bukti_path: buktiPath,
              status: 'menunggu',
            },
          });
        }

        // Perbarui status cicilan & tagihan
        await tx.cicilan.update({
          where: { id_cicilan },
          data: { status: 'menunggu_verifikasi' },
        });

        await tx.tagihan.update({
          where: { id_tagihan },
          data: { status: 'menunggu_verifikasi' },
        });

        return pembayaranRecord;
      }

      // 2. Pembayaran Lunas
      const pembayaranLama = await tx.pembayaran.findFirst({
        where: { id_tagihan, id_cicilan: null },
      });

      let pembayaranRecord;
      if (pembayaranLama) {
        pembayaranRecord = await tx.pembayaran.update({
          where: { id_pembayaran: pembayaranLama.id_pembayaran },
          data: {
            bukti_path: buktiPath,
            tanggal_unggah: new Date(),
            status: 'menunggu',
            nominal: nominalBayar,
          },
        });
      } else {
        pembayaranRecord = await tx.pembayaran.create({
          data: {
            id_tagihan,
            nominal: nominalBayar,
            bukti_path: buktiPath,
            status: 'menunggu',
          },
        });
      }

      await tx.tagihan.update({
        where: { id_tagihan },
        data: { status: 'menunggu_verifikasi' },
      });

      return pembayaranRecord;
  });

  res.json({
    message: 'Bukti pembayaran berhasil diunggah! Menunggu validasi admin.',
    data: hasil,
  });
} catch (error) {
  res.status(500).json({ message: 'Gagal mengunggah bukti pembayaran', error: error.message });
}
};

/**
 * GET /api/pelatihan/my-kelas-materi
 * Daftar kelas terverifikasi (pembayaran telah divalidasi admin) beserta materi belajar yang diunggah dosen
 */
export const getMyKelasMateri = async (req, res) => {
  try {
    const idPengguna = req.user.id;
    const pendaftaran = await prisma.pendaftaran_pelatihan.findMany({
      where: {
        id_pengguna: idPengguna,
        status: 'terverifikasi',
      },
      include: {
        kelas_pelatihan: {
          include: {
            materi: {
              orderBy: { tanggal_unggah: 'desc' },
            },
            pertemuan_kelas: {
              orderBy: { pertemuan_ke: 'asc' },
              select: {
                id_pertemuan: true,
                pertemuan_ke: true,
                tanggal: true,
                jam_mulai: true,
                jam_selesai: true,
                ruang: true,
                topik: true,
                pengajar: { select: { nama_lengkap: true } },
              },
            },
          },
        },
      },
      orderBy: { tanggal_daftar: 'desc' },
    });

    const data = pendaftaran.map((p) => {
      const k = p.kelas_pelatihan;
      const pengajarList = [...new Set(k.pertemuan_kelas.map((pt) => pt.pengajar?.nama_lengkap).filter(Boolean))];

      return {
        id_pendaftaran: p.id_pendaftaran,
        tanggal_daftar: p.tanggal_daftar,
        status: p.status,
        nilai_pretest: p.nilai_pretest !== null ? Number(p.nilai_pretest) : null,
        nilai_akhir: p.nilai_akhir !== null ? Number(p.nilai_akhir) : null,
        kelas: {
          id_kelas: k.id_kelas,
          nama_kelas: k.nama_kelas,
          jenis_pelatihan: k.jenis_pelatihan,
          tipe_kelas: k.tipe_kelas,
          jumlah_pertemuan: k.jumlah_pertemuan,
          tanggal_mulai: k.tanggal_mulai,
          pengajar: pengajarList,
          total_materi: k.materi.length,
          materi: k.materi.map((m) => ({
            id_materi: m.id_materi,
            judul: m.judul,
            file_path: m.file_path,
            tanggal_unggah: m.tanggal_unggah,
          })),
          pertemuan: k.pertemuan_kelas,
        },
      };
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil materi kelas terdaftar', error: error.message });
  }
};

/**
 * POST /api/pelatihan/presensi/scan
 * Mahasiswa melakukan pengambilan absen dengan memasukkan / scan token QR
 */
export const scanPresensiMahasiswa = async (req, res) => {
  try {
    const idPengguna = req.user.id;
    const token = String(req.body.token_qr ?? '').trim().toUpperCase();

    if (!token) {
      return res.status(400).json({ message: 'Kode QR / token presensi wajib diisi' });
    }

    // Cari sesi pertemuan yang sedang dibuka dengan token ini
    const pertemuan = await prisma.pertemuan_kelas.findFirst({
      where: {
        token_qr: token,
        status_presensi: 'dibuka',
        OR: [{ waktu_tutup_presensi: null }, { waktu_tutup_presensi: { gt: new Date() } }],
      },
      include: {
        kelas_pelatihan: { select: { id_kelas: true, nama_kelas: true } },
        pengajar: { select: { nama_lengkap: true } },
      },
    });

    if (!pertemuan) {
      return res.status(404).json({
        message: 'Kode QR presensi tidak valid, salah, atau sesi presensi telah ditutup oleh dosen.',
      });
    }

    // Pastikan mahasiswa terdaftar dan pembayarannya terverifikasi di kelas ini
    const pendaftaran = await prisma.pendaftaran_pelatihan.findFirst({
      where: {
        id_pengguna: idPengguna,
        id_kelas: pertemuan.id_kelas,
        status: 'terverifikasi',
      },
    });

    if (!pendaftaran) {
      return res.status(403).json({
        message: 'Anda tidak terdaftar atau pembayaran belum terverifikasi untuk kelas ini.',
      });
    }

    // Cek apakah mahasiswa sudah melakukan presensi sebelumnya
    const presensiAda = await prisma.presensi.findUnique({
      where: {
        id_pertemuan_id_pendaftaran: {
          id_pertemuan: pertemuan.id_pertemuan,
          id_pendaftaran: pendaftaran.id_pendaftaran,
        },
      },
    });

    if (presensiAda) {
      return res.status(409).json({
        message: `Anda sudah tercatat ${presensiAda.status.toUpperCase()} pada pertemuan ke-${pertemuan.pertemuan_ke} kelas ${pertemuan.kelas_pelatihan.nama_kelas}.`,
        data: presensiAda,
      });
    }

    // Catat presensi hadir
    const presensiBaru = await prisma.presensi.create({
      data: {
        id_pertemuan: pertemuan.id_pertemuan,
        id_pendaftaran: pendaftaran.id_pendaftaran,
        status: 'hadir',
        waktu_scan: new Date(),
      },
    });

    res.status(201).json({
      message: `Presensi berhasil! Anda tercatat HADIR pada pertemuan ke-${pertemuan.pertemuan_ke} (${pertemuan.kelas_pelatihan.nama_kelas}).`,
      data: {
        ...presensiBaru,
        kelas: pertemuan.kelas_pelatihan.nama_kelas,
        pertemuan_ke: pertemuan.pertemuan_ke,
        dosen: pertemuan.pengajar.nama_lengkap,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan pengambilan absensi', error: error.message });
  }
};

/**
 * GET /api/pelatihan/my-presensi-ews
 * Detail absensi dan Early Warning System (EWS) kehadiran mahasiswa pada seluruh kelas terdaftar
 */
export const getMyPresensiEws = async (req, res) => {
  try {
    const idPengguna = req.user.id;
    const AMBANG_EWS = 75; // Minimal kehadiran 75%

    // Ambil seluruh pendaftaran terverifikasi milik mahasiswa
    const pendaftaranList = await prisma.pendaftaran_pelatihan.findMany({
      where: {
        id_pengguna: idPengguna,
        status: 'terverifikasi',
      },
      include: {
        kelas_pelatihan: {
          include: {
            pertemuan_kelas: {
              orderBy: { pertemuan_ke: 'asc' },
              include: {
                pengajar: { select: { nama_lengkap: true } },
                presensi: {
                  where: { pendaftaran_pelatihan: { id_pengguna: idPengguna } },
                },
              },
            },
          },
        },
      },
      orderBy: { tanggal_daftar: 'desc' },
    });

    const data = pendaftaranList.map((p) => {
      const k = p.kelas_pelatihan;
      const pertemuan = k.pertemuan_kelas;

      // Pertemuan yang presensinya sudah dibuka atau selesai
      const sesiDibuka = pertemuan.filter((pt) => pt.status_presensi !== null);
      const totalSesiDibuka = sesiDibuka.length;

      // Hitung kehadiran mahasiswa ini
      let hadir = 0;
      let izin = 0;
      let alpha = 0;

      const detailPertemuan = pertemuan.map((pt) => {
        const presensiRecord = pt.presensi[0] ?? null;

        if (presensiRecord?.status === 'hadir') hadir++;
        else if (presensiRecord?.status === 'izin') izin++;
        else if (pt.status_presensi === 'ditutup' && !presensiRecord) alpha++;

        return {
          id_pertemuan: pt.id_pertemuan,
          pertemuan_ke: pt.pertemuan_ke,
          tanggal: pt.tanggal,
          jam_mulai: pt.jam_mulai,
          jam_selesai: pt.jam_selesai,
          ruang: pt.ruang,
          topik: pt.topik,
          pengajar: pt.pengajar?.nama_lengkap,
          status_presensi_sesi: pt.status_presensi, // 'dibuka' | 'ditutup' | null
          token_qr_aktif: pt.status_presensi === 'dibuka',
          status_kehadiran_saya: presensiRecord?.status ?? (pt.status_presensi === 'dibuka' ? 'belum_absen' : pt.status_presensi === 'ditutup' ? 'tidak_hadir' : 'belum_mulai'),
          waktu_scan: presensiRecord?.waktu_scan ?? null,
        };
      });

      const persentase = totalSesiDibuka > 0 ? Math.round((hadir / totalSesiDibuka) * 100) : 100;
      const statusEws = persentase < AMBANG_EWS ? 'peringatan' : 'aman';

      return {
        id_pendaftaran: p.id_pendaftaran,
        kelas: {
          id_kelas: k.id_kelas,
          nama_kelas: k.nama_kelas,
          jenis_pelatihan: k.jenis_pelatihan,
          tipe_kelas: k.tipe_kelas,
          jumlah_pertemuan: k.jumlah_pertemuan,
        },
        rekap: {
          total_pertemuan: k.jumlah_pertemuan,
          sesi_berjalan: totalSesiDibuka,
          hadir,
          izin,
          alpha,
          persentase,
          ambang_ews: AMBANG_EWS,
          status_ews: statusEws,
          pesan_ews:
            statusEws === 'peringatan'
              ? `Peringatan Dini (EWS): Kehadiran Anda saat ini ${persentase}% (di bawah batas minimum ${AMBANG_EWS}%). Tingkatkan kehadiran Anda agar memenuhi syarat kelulusan sertifikat!`
              : `Kehadiran Anda memenuhi standar minimum (${persentase}% >= ${AMBANG_EWS}%). Pertahankan!`,
        },
        detail_pertemuan: detailPertemuan,
      };
    });

    res.json({ data, ambang_default: AMBANG_EWS });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil rekap presensi dan EWS', error: error.message });
  }
};
