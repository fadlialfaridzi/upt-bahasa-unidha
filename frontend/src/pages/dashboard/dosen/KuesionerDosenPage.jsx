// Kuesioner Evaluasi Pengajar (Dosen): rekapitulasi skor instrumen, distribusi penilaian 1-5,
// perbandingan antar kelas, dan daftar masukan/komentar anonim dari peserta pelatihan.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { Meter } from '../../../components/dashboard/Pelatihan.jsx';
import { JENIS_PELATIHAN, STATUS_KELAS, TIPE_KELAS, formatTanggal } from '../../../config/pelatihan.js';

const LABEL_SKALA = [
  { skor: 5, label: 'Sangat Baik (5)', warna: 'var(--success)' },
  { skor: 4, label: 'Baik (4)', warna: '#2d8a6e' },
  { skor: 3, label: 'Cukup (3)', warna: '#d9b400' },
  { skor: 2, label: 'Kurang (2)', warna: 'var(--accent-500)' },
  { skor: 1, label: 'Sangat Kurang (1)', warna: 'var(--danger)' },
];

const BADGE_PREDIKAT = {
  sangat_baik: 'badge-success',
  baik: 'badge-accent',
  cukup: 'badge-warning',
  kurang: 'badge-danger',
  belum: 'badge-muted',
};

const BADGE_PERIODE = {
  dibuka: { label: 'Periode dibuka', badge: 'badge-success' },
  belum_dibuka: { label: 'Belum dibuka', badge: 'badge-warning' },
  ditutup: { label: 'Periode ditutup', badge: 'badge-muted' },
};

const fmtSkor = (n) => (n === null || n === undefined ? '—' : Number(n).toFixed(2).replace('.', ','));

