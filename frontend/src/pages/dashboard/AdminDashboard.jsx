// Dashboard Pelatihan (Admin) - #69 — "pusat kendali" layanan pelatihan
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, firstName, greeting } from '../../components/dashboard/Widgets.jsx';
import {
  ChartCard, ColumnChart, HeatStrip, MeterBar, MeterList, SegmentedBar, Sparkline,
} from '../../components/dashboard/Charts.jsx';
import { JENIS_PELATIHAN, STATUS_KELAS, TIPE_KELAS, formatRupiah, formatTanggal, todayInput } from '../../config/pelatihan.js';

const IKON_PERHATIAN = { jadwal: 'calendar', kuota: 'users', pembayaran: 'wallet', selesai: 'clipboard', peserta: 'alert', verifikasi: 'wallet' };

// Tahapan pembayaran (ordinal: belum bayar -> lunas) memakai satu hue teal, terang -> gelap (tervalidasi)
const TAHAP = [
  { key: 'menunggu_pembayaran', label: 'Belum bayar', color: '#8bb8ab', ink: '#0b0b0b' },
  { key: 'menunggu_verifikasi', label: 'Menunggu verifikasi', color: '#5f9a8b' },
  { key: 'sebagian', label: 'Cicilan berjalan', color: '#3b6a62' },
  { key: 'lunas', label: 'Lunas', color: '#1f4640' },
];

