// Dashboard Pelatihan (Dosen) - #70 — "hari mengajar saya"
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, firstName, greeting } from '../../components/dashboard/Widgets.jsx';
import { ChartCard, LineChart, ProgressRing, WeekTimeline } from '../../components/dashboard/Charts.jsx';
import { JENIS_PELATIHAN, TIPE_KELAS, formatTanggal, tanggalRelatif, todayInput } from '../../config/pelatihan.js';

const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const isoPlus = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Teks hitung mundur menuju pertemuan (waktu WIB). */
function useHitungMundur(p) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!p) return null;
  const mulai = Date.parse(`${p.tanggal}T${p.jam_mulai}:00+07:00`);
  const selesai = Date.parse(`${p.tanggal}T${p.jam_selesai}:00+07:00`);
  if (now >= mulai && now < selesai) return { teks: `Sedang berlangsung · selesai ${p.jam_selesai}`, live: true };
  const menit = Math.max(0, Math.round((mulai - now) / 60000));
  if (menit < 60) return { teks: `Dimulai ${menit} menit lagi` };
  if (menit < 24 * 60) return { teks: `Dimulai ${Math.floor(menit / 60)} jam ${menit % 60} menit lagi` };
  return { teks: `Dimulai ${Math.round(menit / 1440)} hari lagi` };
}

function DosenDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState(false);
  const [kelasTren, setKelasTren] = useState(null);

  const load = useCallback(async () => {
    setGagal(false);
    try {
      const res = await api.get('/dosen/ringkasan');
      setData(res.data.data);
    } catch {
      setGagal(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const berikut = data?.berikutnya[0] ?? null;
  const hitung = useHitungMundur(berikut);

  // Kelas yang punya pertemuan selesai, untuk grafik tren kehadiran.
  // Diurutkan: yang paling banyak sesi presensinya lebih dulu (jadi pilihan default).
  const kelasAdaSesi = useMemo(() => {
    const sesi = (k) => k.pertemuan.filter((p) => p.status === 'selesai' && p.status_presensi).length;
    return (data?.kelas ?? [])
      .filter((k) => k.pertemuan.some((p) => p.status === 'selesai'))
      .sort((a, b) => sesi(b) - sesi(a));
  }, [data]);
  const kelasAktifTren = kelasAdaSesi.find((k) => k.id_kelas === kelasTren) ?? kelasAdaSesi[0];

  if (gagal) {
    return (
      <div className="table-message">
        <p>Gagal memuat dashboard. Pastikan backend berjalan.</p>
        <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
      </div>
    );
  }
  if (!data) return <p className="table-message">Memuat dashboard...</p>;

  const { stats, minggu, minggu_ini: mingguIni, kelas, ambang_ews: ambang, berisiko, tugas, beban, kegiatan_minggu_ini: kegiatan } = data;
  const kelasAktif = kelas.filter((k) => ['dibuka', 'berjalan'].includes(k.status));
  const hariIni = todayInput();
  const jumlahTugas = tugas.presensi_belum.length + tugas.nilai_belum.length + berisiko.length;

  const hariMinggu = HARI_PENDEK.map((h, i) => {
    const iso = isoPlus(minggu.mulai, i);
    return { tanggal: iso, label: h, sub: formatTanggal(iso, { day: 'numeric', month: 'short' }), isToday: iso === hariIni };
  });
  const itemTimeline = [
    ...mingguIni.map((p) => ({
      key: `p${p.id_pertemuan}`, tanggal: p.tanggal, jam_mulai: p.jam_mulai, jam_selesai: p.jam_selesai,
      title: p.nama_kelas, sub: `Pertemuan ${p.pertemuan_ke}${p.ruang ? ` · ${p.ruang}` : ''}`, jenis: 'mengajar', status: p.status,
    })),
    ...kegiatan.map((g, i) => ({ key: `k${g.id_kegiatan}-${i}`, tanggal: g.tanggal, jam_mulai: g.jam_mulai, jam_selesai: g.jam_selesai, title: g.judul, sub: 'Kegiatan pribadi', jenis: 'kegiatan' })),
  ];

  const dataTren = kelasAktifTren
    ? kelasAktifTren.pertemuan
        .filter((p) => p.status === 'selesai')
        .map((p) => ({
          label: `P${p.pertemuan_ke}`,
          value: p.status_presensi && kelasAktifTren.peserta ? Math.round((p.hadir / kelasAktifTren.peserta) * 100) : null,
          tip: `Pertemuan ${p.pertemuan_ke} · ${formatTanggal(p.tanggal)}${p.status_presensi ? ` · ${p.hadir}/${kelasAktifTren.peserta} hadir` : ''}`,
        }))
    : [];

  return (
    <>
      {/* ---------- Banner: pertemuan berikutnya ---------- */}
      <section className="hero-band hero-band-dosen">
        <div className="hero-band-main">
          <p className="hero-band-eyebrow">Selamat {greeting()}, {firstName(user.nama_lengkap)}</p>
          {berikut ? (
            <>
              <p className={`countdown ${hitung?.live ? 'is-live' : ''}`}>
                <Icon name="clock" size={16} /> {hitung?.teks}
              </p>
              <h1>{berikut.nama_kelas}</h1>
              <p className="hero-band-lead">
                {tanggalRelatif(berikut.tanggal, berikut.hari)} · {berikut.jam_mulai}–{berikut.jam_selesai} · Pertemuan {berikut.pertemuan_ke}
                {berikut.ruang && ` · ${berikut.ruang}`}
                {berikut.topik && ` · ${berikut.topik}`}
              </p>
            </>
          ) : (
            <>
              <h1>Tidak ada pertemuan mendatang.</h1>
              <p className="hero-band-lead">Jadwal muncul setelah admin memplot Anda sebagai pengajar.</p>
            </>
          )}
          <div className="hero-band-actions">
            <Link to="/dashboard/dosen/kelas" className="btn btn-light btn-sm"><Icon name="graduation" size={16} /> Kelas saya</Link>
            <Link to="/dashboard/dosen/jadwal" className="btn btn-ghost-light btn-sm"><Icon name="calendar" size={16} /> Jadwal kegiatan</Link>
            <Link to="/dashboard/dosen/kuesioner" className="btn btn-ghost-light btn-sm"><Icon name="award" size={16} /> Kuesioner evaluasi</Link>
          </div>
        </div>
        <div className="hero-mini-grid">
          <div className="hero-mini">
            <span>Jam mengajar {new Date().toLocaleDateString('id-ID', { month: 'long' })}</span>
            <strong>{String(beban.jam_bulan_ini).replace('.', ',')} jam</strong>
            <small>
              {beban.jam_bulan_lalu
                ? `${beban.jam_bulan_ini >= beban.jam_bulan_lalu ? '▲' : '▼'} dari ${String(beban.jam_bulan_lalu).replace('.', ',')} jam bulan lalu`
                : 'Bulan lalu belum ada'}
            </small>
          </div>
          <div className="hero-mini">
            <span>Pertemuan bulan ini</span>
            <strong>{beban.pertemuan_bulan_ini}</strong>
            <small>{stats.pertemuan_minggu_ini} di minggu ini</small>
          </div>
          <div className="hero-mini">
            <span>Peserta diampu</span>
            <strong>{stats.peserta_total}</strong>
            <small>di {stats.kelas_diampu} kelas aktif</small>
          </div>
          <div className="hero-mini">
            <span>Rerata kehadiran</span>
            <strong>{stats.rerata_kehadiran === null ? '—' : `${stats.rerata_kehadiran}%`}</strong>
            <small>ambang lulus {ambang}%</small>
          </div>
        </div>
      </section>

      {/* ---------- Kalender per jam ---------- */}
      <ChartCard
        title="Minggu ini"
        subtitle={`${formatTanggal(minggu.mulai, { day: 'numeric', month: 'long' })} – ${formatTanggal(minggu.selesai)} · arahkan kursor ke blok untuk detail`}
        icon="calendar"
        className="timeline-card"
        action={
          <span className="timeline-legend">
            <i className="legend-dot is-mengajar" /> Mengajar UPT
            <i className="legend-dot is-kegiatan" /> Kegiatan pribadi
          </span>
        }
        table={{
          columns: ['Hari', 'Jam', 'Kegiatan'],
          rows: [...itemTimeline]
            .sort((a, b) => (a.tanggal + a.jam_mulai).localeCompare(b.tanggal + b.jam_mulai))
            .map((it) => [formatTanggal(it.tanggal, { weekday: 'short', day: 'numeric', month: 'short' }), `${it.jam_mulai}–${it.jam_selesai}`, `${it.title}${it.jenis === 'kegiatan' ? ' (pribadi)' : ''}`]),
        }}
      >
        <WeekTimeline days={hariMinggu} items={itemTimeline} />
      </ChartCard>

      {/* ---------- Kelas dengan cincin progres ---------- */}
      <section className="panel" style={{ marginTop: 20 }}>
        <header className="panel-head">
          <div className="panel-title-wrap">
            <span className="icon-tile"><Icon name="graduation" /></span>
            <div>
              <h2 className="panel-title">Kelas yang saya ampu</h2>
              <p className="panel-sub">Cincin = pertemuan selesai dari total pertemuan kelas</p>
            </div>
          </div>
          <Link to="/dashboard/dosen/kelas" className="chip-btn">Semua pertemuan <Icon name="arrowRight" size={14} /></Link>
        </header>
        {kelasAktif.length ? (
          <div className="ring-grid">
            {kelasAktif.map((k) => {
              const rendah = k.kehadiran !== null && k.kehadiran < ambang;
              return (
                <article key={k.id_kelas} className="ring-card">
                  <ProgressRing
                    value={k.pertemuan_selesai}
                    max={k.jumlah_pertemuan}
                    center={`${k.pertemuan_selesai}/${k.jumlah_pertemuan}`}
                    label={`${k.nama_kelas}: ${k.pertemuan_selesai} dari ${k.jumlah_pertemuan} pertemuan selesai`}
                  />
                  <div className="ring-card-body">
                    <strong>{k.nama_kelas}</strong>
                    <span>{JENIS_PELATIHAN[k.jenis_pelatihan]} · {TIPE_KELAS[k.tipe_kelas]}</span>
                    <div className="ring-card-meta">
                      <span><Icon name="users" size={13} /> {k.peserta}/{k.kuota_maks}</span>
                      <span className={rendah ? 'text-warning' : ''}>
                        <Icon name={rendah ? 'alert' : 'chart'} size={13} /> {k.kehadiran === null ? 'belum ada presensi' : `hadir ${k.kehadiran}%`}
                      </span>
                    </div>
                    {k.berikutnya && (
                      <span className="ring-card-next">Berikutnya: {tanggalRelatif(k.berikutnya.tanggal, k.berikutnya.hari)}, {k.berikutnya.jam_mulai}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="graduation" title="Belum ada kelas" text="Kelas akan muncul setelah admin menjadwalkan Anda sebagai pengajar." />
        )}
      </section>

      {/* ---------- Tren kehadiran & tugas ---------- */}
      <div className="dash-grid cols-2-1" style={{ marginTop: 20 }}>
        <ChartCard
          title="Tren kehadiran per pertemuan"
          subtitle={kelasAktifTren ? `${kelasAktifTren.nama_kelas} · ${kelasAktifTren.peserta} peserta terverifikasi` : 'Pertemuan yang sudah lewat'}
          icon="chart"
          action={
            kelasAdaSesi.length > 1 && (
              <select className="input input-plain select select-sm" value={kelasAktifTren?.id_kelas} onChange={(e) => setKelasTren(Number(e.target.value))} aria-label="Pilih kelas">
                {kelasAdaSesi.map((k) => <option key={k.id_kelas} value={k.id_kelas}>{k.nama_kelas}</option>)}
              </select>
            )
          }
          table={{ columns: ['Pertemuan', 'Kehadiran'], rows: dataTren.map((d) => [d.tip, d.value === null ? 'Belum dicatat' : `${d.value}%`]) }}
        >
          {dataTren.length ? (
            <LineChart data={dataTren} ambang={ambang} label="Tren kehadiran per pertemuan" />
          ) : (
            <EmptyState icon="chart" title="Belum ada pertemuan yang selesai" />
          )}
        </ChartCard>

        <section className="panel">
          <header className="panel-head">
            <div className="panel-title-wrap">
              <span className="icon-tile icon-tile-accent"><Icon name="clipboard" /></span>
              <div>
                <h2 className="panel-title">Perlu ditindaklanjuti</h2>
                <p className="panel-sub">{jumlahTugas ? `${jumlahTugas} hal` : 'Semua beres'}</p>
              </div>
            </div>
          </header>
          {jumlahTugas ? (
            <ul className="todo-list">
              {tugas.presensi_belum.slice(0, 4).map((p) => (
                <li key={`p${p.id_pertemuan}`}>
                  <span className="todo-icon"><Icon name="qr" size={15} /></span>
                  <div>
                    <strong><Link to={`/dashboard/dosen/kelas/${p.id_kelas}/presensi/${p.id_pertemuan}`}>Presensi belum dicatat</Link></strong>
                    <span>{p.nama_kelas} · P{p.pertemuan_ke} · {formatTanggal(p.tanggal, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  </div>
                </li>
              ))}
              {tugas.presensi_belum.length > 4 && <li className="todo-more">+{tugas.presensi_belum.length - 4} pertemuan lain belum dicatat presensinya</li>}
              {tugas.nilai_belum.map((n) => (
                <li key={`n${n.id_kelas}`}>
                  <span className="todo-icon"><Icon name="clipboard" size={15} /></span>
                  <div>
                    <strong><Link to={`/dashboard/dosen/kelas/${n.id_kelas}?tab=nilai`}>{n.belum} nilai belum diinput</Link></strong>
                    <span>{n.nama_kelas}</span>
                  </div>
                </li>
              ))}
              {berisiko.slice(0, 4).map((b) => (
                <li key={`b${b.id_pendaftaran}`}>
                  <span className="todo-icon is-warn"><Icon name="alert" size={15} /></span>
                  <div>
                    <strong>{b.nama} · hadir {b.kehadiran}%</strong>
                    <span>{b.nama_kelas} · {b.hadir}/{b.sesi} sesi · di bawah {ambang}%</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="checkCircle" title="Tidak ada tugas tertunda" />
          )}
        </section>
      </div>
    </>
  );
}

export default DosenDashboard;
