// Tab Kuesioner Evaluasi Pengajar di Ruang Kelas:
// - Peserta: mengisi penilaian skala Likert 1-5 & masukan anonim untuk setiap dosen pengajar kelas.
// - Dosen / Admin: melihat ringkasan skor & partisipasi kuesioner kelas serta tautan ke halaman analisis lengkap.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import Icon from '../ui/Icon.jsx';
import { EmptyState } from '../dashboard/Widgets.jsx';
import { Meter } from '../dashboard/Pelatihan.jsx';
import { formatTanggal } from '../../config/pelatihan.js';

const SKALA_LIKERT = [
  { skor: 1, label: 'Sangat Kurang' },
  { skor: 2, label: 'Kurang' },
  { skor: 3, label: 'Cukup' },
  { skor: 4, label: 'Baik' },
  { skor: 5, label: 'Sangat Baik' },
];

const BADGE_PERIODE = {
  dibuka: { label: 'Terbuka', badge: 'badge-success' },
  belum_dibuka: { label: 'Belum dibuka', badge: 'badge-warning' },
  ditutup: { label: 'Ditutup', badge: 'badge-muted' },
};

const fmtSkor = (n) => (n === null || n === undefined ? '—' : Number(n).toFixed(2).replace('.', ','));

function FormKuesionerPeserta({ idKelas, data, onTersimpan }) {
  const { periode, pertanyaan, pengajar, ringkasan } = data;
  const [aktifPengajarId, setAktifPengajarId] = useState(() => {
    const belum = pengajar.find((p) => !p.sudah_diisi);
    return (belum || pengajar[0])?.id_pengajar ?? null;
  });
  const [jawaban, setJawaban] = useState({});
  const [komentar, setKomentar] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const dosenAktif = pengajar.find((p) => p.id_pengajar === aktifPengajarId) || pengajar[0];

  useEffect(() => {
    if (!dosenAktif) return;
    setJawaban(dosenAktif.jawaban || {});
    setKomentar(dosenAktif.komentar || '');
  }, [dosenAktif]);

  if (pengajar.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          icon="award"
          title="Pengajar belum dijadwalkan"
          text="Kuesioner evaluasi dapat diisi setelah jadwal pengajar ditetapkan pada kelas ini."
        />
      </section>
    );
  }

  const semuaTerjawab = pertanyaan.every((q) => Number.isInteger(jawaban[q.id_pertanyaan]));
  const infoPeriode = BADGE_PERIODE[periode.status] || BADGE_PERIODE.dibuka;

  const pilihSkor = (idPertanyaan, skor) => {
    if (!periode.bisa_isi || sibuk) return;
    setJawaban((prev) => ({ ...prev, [idPertanyaan]: skor }));
  };

  const kirim = async (e) => {
    e.preventDefault();
    if (!dosenAktif || !semuaTerjawab) {
      toast.warning('Mohon pilih skor 1–5 untuk seluruh pertanyaan');
      return;
    }
    setSibuk(true);
    try {
      const payload = {
        id_pengajar: dosenAktif.id_pengajar,
        komentar,
        jawaban: pertanyaan.map((q) => ({
          id_pertanyaan: q.id_pertanyaan,
          skor: jawaban[q.id_pertanyaan],
        })),
      };
      const res = await api.post(`/ruang-kelas/${idKelas}/kuesioner`, payload);
      toast.success(res.data.message);
      onTersimpan();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kuesioner');
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Pemilih Dosen Pengajar */}
      <section className="panel">
        <header className="panel-head" style={{ marginBottom: pengajar.length > 1 ? 14 : 0 }}>
          <div className="panel-title-wrap">
            <span className="icon-tile"><Icon name="award" /></span>
            <div>
              <h2 className="panel-title">Kuesioner evaluasi dosen pengajar</h2>
              <p className="panel-sub">
                {ringkasan.sudah_diisi} dari {ringkasan.total_pengajar} dosen sudah Anda evaluasi · {periode.keterangan}
              </p>
            </div>
          </div>
          <span className={`badge ${infoPeriode.badge}`}>{infoPeriode.label}</span>
        </header>

        {pengajar.length > 1 && (
          <div className="nilai-kelas-grid" style={{ marginBottom: 0 }}>
            {pengajar.map((pg) => {
              const aktif = pg.id_pengajar === dosenAktif?.id_pengajar;
              return (
                <button
                  key={pg.id_pengajar}
                  type="button"
                  className={`nilai-kelas-card${aktif ? ' is-aktif' : ''}`}
                  onClick={() => setAktifPengajarId(pg.id_pengajar)}
                >
                  <div className="nilai-kelas-card-top">
                    <span className="nilai-kelas-card-eyebrow">{pg.jumlah_pertemuan} pertemuan</span>
                    <span className={`badge ${pg.sudah_diisi ? 'badge-success' : 'badge-warning'}`}>
                      {pg.sudah_diisi ? `★ ${fmtSkor(pg.rerata_skor)}` : 'Belum diisi'}
                    </span>
                  </div>
                  <strong>{pg.nama_lengkap}</strong>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Formulir Pertanyaan Skala 1-5 */}
      {dosenAktif && (
        <form className="panel" onSubmit={kirim}>
          <header className="panel-head">
            <div>
              <h3 className="panel-title">Evaluasi untuk {dosenAktif.nama_lengkap}</h3>
              <p className="panel-sub">
                Identitas Anda dirahasiakan (anonim). Pilih nilai 1 (Sangat Kurang) sampai 5 (Sangat Baik).
              </p>
            </div>
            {dosenAktif.sudah_diisi && (
              <span className="badge badge-success">
                Tersimpan {formatTanggal(dosenAktif.tanggal_isi)} (★ {fmtSkor(dosenAktif.rerata_skor)})
              </span>
            )}
          </header>

          <ol className="kuesioner-form-pertanyaan">
            {pertanyaan.map((q, idx) => {
              const terpilih = jawaban[q.id_pertanyaan];
              return (
                <li key={q.id_pertanyaan} className="kuesioner-form-item">
                  <div className="kuesioner-instrumen-judul">
                    <span className="ke-badge">{idx + 1}</span>
                    <strong>{q.teks_pertanyaan}</strong>
                  </div>
                  <div className="kuesioner-likert-group" role="radiogroup" aria-label={q.teks_pertanyaan}>
                    {SKALA_LIKERT.map((s) => {
                      const aktif = terpilih === s.skor;
                      return (
                        <button
                          key={s.skor}
                          type="button"
                          role="radio"
                          aria-checked={aktif}
                          className={`kuesioner-likert-btn${aktif ? ' is-selected' : ''}`}
                          onClick={() => pilihSkor(q.id_pertanyaan, s.skor)}
                          disabled={!periode.bisa_isi || sibuk}
                        >
                          <strong>★ {s.skor}</strong>
                          <small>{s.label}</small>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="field" style={{ marginBottom: 16 }}>
            <label className="field-label" htmlFor="komentar-kuesioner">
              Komentar, saran, atau masukan untuk dosen (opsional)
            </label>
            <textarea
              id="komentar-kuesioner"
              className="input textarea"
              rows={3}
              maxLength={1000}
              placeholder="Tuliskan kesan atau masukan membangun mengenai metode pengajaran dosen..."
              value={komentar}
              onChange={(e) => setKomentar(e.target.value)}
              disabled={!periode.bisa_isi || sibuk}
            />
            <span className="field-hint">{komentar.length}/1000 karakter · ditampilkan secara anonim kepada dosen</span>
          </div>

          {periode.bisa_isi && (
            <footer className="presensi-simpan">
              <span>
                {semuaTerjawab
                  ? 'Seluruh pertanyaan sudah diisi'
                  : 'Lengkapi seluruh butir pertanyaan sebelum menyimpan'}
              </span>
              <button type="submit" className="btn btn-primary btn-sm" disabled={sibuk || !semuaTerjawab}>
                <Icon name="check" size={15} />
                {sibuk ? 'Menyimpan...' : dosenAktif.sudah_diisi ? 'Perbarui evaluasi' : 'Kirim evaluasi'}
              </button>
            </footer>
          )}
        </form>
      )}
    </div>
  );
}

function RingkasanKuesionerPengajar({ idKelas, data, isDosen }) {
  const { periode, ringkasan, instrumen, komentar } = data;
  const infoPeriode = BADGE_PERIODE[periode.status] || BADGE_PERIODE.dibuka;

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-title-wrap">
          <span className="icon-tile"><Icon name="award" /></span>
          <div>
            <h2 className="panel-title">Hasil kuesioner evaluasi pengajar</h2>
            <p className="panel-sub">
              {ringkasan.total_responden} dari {ringkasan.total_peserta} peserta sudah mengisi ({ringkasan.partisipasi_persen ?? 0}%)
              {' · '}{periode.keterangan}
            </p>
          </div>
        </div>
        <div className="action-group">
          <span className={`badge ${infoPeriode.badge}`}>{infoPeriode.label}</span>
          {isDosen && (
            <Link to={`/dashboard/dosen/kuesioner/${idKelas}`} className="btn btn-primary btn-sm">
              <Icon name="chart" size={15} /> Analisis lengkap & CSV
            </Link>
          )}
        </div>
      </header>

      <div className="nilai-stat-strip">
        <div className="nilai-stat-box">
          <span>Rerata Skor Kelas Ini</span>
          <strong>{ringkasan.rerata_skor !== null ? `★ ${fmtSkor(ringkasan.rerata_skor)} / 5,00` : '—'}</strong>
          <small>{ringkasan.predikat?.label || 'Belum ada penilaian'}</small>
        </div>
        <div className="nilai-stat-box">
          <span>Tingkat Kepuasan</span>
          <strong>{ringkasan.persen_kepuasan !== null ? `${ringkasan.persen_kepuasan}%` : '—'}</strong>
          <small>Indeks kepuasan peserta</small>
        </div>
        <div className="nilai-stat-box">
          <span>Responden</span>
          <strong>{ringkasan.total_responden}/{ringkasan.total_peserta}</strong>
          <small>Partisipasi {ringkasan.partisipasi_persen ?? 0}%</small>
        </div>
        <div className="nilai-stat-box">
          <span>Masukan Tertulis</span>
          <strong>{ringkasan.jumlah_komentar}</strong>
          <small>Komentar anonim peserta</small>
        </div>
      </div>

      {ringkasan.total_responden === 0 ? (
        <EmptyState
          icon="clipboard"
          title="Belum ada peserta yang mengisi kuesioner"
          text="Hasil penilaian per instrumen dan masukan anonim peserta akan muncul di sini setelah peserta mengisi kuesioner."
        />
      ) : (
        <>
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
                    <span className="cell-sub">/ 5,00 ({q.persen_kepuasan ?? 0}%)</span>
                  </div>
                </div>
                <Meter value={q.persen_kepuasan ?? 0} max={100} label={q.teks_pertanyaan} />
              </li>
            ))}
          </ul>

          {komentar.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h3 className="panel-title" style={{ marginBottom: 10 }}>Masukan terbaru peserta (anonim)</h3>
              <div className="kuesioner-komentar-grid">
                {komentar.map((item) => (
                  <article key={item.id_kuesioner} className="kuesioner-komentar-card">
                    <header className="kuesioner-komentar-head">
                      <span className="avatar">P</span>
                      <div style={{ flex: 1 }}>
                        <strong>Peserta Pelatihan (Anonim)</strong>
                        <span>{formatTanggal(item.tanggal_isi)}</span>
                      </div>
                      {item.rerata_skor !== null && (
                        <span className="badge badge-success">★ {fmtSkor(item.rerata_skor)}</span>
                      )}
                    </header>
                    <p className="kuesioner-komentar-isi">“{item.komentar}”</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function KuesionerKelas({ idKelas, isDosen }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setGagal(false);
    try {
      const res = await api.get(`/ruang-kelas/${idKelas}/kuesioner`);
      setData(res.data.data);
    } catch {
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, [idKelas]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <p className="table-message">Memuat kuesioner evaluasi...</p>;
  if (gagal || !data) {
    return (
      <div className="table-message">
        <p>Gagal memuat kuesioner evaluasi.</p>
        <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
      </div>
    );
  }

  if (data.mode === 'peserta') {
    return <FormKuesionerPeserta idKelas={idKelas} data={data} onTersimpan={load} />;
  }
  return <RingkasanKuesionerPengajar idKelas={idKelas} data={data} isDosen={isDosen} />;
}