function BintangRating({ skor }) {
  const nilai = Number(skor) || 0;
  const penuh = Math.round(nilai);
  return (
    <span className="kuesioner-bintang" aria-label={`Skor ${fmtSkor(skor)} dari 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= penuh ? 'is-isi' : 'is-kosong'}>★</span>
      ))}
    </span>
  );
}

function KuesionerDosenPage() {
  const { idKelas } = useParams();
  const navigate = useNavigate();
  const aktifId = idKelas ? Number(idKelas) : null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [cariKomentar, setCariKomentar] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setGagal(false);
    try {
      const params = aktifId ? { idKelas: aktifId } : {};
      const res = await api.get('/dosen/kuesioner', { params });
      setData(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat hasil kuesioner evaluasi');
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, [aktifId]);

  useEffect(() => {
    load();
  }, [load]);

  const komentarTampil = useMemo(() => {
    if (!data) return [];
    const q = cariKomentar.trim().toLowerCase();
    if (!q) return data.komentar;
    return data.komentar.filter(
      (k) =>
        k.komentar.toLowerCase().includes(q) ||
        (k.nama_kelas && k.nama_kelas.toLowerCase().includes(q))
    );
  }, [data, cariKomentar]);

  const pilihKelas = (id) => {
    if (id === null) navigate('/dashboard/dosen/kuesioner');
    else navigate(`/dashboard/dosen/kuesioner/${id}`);
  };

  const unduhCsv = () => {
    if (!data) return;
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lingkup = data.kelas_aktif ? data.kelas_aktif.nama_kelas : 'Semua Kelas yang Diampu';

    const barisInstrumen = [
      ['REKAPITULASI KUESIONER EVALUASI DOSEN', lingkup],
      ['Total Responden', `${data.ringkasan.total_responden} dari ${data.ringkasan.total_peserta} peserta (${data.ringkasan.partisipasi_persen ?? 0}%)`],
      ['Rerata Skor Keseluruhan', `${data.ringkasan.rerata_skor ?? '-'} / 5.00 (${data.ringkasan.predikat?.label || '-'})`],
      [],
      ['No', 'Instrumen Pertanyaan', 'Responden', 'Rerata Skor (1-5)', 'Kepuasan (%)', 'Predikat', 'Skor 5', 'Skor 4', 'Skor 3', 'Skor 2', 'Skor 1'],
      ...data.instrumen.map((q, idx) => [
        idx + 1,
        q.teks_pertanyaan,
        q.jumlah_jawaban,
        q.rata_rata ?? '-',
        q.persen_kepuasan !== null ? `${q.persen_kepuasan}%` : '-',
        q.predikat?.label || '-',
        q.distribusi[5] || 0,
        q.distribusi[4] || 0,
        q.distribusi[3] || 0,
        q.distribusi[2] || 0,
        q.distribusi[1] || 0,
      ]),
      [],
      ['DAFTAR MASUKAN & KOMENTAR PESERTA (ANONIM)'],
      ['No', 'Kelas', 'Tanggal Isi', 'Rerata Skor Kuesioner', 'Komentar / Masukan'],
      ...data.komentar.map((k, idx) => [
        idx + 1,
        k.nama_kelas,
        formatTanggal(k.tanggal_isi),
        k.rerata_skor ?? '-',
        k.komentar,
      ]),
    ];

    const csv = `\uFEFF${barisInstrumen.map((r) => r.map(esc).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (data.kelas_aktif ? data.kelas_aktif.nama_kelas : 'semua-kelas')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    a.download = `kuesioner-evaluasi-dosen-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return <p className="table-message">Memuat hasil kuesioner evaluasi...</p>;
  }

  if (gagal && !data) {
    return (
      <div className="table-message">
        <p>Gagal memuat halaman kuesioner evaluasi dosen.</p>
        <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
      </div>
    );
  }

  const { ringkasan, kelas, kelas_aktif: kelasAktif, instrumen, distribusi } = data;
  const totalDistribusi = Object.values(distribusi).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        eyebrow="Dosen / Kuesioner evaluasi"
        title="Kuesioner evaluasi pengajar"
        subtitle="Rekapitulasi penilaian dan masukan anonim dari peserta pelatihan terhadap pengajaran Anda (skala Likert 1–5)."
        action={
          <div className="action-group">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={unduhCsv}
              disabled={ringkasan.total_responden === 0}
            >
              <Icon name="download" size={15} /> Unduh CSV
            </button>
            {kelasAktif && (
              <Link to={`/dashboard/dosen/kelas/${kelasAktif.id_kelas}`} className="btn btn-soft btn-sm">
                <Icon name="graduation" size={15} /> Ruang kelas
              </Link>
            )}
          </div>
        }
      />

      {kelas.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon="award"
            title="Belum ada kelas yang diampu"
            text="Hasil kuesioner evaluasi akan muncul setelah Anda dijadwalkan mengajar dan peserta mengisi kuesioner."
          />
        </section>
      ) : (
        <>
          {/* Pemilih Kelas: Semua Kelas + Kartu Per Kelas */}
          <div className="nilai-kelas-grid" role="tablist" aria-label="Filter kelas kuesioner">
            <button
              type="button"
              role="tab"
              aria-selected={aktifId === null}
              className={`nilai-kelas-card${aktifId === null ? ' is-aktif' : ''}`}
              onClick={() => pilihKelas(null)}
            >
              <div className="nilai-kelas-card-top">
                <span className="nilai-kelas-card-eyebrow">Rekapitulasi Gabungan</span>
                <span className="badge badge-accent">{kelas.length} kelas</span>
              </div>
              <strong>Semua kelas yang saya ampu</strong>
              <div className="nilai-kelas-card-meta">
                <span>
                  Total responden: <strong>{kelas.reduce((n, k) => n + k.responden, 0)}</strong>/{kelas.reduce((n, k) => n + k.peserta, 0)}
                </span>
                <span>{kelas.reduce((n, k) => n + k.jumlah_komentar, 0)} masukan</span>
              </div>
            </button>

            {kelas.map((k) => {
              const aktif = k.id_kelas === aktifId;
              const statusKelas = STATUS_KELAS[k.status];
              const infoPeriode = BADGE_PERIODE[k.periode?.status] || BADGE_PERIODE.dibuka;
              return (
                <button
                  key={k.id_kelas}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  className={`nilai-kelas-card${aktif ? ' is-aktif' : ''}`}
                  onClick={() => pilihKelas(k.id_kelas)}
                >
                  <div className="nilai-kelas-card-top">
                    <span className="nilai-kelas-card-eyebrow">
                      {JENIS_PELATIHAN[k.jenis_pelatihan]} · {TIPE_KELAS[k.tipe_kelas]}
                    </span>
                    <span className={`badge ${statusKelas?.badge || 'badge-muted'}`}>
                      {statusKelas?.label || k.status}
                    </span>
                  </div>
                  <strong>{k.nama_kelas}</strong>
                  <Meter
                    value={k.responden}
                    max={k.peserta || 1}
                    label={`Partisipasi kuesioner ${k.nama_kelas}`}
                  />
                  <div className="nilai-kelas-card-meta">
                    <span>{k.responden}/{k.peserta} mengisi ({k.partisipasi_persen ?? 0}%)</span>
                    {k.rerata_skor !== null ? (
                      <span className="kuesioner-skor-chip">★ {fmtSkor(k.rerata_skor)}</span>
                    ) : (
                      <span className={`badge ${infoPeriode.badge}`} style={{ fontSize: '0.68rem' }}>
                        {infoPeriode.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Kartu Ringkasan Utama */}
          <div className="nilai-stat-strip">
            <div className="nilai-stat-box">
              <span>Indeks Evaluasi Rata-rata</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <strong>{ringkasan.rerata_skor !== null ? `${fmtSkor(ringkasan.rerata_skor)} / 5,00` : '—'}</strong>
                {ringkasan.rerata_skor !== null && (
                  <span className={`badge ${BADGE_PREDIKAT[ringkasan.predikat?.kode] || 'badge-muted'}`}>
                    {ringkasan.predikat?.label}
                  </span>
                )}
              </div>
              <small>
                {ringkasan.rerata_skor !== null ? (
                  <BintangRating skor={ringkasan.rerata_skor} />
                ) : (
                  'Menunggu pengisian kuesioner peserta'
                )}
              </small>
            </div>

            <div className="nilai-stat-box">
              <span>Tingkat Kepuasan</span>
              <strong>{ringkasan.persen_kepuasan !== null ? `${ringkasan.persen_kepuasan}%` : '—'}</strong>
              <small>Dari {ringkasan.total_jawaban_item} butir penilaian</small>
            </div>

            <div className="nilai-stat-box">
              <span>Partisipasi Responden</span>
              <strong>
                {ringkasan.total_responden}/{ringkasan.total_peserta}{' '}
                {ringkasan.partisipasi_persen !== null && (
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)' }}>
                    ({ringkasan.partisipasi_persen}%)
                  </span>
                )}
              </strong>
              <small>{ringkasan.belum_mengisi} peserta belum mengisi</small>
            </div>

            <div className="nilai-stat-box">
              <span>Komentar & Masukan</span>
              <strong>{ringkasan.jumlah_komentar}</strong>
              <small>
                {kelasAktif
                  ? kelasAktif.periode?.keterangan
                  : `Dari ${ringkasan.jumlah_kelas} kelas yang diampu`}
              </small>
            </div>
          </div>

          {ringkasan.total_responden === 0 ? (
            <section className="panel">
              <EmptyState
                icon="clipboard"
                title={kelasAktif ? `Belum ada responden di ${kelasAktif.nama_kelas}` : 'Belum ada peserta yang mengisi kuesioner'}
                text="Peserta terverifikasi dapat mengisi kuesioner evaluasi pengajar melalui tab Kuesioner di Ruang Kelas masing-masing."
              />
            </section>
          ) : (
            <div className="dash-grid cols-2-1" style={{ alignItems: 'start' }}>
              {/* Panel Kiri: Skor per Instrumen Pertanyaan */}
              <section className="panel">
                <header className="panel-head">
                  <div className="panel-title-wrap">
                    <span className="icon-tile"><Icon name="clipboard" /></span>
                    <div>
                      <h2 className="panel-title">Skor per instrumen pertanyaan</h2>
                      <p className="panel-sub">
                        {kelasAktif ? kelasAktif.nama_kelas : `Gabungan ${ringkasan.jumlah_kelas} kelas`} · {ringkasan.total_responden} responden
                      </p>
                    </div>
                  </div>
                </header>

                <ul className="kuesioner-instrumen-list">
                  {instrumen.map((q, idx) => (
                    <li key={q.id_pertanyaan} className="kuesioner-instrumen-item">
                      <div className="kuesioner-instrumen-head">
                        <div className="kuesioner-instrumen-judul">
                          <span className="ke-badge">{idx + 1}</span>
                          <strong>{q.teks_pertanyaan}</strong>
                        </div>
                        <div className="kuesioner-instrumen-angka">
                          <strong>{fmtSkor(q.rata_rata)}</strong>
                          <span className="cell-sub">/ 5,00</span>
                          {q.rata_rata !== null && (
                            <span className={`badge ${BADGE_PREDIKAT[q.predikat?.kode] || 'badge-muted'}`}>
                              {q.predikat?.label}
                            </span>
                          )}
                        </div>
                      </div>

                      <Meter
                        value={q.persen_kepuasan ?? 0}
                        max={100}
                        tone={q.rata_rata !== null && q.rata_rata < 3 ? 'danger' : 'brand'}
                        label={q.teks_pertanyaan}
                      />

                      <div className="kuesioner-skala-chips">
                        {LABEL_SKALA.map((s) => {
                          const jml = q.distribusi[s.skor] || 0;
                          return (
                            <span key={s.skor} className={`kuesioner-skala-chip${jml > 0 ? ' is-ada' : ''}`}>
                              ★ {s.skor}: <strong>{jml}</strong>
                            </span>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Panel Kanan: Distribusi Skor 1..5 */}
              <section className="panel">
                <header className="panel-head">
                  <div className="panel-title-wrap">
                    <span className="icon-tile icon-tile-accent"><Icon name="chart" /></span>
                    <div>
                      <h2 className="panel-title">Distribusi penilaian</h2>
                      <p className="panel-sub">{totalDistribusi} total jawaban skala 1–5</p>
                    </div>
                  </div>
                </header>

                <ul className="kuesioner-distribusi-list">
                  {LABEL_SKALA.map((s) => {
                    const jml = distribusi[s.skor] || 0;
                    const pct = totalDistribusi > 0 ? Math.round((jml / totalDistribusi) * 100) : 0;
                    return (
                      <li key={s.skor} className="kuesioner-distribusi-row">
                        <div className="kuesioner-distribusi-head">
                          <span>{s.label}</span>
                          <strong>{jml} ({pct}%)</strong>
                        </div>
                        <div className="viz-meter">
                          <span style={{ width: `${pct}%`, background: s.warna }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}

          {/* Panel Bawah: Daftar Komentar & Masukan Peserta (Anonim) */}
          <section className="panel" style={{ marginTop: 20 }}>
            <header className="panel-head">
              <div className="panel-title-wrap">
                <span className="icon-tile"><Icon name="megaphone" /></span>
                <div>
                  <h2 className="panel-title">Masukan & komentar peserta (anonim)</h2>
                  <p className="panel-sub">
                    Identitas responden dirahasiakan untuk menjaga objektivitas evaluasi pengajaran.
                  </p>
                </div>
              </div>
              {data.komentar.length > 0 && (
                <div className="input-wrap" style={{ minWidth: 230, maxWidth: 300 }}>
                  <span className="input-icon"><Icon name="search" size={15} /></span>
                  <input
                    type="text"
                    className="input"
                    placeholder="Cari isi masukan atau kelas..."
                    value={cariKomentar}
                    onChange={(e) => setCariKomentar(e.target.value)}
                    aria-label="Cari komentar"
                  />
                </div>
              )}
            </header>

            {data.komentar.length === 0 ? (
              <EmptyState
                icon="megaphone"
                title="Belum ada komentar tertulis"
                text="Komentar atau saran yang ditulis peserta saat mengisi kuesioner akan tampil di sini."
              />
            ) : komentarTampil.length === 0 ? (
              <EmptyState
                icon="search"
                title="Tidak ada komentar yang cocok"
                text="Coba ubah kata kunci pencarian."
              />
            ) : (
              <div className="kuesioner-komentar-grid">
                {komentarTampil.map((item) => (
                  <article key={item.id_kuesioner} className="kuesioner-komentar-card">
                    <header className="kuesioner-komentar-head">
                      <span className="avatar">P</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>Peserta Pelatihan (Anonim)</strong>
                        <span>
                          {item.nama_kelas} · {formatTanggal(item.tanggal_isi)}
                        </span>
                      </div>
                      {item.rerata_skor !== null && (
                        <span className="badge badge-success">★ {fmtSkor(item.rerata_skor)}</span>
                      )}
                    </header>
                    <p className="kuesioner-komentar-isi">“{item.komentar}”</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default KuesionerDosenPage;
