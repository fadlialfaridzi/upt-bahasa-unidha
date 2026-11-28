// Manajemen Instrumen Pertanyaan & Monitoring Kuesioner Pelatihan (Admin UPT)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { Meter } from '../../../components/dashboard/Pelatihan.jsx';
import { JENIS_PELATIHAN, STATUS_KELAS, TIPE_KELAS } from '../../../config/pelatihan.js';

const SKALA_LIKERT = [
  { skor: 1, label: 'Sangat Kurang' },
  { skor: 2, label: 'Kurang' },
  { skor: 3, label: 'Cukup' },
  { skor: 4, label: 'Baik' },
  { skor: 5, label: 'Sangat Baik' },
];

const TEMPLATE_PERTANYAAN = [
  'Penguasaan dan kedalaman materi pembelajaran oleh dosen pengajar',
  'Kejelasan metode penyampaian dan kemudahan materi untuk dipahami',
  'Ketepatan waktu, kedisiplinan, dan keteraturan pelaksanaan perkuliahan',
  'Kemampuan dosen dalam membangun interaksi, diskusi, dan motivasi belajar peserta',
  'Kesesuaian materi latihan/tugas dengan tujuan pelatihan bahasa',
  'Ketersediaan dosen dalam memberikan umpan balik atas pertanyaan atau kesulitan peserta',
  'Penggunaan media dan bahan ajar yang membantu pemahaman materi pelatihan',
];

const BADGE_PREDIKAT = {
  sangat_baik: 'badge-success',
  baik: 'badge-accent',
  cukup: 'badge-warning',
  kurang: 'badge-danger',
  belum: 'badge-muted',
};

const BADGE_PERIODE = {
  dibuka: { label: 'Terbuka', badge: 'badge-success' },
  belum_dibuka: { label: 'Belum dibuka', badge: 'badge-warning' },
  ditutup: { label: 'Ditutup', badge: 'badge-muted' },
};

const fmtSkor = (n) => (n === null || n === undefined ? '—' : Number(n).toFixed(2).replace('.', ','));