const rupiahRingkas = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e9) return `Rp${(n / 1e9).toFixed(1).replace('.', ',')} M`;
  if (n >= 1e6) return `Rp${(n / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (n >= 1e3) return `Rp${Math.round(n / 1e3)} rb`;
  return `Rp${n}`;
};
const tglPendek = (iso) => formatTanggal(iso, { day: 'numeric', month: 'short' });

function Delta({ kini, lalu, satuan = '' }) {
  if (!lalu && !kini) return <span className="delta">Belum ada data</span>;
  if (!lalu) return <span className="delta delta-up"><Icon name="arrowRight" size={12} /> Baru bulan ini</span>;
  const pct = Math.round(((kini - lalu) / lalu) * 100);
  const naik = pct >= 0;
  return (
    <span className={`delta ${naik ? 'delta-up' : 'delta-down'}`}>
      {naik ? '▲' : '▼'} {Math.abs(pct)}%{satuan} vs bulan lalu
    </span>
  );
}

function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState(false);
  const [hariDipilih, setHariDipilih] = useState(todayInput());

  const load = useCallback(async () => {
    setGagal(false);
    try {
      const res = await api.get('/admin-pelatihan/ringkasan');
      setData(res.data.data);
    } catch {
      setGagal(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (gagal) {
    return (
      <div className="table-message">
        <p>Gagal memuat dashboard. Pastikan backend berjalan.</p>
        <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
      </div>
    );
  }
  if (!data) return <p className="table-message">Memuat dashboard...</p>;

  const { stats, kelas, berisiko, perhatian, ambang_ews: ambang, analitik: a, pembayaran_menunggu: buktiMenunggu = [] } = data;
  const pendKini = a.pendapatan[a.pendapatan.length - 1];
  const pendLalu = a.pendapatan[a.pendapatan.length - 2];
  const daftarMingguIni = a.tren_pendaftaran[a.tren_pendaftaran.length - 1]?.jumlah ?? 0;
  const pertemuan14 = a.kalender.reduce((n, d) => n + d.jumlah, 0);
  const jam14 = Math.round(a.kalender.reduce((n, d) => n + d.jam, 0) * 10) / 10;
  const hari = a.kalender.find((d) => d.tanggal === hariDipilih) ?? a.kalender[0];
  const kelasDenganKehadiran = kelas.filter((k) => k.kehadiran !== null);
  const kalimat = [
    `${stats.pertemuan_minggu_ini} pertemuan minggu ini di ${stats.kelas_aktif} kelas aktif`,
    stats.pembayaran_menunggu ? `${stats.pembayaran_menunggu} bukti bayar menunggu verifikasi` : null,
    stats.peserta_berisiko ? `${stats.peserta_berisiko} peserta berisiko tidak lulus` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      {/* ---------- Banner ---------- */}
      <section className="hero-band">
        <div className="hero-band-main">
          <p className="hero-band-eyebrow">Ruang kerja terpusat · Pelatihan</p>
          <h1>Selamat {greeting()}, {firstName(user.nama_lengkap)}.</h1>
          <p className="hero-band-lead">{kalimat}.</p>
          <div className="hero-band-actions">
            <Link to="/dashboard/admin/kelas" className="btn btn-light btn-sm"><Icon name="book" size={16} /> Kelola kelas</Link>
            <Link to="/dashboard/admin/pembayaran" className="btn btn-ghost-light btn-sm"><Icon name="wallet" size={16} /> Verifikasi pembayaran</Link>
          </div>
        </div>
        <div className="hero-figure-card">
          <p className="hero-figure-label">Pendapatan pelatihan · {pendKini.label}</p>
          <p className="hero-figure">{formatRupiah(pendKini.total)}</p>
          <Delta kini={pendKini.total} lalu={pendLalu?.total} />
          <div className="hero-figure-spark">
            <Sparkline
              values={a.pendapatan.map((p) => p.total)}
              labels={a.pendapatan.map((p) => p.label)}
              format={rupiahRingkas}
              width={220}
              height={44}
              label="Pendapatan 6 bulan terakhir"
            />
            <span>6 bulan terakhir</span>
          </div>
        </div>
      </section>

      {(stats.pembayaran_menunggu > 0 || stats.peserta_berisiko > 0) && (
        <div className="alert-strip" role="status">
          <Icon name="megaphone" size={18} />
          <span>
            {stats.pembayaran_menunggu > 0 && `${stats.pembayaran_menunggu} bukti pembayaran menunggu verifikasi`}
            {stats.pembayaran_menunggu > 0 && stats.peserta_berisiko > 0 && ' · '}
            {stats.peserta_berisiko > 0 && `${stats.peserta_berisiko} peserta kehadirannya di bawah ${ambang}%`}
          </span>
          {stats.pembayaran_menunggu > 0 && <Link to="/dashboard/admin/pembayaran">Tinjau <Icon name="arrowRight" size={16} /></Link>}
        </div>
      )}

      {/* ---------- KPI dengan mini-visual ---------- */}
      <div className="kpi-grid">
        <div className="kpi">
          <p className="kpi-label"><Icon name="users" size={15} /> Peserta aktif</p>
          <p className="kpi-value">{stats.peserta_aktif}</p>
          <Sparkline
            values={a.tren_pendaftaran.map((t) => t.jumlah)}
            labels={a.tren_pendaftaran.map((t) => `Minggu ${tglPendek(t.minggu)}`)}
            format={(v) => `${v} pendaftar`}
            label="Pendaftaran 8 minggu terakhir"
          />
          <p className="kpi-hint">{daftarMingguIni} pendaftar baru minggu ini · {stats.menunggu_pembayaran} belum bayar</p>
        </div>
        <div className="kpi">
          <p className="kpi-label"><Icon name="grid" size={15} /> Okupansi kuota</p>
          <p className="kpi-value">{a.okupansi.persen ?? 0}%</p>
          <MeterBar value={a.okupansi.terisi} max={a.okupansi.kuota || 1} label="Okupansi kuota" />
          <p className="kpi-hint">{a.okupansi.terisi} dari {a.okupansi.kuota} kursi terisi</p>
        </div>
        <div className="kpi">
          <p className="kpi-label"><Icon name="chart" size={15} /> Rerata kehadiran</p>
          <p className="kpi-value">{stats.rerata_kehadiran === null ? '—' : `${stats.rerata_kehadiran}%`}</p>
          <Sparkline
            values={a.tren_kehadiran.map((t) => t.persen)}
            labels={a.tren_kehadiran.map((t) => `Minggu ${tglPendek(t.minggu)}`)}
            format={(v) => `${v}%`}
            label="Kehadiran 8 minggu terakhir"
          />
          <p className="kpi-hint">Ambang lulus {ambang}% · {stats.peserta_berisiko} peserta berisiko</p>
        </div>
        <div className="kpi">
          <p className="kpi-label"><Icon name="calendar" size={15} /> 14 hari ke depan</p>
          <p className="kpi-value">{pertemuan14}</p>
          <p className="kpi-sub">pertemuan · {String(jam14).replace('.', ',')} jam mengajar</p>
          <p className="kpi-hint">{stats.pertemuan_minggu_ini} pertemuan minggu ini</p>
        </div>
      </div>

      {/* ---------- Tren & pembayaran ---------- */}
      <div className="dash-grid cols-2-1">
        <ChartCard
          title="Pendaftaran baru per minggu"
          subtitle="8 minggu terakhir · minggu ini disorot"
          icon="chart"
          table={{ columns: ['Minggu mulai', 'Pendaftar'], rows: a.tren_pendaftaran.map((t) => [formatTanggal(t.minggu), t.jumlah]) }}
        >
          <ColumnChart
            data={a.tren_pendaftaran.map((t) => ({ label: tglPendek(t.minggu), value: t.jumlah, tip: `Minggu mulai ${formatTanggal(t.minggu)}` }))}
            format={(v) => `${v}`}
            label="Grafik pendaftaran baru per minggu"
          />
        </ChartCard>

        <ChartCard
          title="Tahapan pembayaran"
          subtitle="Tagihan peserta di kelas aktif"
          icon="wallet"
          table={{ columns: ['Tahap', 'Peserta', 'Total tagihan'], rows: TAHAP.map((t) => { const s = a.tahap_pembayaran.find((x) => x.status === t.key); return [t.label, s.jumlah, formatRupiah(s.total)]; }) }}
        >
          <SegmentedBar
            label="Tahapan pembayaran"
            format={(v) => `${v} peserta`}
            parts={TAHAP.map((t) => {
              const s = a.tahap_pembayaran.find((x) => x.status === t.key);
              return { key: t.key, label: t.label, value: s.jumlah, color: t.color, ink: t.ink, detail: formatRupiah(s.total) };
            })}
          />
          {buktiMenunggu.length > 0 && (
            <Link to="/dashboard/admin/pembayaran" className="btn btn-soft btn-sm btn-block" style={{ marginTop: 14 }}>
              <Icon name="checkCircle" size={16} /> Verifikasi {buktiMenunggu.length} bukti bayar
            </Link>
          )}
        </ChartCard>
      </div>

      {/* ---------- Kehadiran & kepadatan jadwal ---------- */}
      <div className="dash-grid cols-2">
        <ChartCard
          title="Kehadiran per kelas"
          subtitle={`Garis kuning = ambang lulus ${ambang}%`}
          icon="users"
          table={{ columns: ['Kelas', 'Kehadiran', 'Pertemuan selesai'], rows: kelas.map((k) => [k.nama_kelas, k.kehadiran === null ? '—' : `${k.kehadiran}%`, `${k.pertemuan_selesai}/${k.jumlah_pertemuan}`]) }}
        >
          <MeterList
            ambang={ambang}
            emptyText="Kehadiran muncul setelah ada sesi presensi yang dibuka."
            rows={(kelasDenganKehadiran.length ? kelasDenganKehadiran : kelas).slice(0, 6).map((k) => ({
              key: k.id_kelas,
              label: k.nama_kelas,
              value: k.kehadiran,
              sub: `${k.peserta_terverifikasi} peserta · ${k.pertemuan_selesai}/${k.jumlah_pertemuan} pertemuan selesai`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Kepadatan jadwal 14 hari"
          subtitle="Klik tanggal untuk melihat pertemuannya"
          icon="calendar"
          table={{ columns: ['Tanggal', 'Pertemuan', 'Jam'], rows: a.kalender.map((d) => [`${d.hari}, ${formatTanggal(d.tanggal)}`, d.jumlah, d.jam]) }}
        >
          <HeatStrip
            days={a.kalender.map((d) => ({
              ...d,
              labelTanggal: formatTanggal(d.tanggal),
              tanggalPendek: Number(d.tanggal.slice(8)),
              isToday: d.tanggal === todayInput(),
              ringkas: d.pertemuan.slice(0, 3).map((p) => `${p.jam_mulai} ${p.nama_kelas}`),
            }))}
            selected={hari?.tanggal}
            onSelect={setHariDipilih}
          />
          <div className="heat-detail">
            <p className="field-label">{hari ? `${hari.hari}, ${formatTanggal(hari.tanggal)}` : ''}</p>
            {hari?.pertemuan.length ? (
              <ul>
                {hari.pertemuan.map((p, i) => (
                  <li key={i}>
                    <strong>{p.jam_mulai}–{p.jam_selesai}</strong>
                    <span>{p.nama_kelas}</span>
                    <small>{[p.ruang, p.pengajar].filter(Boolean).join(' · ')}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-note">Tidak ada pertemuan.</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* ---------- Kelas & tindak lanjut ---------- */}
      <div className="dash-grid cols-2-1">
        <section className="panel">
          <header className="panel-head">
            <div className="panel-title-wrap">
              <span className="icon-tile"><Icon name="book" /></span>
              <div>
                <h2 className="panel-title">Kelas pelatihan aktif</h2>
                <p className="panel-sub">{stats.kelas_aktif} kelas · {stats.kelas_berjalan} berjalan</p>
              </div>
            </div>
            <Link to="/dashboard/admin/kelas" className="chip-btn">Kelola <Icon name="arrowRight" size={14} /></Link>
          </header>
          {kelas.length ? (
            <div className="table-wrap table-wrap-flush-x">
              <table className="table">
                <thead>
                  <tr><th>Kelas</th><th>Kursi</th><th>Jadwal</th><th>Pengajar</th><th className="actions"><span className="sr-only">Aksi</span></th></tr>
                </thead>
                <tbody>
                  {kelas.map((k) => {
                    const terisi = k.peserta_terverifikasi + k.peserta_menunggu;
                    return (
                      <tr key={k.id_kelas}>
                        <td>
                          <p className="cell-title">{k.nama_kelas}</p>
                          <p className="cell-sub">
                            {JENIS_PELATIHAN[k.jenis_pelatihan]} · {TIPE_KELAS[k.tipe_kelas]}{' '}
                            <span className={`badge ${STATUS_KELAS[k.status].badge}`}>{STATUS_KELAS[k.status].label}</span>
                          </p>
                        </td>
                        <td className="nowrap" style={{ minWidth: 110 }}>
                          <p>{terisi}/{k.kuota_maks}{k.peserta_menunggu > 0 && <span className="cell-sub"> ({k.peserta_menunggu} belum bayar)</span>}</p>
                          <MeterBar value={terisi} max={k.kuota_maks} label={`Kursi ${k.nama_kelas}`} />
                        </td>
                        <td className="nowrap">
                          <p className={k.pertemuan_terjadwal < k.jumlah_pertemuan ? 'text-warning' : ''}>{k.pertemuan_terjadwal}/{k.jumlah_pertemuan} terjadwal</p>
                          <p className="cell-sub">{k.pertemuan_selesai} selesai</p>
                        </td>
                        <td>{k.pengajar.length ? k.pengajar.join(', ') : <span className="cell-sub">Belum ada</span>}</td>
                        <td className="actions">
                          <Link to={`/dashboard/admin/kelas/${k.id_kelas}/jadwal`} className="icon-action" title="Atur jadwal & pengajar" aria-label={`Atur jadwal ${k.nama_kelas}`}>
                            <Icon name="calendar" size={17} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="book" title="Belum ada kelas aktif" text='Buat kelas baru di menu "Kelas pelatihan".' />
          )}
        </section>

        <div className="stack">
          <section className="panel">
            <header className="panel-head">
              <div className="panel-title-wrap">
                <span className="icon-tile icon-tile-accent"><Icon name="alert" /></span>
                <div>
                  <h2 className="panel-title">Perlu tindak lanjut</h2>
                  <p className="panel-sub">{perhatian.length ? `${perhatian.length} hal` : 'Semua beres'}</p>
                </div>
              </div>
            </header>
            {perhatian.length ? (
              <ul className="perhatian-list">
                {perhatian.map((p, i) => {
                  const href = p.jenis === 'verifikasi' ? '/dashboard/admin/pembayaran' : p.id_kelas ? `/dashboard/admin/kelas/${p.id_kelas}/jadwal` : null;
                  return (
                    <li key={i}>
                      <span className="icon-tile icon-tile-sm icon-tile-accent"><Icon name={IKON_PERHATIAN[p.jenis] ?? 'alert'} size={16} /></span>
                      <span className="perhatian-text">{p.pesan}</span>
                      {href && <Link to={href} className="icon-action" aria-label="Buka"><Icon name="arrowRight" size={15} /></Link>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon="checkCircle" title="Tidak ada yang perlu ditindaklanjuti" />
            )}
          </section>

          <section className="panel">
            <header className="panel-head">
              <div className="panel-title-wrap">
                <span className="icon-tile"><Icon name="users" /></span>
                <div>
                  <h2 className="panel-title">Peringatan dini kehadiran</h2>
                  <p className="panel-sub">Peserta di bawah {ambang}%</p>
                </div>
              </div>
              <span className="badge badge-muted">EWS</span>
            </header>
            {berisiko.length ? (
              <ul className="ews-list">
                {berisiko.slice(0, 6).map((b) => (
                  <li key={b.id_pendaftaran}>
                    <div>
                      <strong>{b.nama}</strong>
                      <span>{b.nama_kelas} · hadir {b.hadir}/{b.sesi} sesi</span>
                    </div>
                    <span className="badge badge-danger"><Icon name="alert" size={12} /> {b.kehadiran}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="users" title="Tidak ada peserta berisiko" />
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default AdminDashboard;
