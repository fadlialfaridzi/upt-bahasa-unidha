// Dashboard Pelatihan (Admin) - #69
import prisma from '../lib/prisma.js';
import { ambangEws, persen, pertemuanRingkas } from '../services/pelatihan.service.js';
import { awalMinggu, fmtTanggal, menit, namaHari, sekarangWIB, statusWaktu, tambahHari, tanggalWIB } from '../utils/waktu.js';

const KELAS_AKTIF = ['dibuka', 'berjalan'];
const HARI_AGENDA = 7;
const JUMLAH_MINGGU_TREN = 8;
const JUMLAH_BULAN_PENDAPATAN = 6;
const HARI_KALENDER = 14;
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
// Urutan tahapan pembayaran (untuk bar bersegmen): belum bayar -> lunas
const TAHAP_TAGIHAN = ['menunggu_pembayaran', 'menunggu_verifikasi', 'sebagian', 'lunas'];

const kunciBulan = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/**
 * GET /api/admin-pelatihan/ringkasan
 * Gambaran seluruh kelas pelatihan aktif: statistik, agenda 7 hari, peserta berisiko (EWS),
 * hal yang perlu ditindaklanjuti, sebaran peserta per jenis pelatihan, dan bukti bayar yang
 * menunggu verifikasi.
 */