function PertanyaanFormModal({ target, urutanDefault, existingTexts, onClose, onSaved }) {
  const isEdit = Boolean(target && target.id_pertanyaan);
  const [teks, setTeks] = useState(isEdit ? target.teks_pertanyaan : '');
  const [urutan, setUrutan] = useState(isEdit ? target.urutan : urutanDefault);
  const [aktif, setAktif] = useState(isEdit ? target.aktif : true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const saranTersedia = useMemo(
    () => TEMPLATE_PERTANYAAN.filter((t) => !existingTexts.has(t.toLowerCase())),
    [existingTexts]
  );

  const submit = async (e) => {
    e.preventDefault();
    const bersih = teks.replace(/\s+/g, ' ').trim();
    if (bersih.length < 5 || bersih.length > 255) {
      setError('Teks pertanyaan harus 5–255 karakter');
      return;
    }
    const noUrut = Number(urutan);
    if (!Number.isInteger(noUrut) || noUrut < 1 || noUrut > 100) {
      setError('Nomor urutan harus bilangan bulat 1–100');
      return;
    }

    setSaving(true);
    try {
      const payload = { teks_pertanyaan: bersih, urutan: noUrut, aktif };
      const res = isEdit
        ? await api.put(`/admin-pelatihan/kuesioner/${target.id_pertanyaan}`, payload)
        : await api.post('/admin-pelatihan/kuesioner', payload);
      toast.success(res.data.message);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan pertanyaan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Ubah pertanyaan kuesioner' : 'Tambah pertanyaan kuesioner'}
      subtitle="Pertanyaan aktif akan ditampilkan dengan skala Likert 1–5 pada kuesioner evaluasi dosen di Ruang Kelas mahasiswa."
      onClose={onClose}
      busy={saving}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="form-pertanyaan-kuesioner" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Tambah pertanyaan'}
          </button>
        </>
      }
    >
      <form id="form-pertanyaan-kuesioner" className="form-grid" onSubmit={submit} noValidate>
        <div className="field field-full">
          <label className="field-label" htmlFor="teks-pertanyaan">Teks instrumen pertanyaan</label>
          <textarea
            id="teks-pertanyaan"
            className="input textarea"
            rows={3}
            maxLength={255}
            placeholder="Contoh: Kemampuan dosen dalam menyampaikan materi pelatihan secara jelas dan sistematis"
            value={teks}
            onChange={(e) => { setTeks(e.target.value); setError(''); }}
            autoFocus
            disabled={saving}
          />
          {error ? (
            <span className="field-error">{error}</span>
          ) : (
            <span className="field-hint">{teks.length}/255 karakter</span>
          )}
        </div>

        {!isEdit && saranTersedia.length > 0 && (
          <div className="field field-full">
            <span className="field-label">Contoh instrumen cepat (klik untuk mengisi)</span>
            <div style={{ display: 'grid', gap: 6 }}>
              {saranTersedia.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="preset-btn"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => { setTeks(s); setError(''); }}
                  disabled={saving}
                >
                  <Icon name="plus" size={14} /> <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="urutan-pertanyaan">Nomor urutan tampil</label>
          <input
            id="urutan-pertanyaan"
            type="number"
            min="1"
            max="100"
            className="input input-plain"
            value={urutan}
            onChange={(e) => setUrutan(e.target.value)}
            disabled={saving}
          />
          <span className="field-hint">Urutan dari kecil ke besar</span>
        </div>

        <div className="field">
          <span className="field-label">Status tampilan</span>
          <div className="segmented" role="radiogroup" aria-label="Status pertanyaan">
            <label className={aktif ? 'active' : ''}>
              <input
                type="radio"
                name="status_aktif"
                checked={aktif}
                onChange={() => setAktif(true)}
                disabled={saving}
              />
              Aktif (Tampil)
            </label>
            <label className={!aktif ? 'active' : ''}>
              <input
                type="radio"
                name="status_aktif"
                checked={!aktif}
                onChange={() => setAktif(false)}
                disabled={saving}
              />
              Nonaktif (Arsip)
            </label>
          </div>
          <span className="field-hint">Hanya pertanyaan aktif yang diisi peserta</span>
        </div>
      </form>
    </Modal>
  );
}

function PratinjauMahasiswaModal({ pertanyaanAktif, onClose }) {
  const [contohSkor, setContohSkor] = useState({});

  return (
    <Modal
      title="Pratinjau Kuesioner Mahasiswa"
      subtitle="Tampilan formulir evaluasi dosen yang dilihat oleh mahasiswa pada tab Kuesioner di Ruang Kelas."
      onClose={onClose}
      size="lg"
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Tutup pratinjau
        </button>
      }
    >
      {pertanyaanAktif.length === 0 ? (
        <EmptyState
          icon="alert"
          title="Belum ada pertanyaan aktif"
          text="Aktifkan minimal satu pertanyaan agar formulir kuesioner dapat diisi oleh mahasiswa."
        />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <ol className="kuesioner-form-pertanyaan" style={{ marginBottom: 0 }}>
            {pertanyaanAktif.map((q, idx) => {
              const nilai = contohSkor[q.id_pertanyaan] || 5;
              return (
                <li key={q.id_pertanyaan} className="kuesioner-form-item">
                  <div className="kuesioner-instrumen-judul">
                    <span className="ke-badge">{idx + 1}</span>
                    <strong>{q.teks_pertanyaan}</strong>
                  </div>
                  <div className="kuesioner-likert-group">
                    {SKALA_LIKERT.map((s) => (
                      <button
                        key={s.skor}
                        type="button"
                        className={`kuesioner-likert-btn${nilai === s.skor ? ' is-selected' : ''}`}
                        onClick={() => setContohSkor((p) => ({ ...p, [q.id_pertanyaan]: s.skor }))}
                      >
                        <strong>★ {s.skor}</strong>
                        <small>{s.label}</small>
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="field">
            <span className="field-label">Komentar, saran, atau masukan untuk dosen (opsional)</span>
            <textarea
              className="input textarea"
              rows={2}
              disabled
              placeholder="Tuliskan kesan atau masukan membangun mengenai metode pengajaran dosen..."
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

function KuesionerAdminPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [tab, setTab] = useState('instrumen');
  const [cari, setCari] = useState('');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [modalForm, setModalForm] = useState(null); // null | 'baru' | objek pertanyaan
  const [pratinjau, setPratinjau] = useState(false);
  const [targetHapus, setTargetHapus] = useState(null);
  const [sibukId, setSibukId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setGagal(false);
    try {
      const res = await api.get('/admin-pelatihan/kuesioner');
      setData(res.data.data);
    } catch {
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pertanyaanList = data?.pertanyaan || [];
  const pertanyaanAktif = useMemo(() => pertanyaanList.filter((q) => q.aktif), [pertanyaanList]);
  const existingTexts = useMemo(
    () => new Set(pertanyaanList.map((q) => q.teks_pertanyaan.toLowerCase())),
    [pertanyaanList]
  );

  const pertanyaanTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return pertanyaanList.filter((item) => {
      if (filterStatus === 'aktif' && !item.aktif) return false;
      if (filterStatus === 'nonaktif' && item.aktif) return false;
      if (!q) return true;
      return item.teks_pertanyaan.toLowerCase().includes(q);
    });
  }, [pertanyaanList, cari, filterStatus]);

  const toggleAktif = async (item) => {
    setSibukId(item.id_pertanyaan);
    try {
      const res = await api.put(`/admin-pelatihan/kuesioner/${item.id_pertanyaan}`, {
        aktif: !item.aktif,
      });
      toast.success(res.data.message);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah status pertanyaan');
    } finally {
      setSibukId(null);
    }
  };

  const geserUrutan = async (index, arah) => {
    const targetIdx = index + arah;
    if (targetIdx < 0 || targetIdx >= pertanyaanList.length) return;
    const salinan = [...pertanyaanList];
    const [pindah] = salinan.splice(index, 1);
    salinan.splice(targetIdx, 0, pindah);

    const daftar = salinan.map((q, idx) => ({
      id_pertanyaan: q.id_pertanyaan,
      urutan: idx + 1,
    }));

    setSibukId(pindah.id_pertanyaan);
    try {
      await api.put('/admin-pelatihan/kuesioner/urutan', { daftar });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui urutan');
    } finally {
      setSibukId(null);
    }
  };

  const konfirmasiHapus = async () => {
    if (!targetHapus) return;
    setSibukId(targetHapus.id_pertanyaan);
    try {
      const res = await api.delete(`/admin-pelatihan/kuesioner/${targetHapus.id_pertanyaan}`);
      toast.success(res.data.message);
      setTargetHapus(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus pertanyaan');
    } finally {
      setSibukId(null);
    }
  };

  const nonaktifkanDariModalHapus = async () => {
    if (!targetHapus) return;
    const item = targetHapus;
    setTargetHapus(null);
    await toggleAktif(item);
  };

  if (loading && !data) return <p className="table-message">Memuat data kuesioner pelatihan...</p>;
  if (gagal && !data) {
    return (
      <div className="table-message">
        <p>Gagal memuat manajemen kuesioner pelatihan.</p>
        <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
      </div>
    );
  }

  const { ringkasan, rekap_pengajar: rekapPengajar, rekap_kelas: rekapKelas } = data;
  const sedangFilter = Boolean(cari.trim() || filterStatus !== 'semua');

  return (
    <>
      <PageHeader
        eyebrow="Pelatihan / Kuesioner evaluasi"
        title="Kuesioner pelatihan & instrumen evaluasi"
        subtitle="Kelola daftar pertanyaan kuesioner (skala Likert 1–5) yang diisi oleh mahasiswa untuk mengevaluasi dosen pengajar."
        action={
          <div className="action-group">
            <button type="button" className="btn btn-outline" onClick={() => setPratinjau(true)}>
              <Icon name="eye" size={17} /> Pratinjau mahasiswa
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setModalForm('baru')}>
              <Icon name="plus" size={18} /> Tambah pertanyaan
            </button>
          </div>
        }
      />

      <div className="summary-row">
        <div className="summary-item">
          <strong>{ringkasan.total_pertanyaan}</strong>
          <span>Total instrumen</span>
        </div>
        <div className="summary-item">
          <strong>{ringkasan.pertanyaan_aktif}</strong>
          <span>Pertanyaan aktif</span>
        </div>
        <div className="summary-item">
          <strong>{ringkasan.pertanyaan_nonaktif}</strong>
          <span>Nonaktif (arsip)</span>
        </div>
        <div className="summary-item">
          <strong>{ringkasan.total_isian_kuesioner}</strong>
          <span>Kuesioner terisi</span>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Menu kuesioner pelatihan">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'instrumen'}
          className={`tab${tab === 'instrumen' ? ' active' : ''}`}
          onClick={() => setTab('instrumen')}
        >
          <Icon name="clipboard" size={16} /> Instrumen pertanyaan
          <span className="tab-count">{ringkasan.total_pertanyaan}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'monitoring'}
          className={`tab${tab === 'monitoring' ? ' active' : ''}`}
          onClick={() => setTab('monitoring')}
        >
          <Icon name="chart" size={16} /> Monitoring evaluasi dosen & kelas
          <span className="tab-count">{ringkasan.total_isian_kuesioner}</span>
        </button>
      </div>

      {tab === 'instrumen' ? (
        <section className="panel">
          <div className="toolbar">
            <div className="input-wrap toolbar-search">
              <Icon name="search" size={18} className="input-icon" />
              <input
                className="input"
                placeholder="Cari teks pertanyaan kuesioner..."
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                aria-label="Cari pertanyaan kuesioner"
              />
            </div>
            <select
              className="input input-plain select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter status pertanyaan"
            >
              <option value="semua">Semua status ({ringkasan.total_pertanyaan})</option>
              <option value="aktif">Aktif ({ringkasan.pertanyaan_aktif})</option>
              <option value="nonaktif">Nonaktif ({ringkasan.pertanyaan_nonaktif})</option>
            </select>
          </div>

          {pertanyaanList.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title="Belum ada instrumen pertanyaan"
              text='Klik "Tambah pertanyaan" untuk membuat butir pertanyaan kuesioner evaluasi pertama.'
            />
          ) : pertanyaanTampil.length === 0 ? (
            <EmptyState
              icon="search"
              title="Tidak ada pertanyaan yang cocok"
              text="Ubah kata kunci pencarian atau filter status."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Urutan</th>
                    <th>Teks Pertanyaan Kuesioner</th>
                    <th>Respons & Rerata</th>
                    <th>Status</th>
                    <th className="actions"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pertanyaanTampil.map((q) => {
                    const idxAsli = pertanyaanList.findIndex((x) => x.id_pertanyaan === q.id_pertanyaan);
                    const sibuk = sibukId === q.id_pertanyaan;
                    return (
                      <tr key={q.id_pertanyaan} className={!q.aktif ? 'is-muted' : ''}>
                        <td className="nowrap">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span className="ke-badge">{q.urutan}</span>
                            {!sedangFilter && (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                                <button
                                  type="button"
                                  className="icon-action"
                                  style={{ width: 22, height: 18, fontSize: 10, margin: 0 }}
                                  onClick={() => geserUrutan(idxAsli, -1)}
                                  disabled={sibuk || idxAsli === 0}
                                  title="Geser ke atas"
                                  aria-label={`Geser pertanyaan ${q.urutan} ke atas`}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="icon-action"
                                  style={{ width: 22, height: 18, fontSize: 10, margin: 0 }}
                                  onClick={() => geserUrutan(idxAsli, 1)}
                                  disabled={sibuk || idxAsli === pertanyaanList.length - 1}
                                  title="Geser ke bawah"
                                  aria-label={`Geser pertanyaan ${q.urutan} ke bawah`}
                                >
                                  ▼
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <p className="cell-title">{q.teks_pertanyaan}</p>
                          <p className="cell-sub">Skala Likert 1 (Sangat Kurang) s.d. 5 (Sangat Baik)</p>
                        </td>
                        <td className="nowrap">
                          {q.jumlah_jawaban > 0 ? (
                            <div>
                              <span className="kuesioner-skor-chip">★ {fmtSkor(q.rata_rata)} / 5,00</span>
                              <p className="cell-sub" style={{ marginTop: 2 }}>{q.jumlah_jawaban} jawaban mahasiswa</p>
                            </div>
                          ) : (
                            <span className="cell-sub">Belum ada jawaban</span>
                          )}
                        </td>
                        <td className="nowrap">
                          <span className={`badge ${q.aktif ? 'badge-success' : 'badge-muted'}`}>
                            {q.aktif ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="actions nowrap">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => toggleAktif(q)}
                            disabled={sibuk}
                            title={q.aktif ? 'Sembunyikan dari kuesioner mahasiswa' : 'Tampilkan pada kuesioner mahasiswa'}
                          >
                            {q.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            className="icon-action"
                            onClick={() => setModalForm(q)}
                            disabled={sibuk}
                            aria-label={`Ubah pertanyaan ${q.urutan}`}
                            title="Ubah pertanyaan"
                          >
                            <Icon name="pencil" size={17} />
                          </button>
                          <button
                            type="button"
                            className="icon-action danger"
                            onClick={() => setTargetHapus(q)}
                            disabled={sibuk}
                            aria-label={`Hapus pertanyaan ${q.urutan}`}
                            title="Hapus pertanyaan"
                          >
                            <Icon name="trash" size={17} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        /* Tab 2: Monitoring Evaluasi Dosen & Periode Kuesioner Kelas */
        <div className="dash-grid cols-2" style={{ alignItems: 'start' }}>
          <section className="panel">
            <header className="panel-head">
              <div className="panel-title-wrap">
                <span className="icon-tile"><Icon name="award" /></span>
                <div>
                  <h2 className="panel-title">Rekap evaluasi per dosen pengajar</h2>
                  <p className="panel-sub">Rata-rata skor kuesioner dari seluruh kelas yang diampu</p>
                </div>
              </div>
            </header>

            {rekapPengajar.length === 0 ? (
              <EmptyState
                icon="award"
                title="Belum ada kuesioner yang masuk"
                text="Rekapitulasi nilai evaluasi per dosen akan muncul setelah mahasiswa mengisi kuesioner di Ruang Kelas."
              />
            ) : (
              <ul className="kuesioner-instrumen-list">
                {rekapPengajar.map((p) => (
                  <li key={p.id_pengajar} className="kuesioner-instrumen-item">
                    <div className="kuesioner-instrumen-head">
                      <div>
                        <strong>{p.nama_lengkap}</strong>
                        <p className="cell-sub">{p.kelas.join(' · ') || 'Kelas pelatihan'}</p>
                      </div>
                      <div className="kuesioner-instrumen-angka">
                        <strong>★ {fmtSkor(p.rerata_skor)}</strong>
                        <span className="cell-sub">/ 5,00</span>
                        <span className={`badge ${BADGE_PREDIKAT[p.predikat?.kode] || 'badge-muted'}`}>
                          {p.predikat?.label}
                        </span>
                      </div>
                    </div>
                    <Meter value={p.persen_kepuasan ?? 0} max={100} label={`Kepuasan ${p.nama_lengkap}`} />
                    <div className="nilai-kelas-card-meta">
                      <span>{p.responden} kuesioner terisi</span>
                      <span>{p.komentar} komentar tertulis</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <header className="panel-head">
              <div className="panel-title-wrap">
                <span className="icon-tile"><Icon name="book" /></span>
                <div>
                  <h2 className="panel-title">Status kuesioner per kelas</h2>
                  <p className="panel-sub">Periode buka/tutup diatur melalui menu Kelas pelatihan</p>
                </div>
              </div>
              <Link to="/dashboard/admin/kelas" className="chip-btn">
                Atur periode <Icon name="arrowRight" size={14} />
              </Link>
            </header>

            {rekapKelas.length === 0 ? (
              <EmptyState icon="book" title="Belum ada kelas aktif" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Kelas</th>
                      <th>Periode Kuesioner</th>
                      <th>Responden</th>
                      <th>Rerata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapKelas.map((k) => {
                      const infoPeriode = BADGE_PERIODE[k.periode?.status] || BADGE_PERIODE.dibuka;
                      const stKelas = STATUS_KELAS[k.status];
                      return (
                        <tr key={k.id_kelas}>
                          <td>
                            <p className="cell-title">{k.nama_kelas}</p>
                            <p className="cell-sub">
                              {JENIS_PELATIHAN[k.jenis_pelatihan]} · {TIPE_KELAS[k.tipe_kelas]}{' '}
                              {stKelas && <span className={`badge ${stKelas.badge}`}>{stKelas.label}</span>}
                            </p>
                          </td>
                          <td>
                            <span className={`badge ${infoPeriode.badge}`}>{infoPeriode.label}</span>
                            <p className="cell-sub" style={{ marginTop: 2 }}>{k.periode?.keterangan}</p>
                          </td>
                          <td className="nowrap">
                            <strong>{k.isian_kuesioner}</strong> isian
                            <p className="cell-sub">{k.peserta} peserta aktif</p>
                          </td>
                          <td className="nowrap">
                            {k.rerata_skor !== null ? (
                              <span className="kuesioner-skor-chip">★ {fmtSkor(k.rerata_skor)}</span>
                            ) : (
                              <span className="cell-sub">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {modalForm && (
        <PertanyaanFormModal
          target={modalForm === 'baru' ? null : modalForm}
          urutanDefault={pertanyaanList.length + 1}
          existingTexts={existingTexts}
          onClose={() => setModalForm(null)}
          onSaved={() => {
            setModalForm(null);
            load();
          }}
        />
      )}

      {pratinjau && (
        <PratinjauMahasiswaModal
          pertanyaanAktif={pertanyaanAktif}
          onClose={() => setPratinjau(false)}
        />
      )}

      {targetHapus && (
        <Modal
          title="Hapus pertanyaan kuesioner?"
          onClose={() => setTargetHapus(null)}
          busy={sibukId === targetHapus.id_pertanyaan}
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setTargetHapus(null)}
                disabled={sibukId === targetHapus.id_pertanyaan}
              >
                Batal
              </button>
              {targetHapus.jumlah_jawaban > 0 ? (
                targetHapus.aktif && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={nonaktifkanDariModalHapus}
                    disabled={sibukId === targetHapus.id_pertanyaan}
                  >
                    Nonaktifkan saja
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={konfirmasiHapus}
                  disabled={sibukId === targetHapus.id_pertanyaan}
                >
                  {sibukId === targetHapus.id_pertanyaan ? 'Menghapus...' : 'Hapus permanen'}
                </button>
              )}
            </>
          }
        >
          {targetHapus.jumlah_jawaban > 0 ? (
            <p>
              Pertanyaan <strong>“{targetHapus.teks_pertanyaan}”</strong> sudah memiliki{' '}
              <strong>{targetHapus.jumlah_jawaban} jawaban</strong> dari mahasiswa sehingga tidak dapat dihapus permanen.
              Nonaktifkan pertanyaan ini agar tidak muncul pada kuesioner baru namun riwayat evaluasi dosen tetap tersimpan.
            </p>
          ) : (
            <p>
              Pertanyaan <strong>“{targetHapus.teks_pertanyaan}”</strong> belum memiliki jawaban dan akan dihapus permanen.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

export default KuesionerAdminPage;