export const getRingkasanAdmin = async (req, res) => {
  try {
    const now = sekarangWIB();
    const senin = awalMinggu(now.tanggal);
    const minggu = tambahHari(senin, 6);
    const batasAgenda = tambahHari(now.tanggal, HARI_AGENDA);

    const awalTren = tambahHari(senin, -7 * (JUMLAH_MINGGU_TREN - 1));
    const awalBulan = new Date(Date.UTC(now.tanggal.getUTCFullYear(), now.tanggal.getUTCMonth() - (JUMLAH_BULAN_PENDAPATAN - 1), 1));

    const [kelasList, pendaftaran, ambang, pembayaranMenunggu, daftarBaru, pembayaranMasuk] = await Promise.all([
      prisma.kelas_pelatihan.findMany({
        where: { status: { in: KELAS_AKTIF } },
        include: {
          pertemuan_kelas: {
            include: {
              pengajar: { select: { nama_lengkap: true } },
              _count: { select: { presensi: { where: { status: 'hadir' } } } },
            },
            orderBy: [{ tanggal: 'asc' }, { jam_mulai: 'asc' }],
          },
        },
        orderBy: [{ status: 'asc' }, { tanggal_mulai: 'asc' }, { id_kelas: 'asc' }],
      }),
      prisma.pendaftaran_pelatihan.findMany({
        where: { status: { not: 'dibatalkan' }, kelas_pelatihan: { status: { in: KELAS_AKTIF } } },
        select: {
          id_pendaftaran: true,
          id_kelas: true,
          status: true,
          pengguna: { select: { nama_lengkap: true, nim: true } },
          presensi: { select: { id_pertemuan: true, status: true } },
          tagihan: { select: { status: true, total_tagihan: true } },
        },
      }),
      ambangEws(prisma),
      // Bukti bayar pelatihan yang diunggah peserta (alur #6/#25) dan menunggu verifikasi admin (#67)
      prisma.pembayaran.findMany({
        where: { status: 'menunggu', tagihan: { jenis_layanan: 'pelatihan' } },
        select: {
          id_pembayaran: true,
          nominal: true,
          tanggal_unggah: true,
          cicilan: { select: { cicilan_ke: true } },
          tagihan: {
            select: {
              kode_tagihan: true,
              pendaftaran_pelatihan: {
                select: { pengguna: { select: { nama_lengkap: true } }, kelas_pelatihan: { select: { id_kelas: true, nama_kelas: true } } },
              },
            },
          },
        },
        orderBy: { tanggal_unggah: 'asc' },
      }),
      // Pendaftaran pelatihan baru (semua kelas) untuk tren mingguan
      prisma.pendaftaran_pelatihan.findMany({
        where: { status: { not: 'dibatalkan' }, tanggal_daftar: { gte: new Date(awalTren.getTime() - 7 * 3600000) } },
        select: { tanggal_daftar: true },
      }),
      // Pembayaran pelatihan yang sudah diverifikasi untuk pendapatan per bulan
      prisma.pembayaran.findMany({
        where: { status: 'terverifikasi', tagihan: { jenis_layanan: 'pelatihan' }, tanggal_verifikasi: { gte: new Date(awalBulan.getTime() - 7 * 3600000) } },
        select: { nominal: true, tanggal_verifikasi: true },
      }),
    ]);

    const pesertaPerKelas = new Map();
    for (const d of pendaftaran) {
      const g = pesertaPerKelas.get(d.id_kelas) ?? { terverifikasi: [], menunggu: 0 };
      if (d.status === 'terverifikasi') g.terverifikasi.push(d);
      else g.menunggu++;
      pesertaPerKelas.set(d.id_kelas, g);
    }

    const berisiko = [];
    const perhatian = [];
    let totalHadir = 0;
    let totalSlot = 0;

    const kelas = kelasList.map((k) => {
      const peserta = pesertaPerKelas.get(k.id_kelas) ?? { terverifikasi: [], menunggu: 0 };
      const pertemuan = k.pertemuan_kelas.map((p) => ({ ...p, _status: statusWaktu(p, now) }));
      const sesi = pertemuan.filter((p) => p._status === 'selesai' && p.status_presensi);
      const hadir = sesi.reduce((n, p) => n + p._count.presensi, 0);
      const slot = sesi.length * peserta.terverifikasi.length;
      totalHadir += hadir;
      totalSlot += slot;

      // Peserta berisiko (EWS): kehadiran < ambang dari sesi presensi yang sudah lewat
      if (sesi.length) {
        const idSesi = new Set(sesi.map((p) => p.id_pertemuan));
        for (const d of peserta.terverifikasi) {
          const h = d.presensi.filter((x) => idSesi.has(x.id_pertemuan) && x.status === 'hadir').length;
          const pct = persen(h, sesi.length);
          if (pct < ambang) {
            berisiko.push({ id_pendaftaran: d.id_pendaftaran, nama: d.pengguna.nama_lengkap, nim: d.pengguna.nim, id_kelas: k.id_kelas, nama_kelas: k.nama_kelas, kehadiran: pct, hadir: h, sesi: sesi.length });
          }
        }
      }

      const terisi = peserta.terverifikasi.length + peserta.menunggu;
      const selesai = pertemuan.filter((p) => p._status === 'selesai').length;
      const ringkas = {
        id_kelas: k.id_kelas,
        nama_kelas: k.nama_kelas,
        jenis_pelatihan: k.jenis_pelatihan,
        tipe_kelas: k.tipe_kelas,
        status: k.status,
        tanggal_mulai: k.tanggal_mulai ? fmtTanggal(k.tanggal_mulai) : null,
        kuota_maks: k.kuota_maks,
        peserta_terverifikasi: peserta.terverifikasi.length,
        peserta_menunggu: peserta.menunggu,
        jumlah_pertemuan: k.jumlah_pertemuan,
        pertemuan_terjadwal: pertemuan.length,
        pertemuan_selesai: selesai,
        pengajar: [...new Set(pertemuan.map((p) => p.pengajar.nama_lengkap))],
        kehadiran: persen(hadir, slot),
      };

      // Hal yang perlu ditindaklanjuti admin
      if (pertemuan.length < k.jumlah_pertemuan) {
        perhatian.push({ jenis: 'jadwal', id_kelas: k.id_kelas, pesan: `${k.nama_kelas}: jadwal baru ${pertemuan.length}/${k.jumlah_pertemuan} pertemuan` });
      }
      if (k.kuota_maks > 0 && terisi / k.kuota_maks >= 0.9) {
        perhatian.push({ jenis: 'kuota', id_kelas: k.id_kelas, pesan: `${k.nama_kelas}: kuota hampir penuh (${terisi}/${k.kuota_maks})` });
      }
      if (peserta.menunggu > 0) {
        perhatian.push({ jenis: 'pembayaran', id_kelas: k.id_kelas, pesan: `${k.nama_kelas}: ${peserta.menunggu} pendaftar menunggu pembayaran` });
      }
      if (k.status === 'berjalan' && pertemuan.length >= k.jumlah_pertemuan && selesai === pertemuan.length) {
        perhatian.push({ jenis: 'selesai', id_kelas: k.id_kelas, pesan: `${k.nama_kelas}: semua pertemuan selesai — lengkapi nilai & ubah status kelas` });
      }
      if (k.status === 'dibuka' && k.tanggal_mulai && k.tanggal_mulai <= tambahHari(now.tanggal, 7) && terisi === 0) {
        perhatian.push({ jenis: 'peserta', id_kelas: k.id_kelas, pesan: `${k.nama_kelas}: mulai ${fmtTanggal(k.tanggal_mulai)} tetapi belum ada pendaftar` });
      }

      return { ringkas, pertemuan };
    });

    const semuaPertemuan = kelas.flatMap(({ ringkas, pertemuan }) =>
      pertemuan.map((p) => pertemuanRingkas({ ...p, kelas_pelatihan: { nama_kelas: ringkas.nama_kelas } }, now))
    );
    const urut = (a, b) => (a.tanggal + a.jam_mulai).localeCompare(b.tanggal + b.jam_mulai);
    const agenda = semuaPertemuan
      .filter((p) => p.status !== 'selesai' && p.tanggal <= fmtTanggal(batasAgenda))
      .sort(urut);

    const perJenis = {};
    for (const { ringkas } of kelas) {
      perJenis[ringkas.jenis_pelatihan] = (perJenis[ringkas.jenis_pelatihan] ?? 0) + ringkas.peserta_terverifikasi + ringkas.peserta_menunggu;
    }

    const ringkasKelas = kelas.map(({ ringkas }) => ringkas);
    const buktiMenunggu = pembayaranMenunggu.map((p) => ({
      id_pembayaran: p.id_pembayaran,
      nama: p.tagihan.pendaftaran_pelatihan?.pengguna.nama_lengkap ?? '—',
      id_kelas: p.tagihan.pendaftaran_pelatihan?.kelas_pelatihan.id_kelas ?? null,
      nama_kelas: p.tagihan.pendaftaran_pelatihan?.kelas_pelatihan.nama_kelas ?? '—',
      kode_tagihan: p.tagihan.kode_tagihan,
      nominal: p.nominal,
      cicilan_ke: p.cicilan?.cicilan_ke ?? null,
      tanggal_unggah: p.tanggal_unggah,
    }));
    if (buktiMenunggu.length) {
      perhatian.unshift({ jenis: 'verifikasi', id_kelas: null, pesan: `${buktiMenunggu.length} bukti pembayaran menunggu verifikasi` });
    }

    // ---------- Analitik ----------
    // Pendaftaran baru per minggu (Senin), 8 minggu terakhir
    const daftarMinggu = Array.from({ length: JUMLAH_MINGGU_TREN }, (_, i) => fmtTanggal(tambahHari(awalTren, i * 7)));
    const hitDaftar = Object.fromEntries(daftarMinggu.map((m) => [m, 0]));
    for (const d of daftarBaru) {
      const k = fmtTanggal(awalMinggu(tanggalWIB(d.tanggal_daftar)));
      if (k in hitDaftar) hitDaftar[k]++;
    }
    const trenPendaftaran = daftarMinggu.map((m) => ({ minggu: m, jumlah: hitDaftar[m] }));

    // Pendapatan (pembayaran terverifikasi) per bulan, 6 bulan terakhir
    const bulanList = Array.from({ length: JUMLAH_BULAN_PENDAPATAN }, (_, i) => new Date(Date.UTC(awalBulan.getUTCFullYear(), awalBulan.getUTCMonth() + i, 1)));
    const nilaiBulan = Object.fromEntries(bulanList.map((b) => [kunciBulan(b), 0]));
    for (const p of pembayaranMasuk) {
      const k = kunciBulan(tanggalWIB(p.tanggal_verifikasi));
      if (k in nilaiBulan) nilaiBulan[k] += Number(p.nominal);
    }
    const pendapatan = bulanList.map((b) => ({ bulan: kunciBulan(b), label: NAMA_BULAN[b.getUTCMonth()], total: nilaiBulan[kunciBulan(b)] }));

    // Tahapan pembayaran tagihan peserta di kelas aktif
    const tahap = Object.fromEntries(TAHAP_TAGIHAN.map((s) => [s, { jumlah: 0, total: 0 }]));
    for (const d of pendaftaran) {
      const s = d.tagihan?.status;
      if (s && tahap[s]) {
        tahap[s].jumlah++;
        tahap[s].total += Number(d.tagihan.total_tagihan);
      }
    }

    // Kehadiran per minggu (sesi presensi yang sudah lewat)
    const hadirMinggu = Object.fromEntries(daftarMinggu.map((m) => [m, { hadir: 0, slot: 0 }]));
    for (const { ringkas, pertemuan } of kelas) {
      for (const p of pertemuan) {
        if (p._status !== 'selesai' || !p.status_presensi) continue;
        const g = hadirMinggu[fmtTanggal(awalMinggu(p.tanggal))];
        if (!g) continue;
        g.hadir += p._count.presensi;
        g.slot += ringkas.peserta_terverifikasi;
      }
    }
    const trenKehadiran = daftarMinggu.map((m) => ({ minggu: m, persen: persen(hadirMinggu[m].hadir, hadirMinggu[m].slot) }));

    // Okupansi kuota kelas aktif
    const totalKuota = ringkasKelas.reduce((n, k) => n + k.kuota_maks, 0);
    const totalTerisi = ringkasKelas.reduce((n, k) => n + k.peserta_terverifikasi + k.peserta_menunggu, 0);

    // Kalender 14 hari: jumlah pertemuan & jam mengajar per hari
    const kalender = Array.from({ length: HARI_KALENDER }, (_, i) => {
      const t = tambahHari(now.tanggal, i);
      const iso = fmtTanggal(t);
      const items = semuaPertemuan.filter((p) => p.tanggal === iso).sort(urut);
      return {
        tanggal: iso,
        hari: namaHari(t),
        jumlah: items.length,
        jam: items.reduce((n, p) => n + (menit(new Date(`1970-01-01T${p.jam_selesai}:00Z`)) - menit(new Date(`1970-01-01T${p.jam_mulai}:00Z`))) / 60, 0),
        pertemuan: items.map((p) => ({ nama_kelas: p.nama_kelas, jam_mulai: p.jam_mulai, jam_selesai: p.jam_selesai, ruang: p.ruang, pengajar: p.pengajar })),
      };
    });

    res.json({
      data: {
        stats: {
          kelas_aktif: ringkasKelas.length,
          kelas_berjalan: ringkasKelas.filter((k) => k.status === 'berjalan').length,
          peserta_aktif: ringkasKelas.reduce((n, k) => n + k.peserta_terverifikasi, 0),
          menunggu_pembayaran: ringkasKelas.reduce((n, k) => n + k.peserta_menunggu, 0),
          pertemuan_minggu_ini: semuaPertemuan.filter((p) => p.tanggal >= fmtTanggal(senin) && p.tanggal <= fmtTanggal(minggu)).length,
          rerata_kehadiran: persen(totalHadir, totalSlot),
          peserta_berisiko: berisiko.length,
          pembayaran_menunggu: buktiMenunggu.length,
        },
        pembayaran_menunggu: buktiMenunggu,
        ambang_ews: ambang,
        minggu: { mulai: fmtTanggal(senin), selesai: fmtTanggal(minggu) },
        kelas: ringkasKelas,
        agenda,
        berisiko: berisiko.sort((a, b) => a.kehadiran - b.kehadiran),
        perhatian,
        per_jenis: perJenis,
        analitik: {
          tren_pendaftaran: trenPendaftaran,
          pendapatan,
          tahap_pembayaran: TAHAP_TAGIHAN.map((s) => ({ status: s, ...tahap[s] })),
          tren_kehadiran: trenKehadiran,
          okupansi: { terisi: totalTerisi, kuota: totalKuota, persen: persen(totalTerisi, totalKuota) },
          kalender,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memuat ringkasan pelatihan', error: error.message });
  }
};
