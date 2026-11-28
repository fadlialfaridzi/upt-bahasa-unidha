// Tab Nilai Evaluasi Peserta di Ruang Kelas (Dosen / Admin)
// Pelatihan bersifat opsional (persiapan tes TOEFL seperti les/bimbel), sehingga tidak ada
// indikator Lulus atau Tidak lulus. Nilai pre-test & post-test (nilai akhir) hanya untuk
// memantau perkembangan kemampuan peserta selama mengikuti pelatihan.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import Icon from '../ui/Icon.jsx';
import { EmptyState } from '../dashboard/Widgets.jsx';
import { Meter } from '../dashboard/Pelatihan.jsx';
import { statusEvaluasi } from '../../config/pelatihan.js';

const toStr = (v) => (v === null || v === undefined ? '' : String(v));

function parseSkor(raw) {
  if (raw === '' || raw === null || raw === undefined) return { ok: true, nilai: null };
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, nilai: null };
  return { ok: true, nilai: Math.round(n * 100) / 100 };
}

const rataRata = (arr) => {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
};

const fmtAngka = (n) => (n === null || n === undefined ? '—' : String(n).replace('.', ','));

function RingkasanNilai({ r }) {
  const isi = [
    ['hadir', 'Sudah dinilai', r.sudah_dinilai],
    ['izin', 'Sudah pre-test', r.sudah_pretest],
    ['naik', 'Meningkat (Δ > 0)', r.meningkat],
    ['belum', 'Belum dinilai', r.belum_dinilai],
  ];
  return (
    <div className="presensi-ringkas">
      {isi.map(([k, label, n]) => (
        <div key={k} className={`presensi-ringkas-item is-${k}`}>
          <strong>{n}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function NilaiKelas({ idKelas, onTersimpan }) {
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState({});
  const [terpilih, setTerpilih] = useState(() => new Set());
  const [cari, setCari] = useState('');
  const [filterTab, setFilterTab] = useState('semua');
  const [urutan, setUrutan] = useState('nama');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState(false);

  const inisialisasiDraft = useCallback((pesertaList) => {
    const awal = {};
    for (const p of pesertaList) {
      awal[p.id_pendaftaran] = {
        nilai_pretest: toStr(p.nilai_pretest),
        nilai_akhir: toStr(p.nilai_akhir),
      };
    }
    setDraft(awal);
    setTerpilih(new Set());
  }, []);

  const loadDetail = useCallback(async () => {
    if (!idKelas) return;
    setLoading(true);
    setGagal(false);
    try {
      const res = await api.get(`/dosen/nilai/${idKelas}`);
      const d = res.data.data;
      setDetail(d);
      inisialisasiDraft(d.peserta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat data nilai kelas');
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, [idKelas, inisialisasiDraft]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const berubahIds = useMemo(() => {
    if (!detail) return new Set();
    const s = new Set();
    for (const p of detail.peserta) {
      const d = draft[p.id_pendaftaran];
      if (!d) continue;
      const preSekarang = parseSkor(d.nilai_pretest);
      const akhirSekarang = parseSkor(d.nilai_akhir);
      const preBerubah = !preSekarang.ok ? d.nilai_pretest !== toStr(p.nilai_pretest) : preSekarang.nilai !== p.nilai_pretest;
      const akhirBerubah = !akhirSekarang.ok ? d.nilai_akhir !== toStr(p.nilai_akhir) : akhirSekarang.nilai !== p.nilai_akhir;
      if (preBerubah || akhirBerubah) {
        s.add(p.id_pendaftaran);
      }
    }
    return s;
  }, [detail, draft]);

  const ringkasanLive = useMemo(() => {
    if (!detail) return null;
    let sudah_dinilai = 0;
    let belum_dinilai = 0;
    let sudah_pretest = 0;
    let belum_pretest = 0;
    let meningkat = 0;
    const preList = [];
    const akhirList = [];
    const selisihList = [];

    for (const p of detail.peserta) {
      const d = draft[p.id_pendaftaran];
      const pre = parseSkor(d?.nilai_pretest ?? p.nilai_pretest);
      const akhir = parseSkor(d?.nilai_akhir ?? p.nilai_akhir);

      if (pre.ok && pre.nilai !== null) {
        preList.push(pre.nilai);
        sudah_pretest += 1;
      } else {
        belum_pretest += 1;
      }

      if (akhir.ok && akhir.nilai !== null) {
        akhirList.push(akhir.nilai);
        sudah_dinilai += 1;
        if (pre.ok && pre.nilai !== null) {
          const delta = Math.round((akhir.nilai - pre.nilai) * 100) / 100;
          selisihList.push(delta);
          if (delta > 0) meningkat += 1;
        }
      } else {
        belum_dinilai += 1;
      }
    }

    return {
      total: detail.peserta.length,
      sudah_dinilai,
      belum_dinilai,
      sudah_pretest,
      belum_pretest,
      meningkat,
      rerata_pretest: rataRata(preList),
      rerata_akhir: rataRata(akhirList),
      rerata_selisih: rataRata(selisihList),
      nilai_tertinggi: akhirList.length ? Math.max(...akhirList) : null,
      nilai_terendah: akhirList.length ? Math.min(...akhirList) : null,
    };
  }, [detail, draft]);

  const pesertaTampil = useMemo(() => {
    if (!detail) return [];
    const q = cari.trim().toLowerCase();
    const hasil = detail.peserta.filter((p) => {
      const d = draft[p.id_pendaftaran];
      const pre = parseSkor(d?.nilai_pretest ?? p.nilai_pretest);
      const akhir = parseSkor(d?.nilai_akhir ?? p.nilai_akhir);
      const sudahAkhir = akhir.ok && akhir.nilai !== null;
      const sudahPre = pre.ok && pre.nilai !== null;

      if (filterTab === 'sudah_dinilai' && !sudahAkhir) return false;
      if (filterTab === 'belum_dinilai' && sudahAkhir) return false;
      if (filterTab === 'belum_pretest' && sudahPre) return false;

      if (!q) return true;
      return (
        p.nama_lengkap.toLowerCase().includes(q) ||
        (p.nim && p.nim.toLowerCase().includes(q)) ||
        (p.program_studi && p.program_studi.toLowerCase().includes(q))
      );
    });

    const salinan = [...hasil];
    salinan.sort((a, b) => {
      if (urutan === 'nilai_tinggi' || urutan === 'nilai_rendah') {
        const na = parseSkor(draft[a.id_pendaftaran]?.nilai_akhir).nilai;
        const nb = parseSkor(draft[b.id_pendaftaran]?.nilai_akhir).nilai;
        if (na === null && nb === null) return a.nama_lengkap.localeCompare(b.nama_lengkap);
        if (na === null) return 1;
        if (nb === null) return -1;
        return urutan === 'nilai_tinggi' ? nb - na : na - nb;
      }
      if (urutan === 'peningkatan_tinggi') {
        const preA = parseSkor(draft[a.id_pendaftaran]?.nilai_pretest).nilai;
        const akhA = parseSkor(draft[a.id_pendaftaran]?.nilai_akhir).nilai;
        const preB = parseSkor(draft[b.id_pendaftaran]?.nilai_pretest).nilai;
        const akhB = parseSkor(draft[b.id_pendaftaran]?.nilai_akhir).nilai;
        const da = preA !== null && akhA !== null ? akhA - preA : null;
        const db = preB !== null && akhB !== null ? akhB - preB : null;
        if (da === null && db === null) return a.nama_lengkap.localeCompare(b.nama_lengkap);
        if (da === null) return 1;
        if (db === null) return -1;
        return db - da;
      }
      return a.nama_lengkap.localeCompare(b.nama_lengkap);
    });
    return salinan;
  }, [detail, draft, cari, filterTab, urutan]);

  const updateField = (p, field, value) => {
    setDraft((prev) => {
      const cur = prev[p.id_pendaftaran] || {
        nilai_pretest: toStr(p.nilai_pretest),
        nilai_akhir: toStr(p.nilai_akhir),
      };
      return {
        ...prev,
        [p.id_pendaftaran]: { ...cur, [field]: value },
      };
    });
  };

  const centang = (id) => setTerpilih((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const semuaTampilTerpilih = pesertaTampil.length > 0 && pesertaTampil.every((p) => terpilih.has(p.id_pendaftaran));
  const sebagianTampilTerpilih = pesertaTampil.some((p) => terpilih.has(p.id_pendaftaran)) && !semuaTampilTerpilih;

  const centangSemuaTampil = () => {
    setTerpilih((prev) => {
      const next = new Set(prev);
      if (semuaTampilTerpilih) {
        for (const p of pesertaTampil) next.delete(p.id_pendaftaran);
      } else {
        for (const p of pesertaTampil) next.add(p.id_pendaftaran);
      }
      return next;
    });
  };

  const kosongkanTerpilih = () => {
    if (!detail || terpilih.size === 0) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const p of detail.peserta) {
        if (!terpilih.has(p.id_pendaftaran)) continue;
        next[p.id_pendaftaran] = {
          nilai_pretest: '',
          nilai_akhir: '',
        };
      }
      return next;
    });
    setTerpilih(new Set());
  };

  const unduhCsv = () => {
    if (!detail) return;
    const header = [
      'No',
      'Nama Lengkap',
      'NIM',
      'Program Studi',
      'Hadir',
      'Izin',
      'Alpha',
      'Total Sesi Presensi',
      'Kehadiran (%)',
      'Nilai Pre-test',
      'Nilai Akhir (Post-test)',
      'Perkembangan (Selisih)',
      'Status Penilaian',
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const baris = detail.peserta.map((p, idx) => {
      const d = draft[p.id_pendaftaran];
      const pre = parseSkor(d?.nilai_pretest ?? p.nilai_pretest).nilai;
      const akhir = parseSkor(d?.nilai_akhir ?? p.nilai_akhir).nilai;
      const selisih = pre !== null && akhir !== null ? Math.round((akhir - pre) * 100) / 100 : '';
      const status = statusEvaluasi(pre, akhir).label;
      return [
        idx + 1,
        p.nama_lengkap,
        p.nim || '-',
        p.program_studi || 'Umum',
        p.hadir,
        p.izin,
        p.alpha,
        detail.total_sesi,
        p.kehadiran_persen ?? '-',
        pre ?? '',
        akhir ?? '',
        selisih,
        status,
      ].map(esc).join(',');
    });

    const csv = `\uFEFF${[header.map(esc).join(','), ...baris].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = detail.kelas.nama_kelas.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `nilai-evaluasi-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetDraft = () => {
    if (!detail) return;
    inisialisasiDraft(detail.peserta);
  };

  const simpan = async (e) => {
    if (e) e.preventDefault();
    if (!detail || berubahIds.size === 0) return;

    const payload = [];
    for (const p of detail.peserta) {
      if (!berubahIds.has(p.id_pendaftaran)) continue;
      const d = draft[p.id_pendaftaran];
      const pretest = parseSkor(d.nilai_pretest);
      const akhir = parseSkor(d.nilai_akhir);
      if (!pretest.ok || !akhir.ok) {
        toast.error(`Nilai ${p.nama_lengkap} harus berupa angka antara 0 sampai 100`);
        return;
      }
      payload.push({
        id_pendaftaran: p.id_pendaftaran,
        nilai_pretest: pretest.nilai,
        nilai_akhir: akhir.nilai,
      });
    }

    setSaving(true);
    try {
      const res = await api.put(`/dosen/nilai/${idKelas}`, { nilai: payload });
      toast.success(res.data.message);
      if (res.data.data) {
        setDetail(res.data.data);
        inisialisasiDraft(res.data.data.peserta);
      } else {
        await loadDetail();
      }
      if (onTersimpan) onTersimpan();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan nilai');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !detail) {
    return <p className="table-message">Memuat data evaluasi peserta...</p>;
  }

  if (gagal && !detail) {
    return (
      <div className="table-message">
        <p>Gagal memuat data nilai kelas.</p>
        <button type="button" className="btn btn-soft btn-sm" onClick={loadDetail}>Coba lagi</button>
      </div>
    );
  }

  if (!detail || !ringkasanLive) return null;

  return (
    <form className="panel" onSubmit={simpan}>
      <header className="panel-head">
        <div>
          <h2 className="panel-title">Evaluasi nilai peserta</h2>
          <p className="panel-sub">
            Catat nilai pre-test (awal) dan post-test (nilai akhir) untuk memantau perkembangan kemampuan peserta
          </p>
        </div>
        <div className="action-group">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={unduhCsv}
            disabled={detail.peserta.length === 0}
          >
            <Icon name="download" size={15} /> Unduh CSV
          </button>
          {berubahIds.size > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={resetDraft} disabled={saving}>
              Batalkan ({berubahIds.size})
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || berubahIds.size === 0}>
            <Icon name="check" size={15} />
            {saving ? 'Menyimpan...' : berubahIds.size > 0 ? `Simpan nilai (${berubahIds.size})` : 'Semua tersimpan'}
          </button>
        </div>
      </header>

      {/* Ringkasan Progres Penilaian Live */}
      <RingkasanNilai r={ringkasanLive} />

      {/* Statistik Evaluasi Kelas (Pre-test vs Post-test & Rentang) */}
      <div className="nilai-stat-strip">
        <div className="nilai-stat-box">
          <span>Rerata Pre-test</span>
          <strong>{fmtAngka(ringkasanLive.rerata_pretest)}</strong>
          <small>Nilai awal sebelum pelatihan</small>
        </div>
        <div className="nilai-stat-box">
          <span>Rerata Nilai Akhir</span>
          <strong>{fmtAngka(ringkasanLive.rerata_akhir)}</strong>
          <small>Nilai evaluasi akhir (post-test)</small>
        </div>
        <div className="nilai-stat-box">
          <span>Rerata Peningkatan (Δ)</span>
          <strong
            style={{
              color:
                ringkasanLive.rerata_selisih > 0
                  ? 'var(--success)'
                  : ringkasanLive.rerata_selisih < 0
                  ? 'var(--danger)'
                  : undefined,
            }}
          >
            {ringkasanLive.rerata_selisih === null
              ? '—'
              : `${ringkasanLive.rerata_selisih > 0 ? '+' : ''}${fmtAngka(ringkasanLive.rerata_selisih)}`}
          </strong>
          <small>Selisih post-test vs pre-test</small>
        </div>
        <div className="nilai-stat-box">
          <span>Rentang Nilai Akhir</span>
          <strong>
            {ringkasanLive.nilai_terendah === null
              ? '—'
              : `${fmtAngka(ringkasanLive.nilai_terendah)} – ${fmtAngka(ringkasanLive.nilai_tertinggi)}`}
          </strong>
          <small>Terendah s.d. tertinggi</small>
        </div>
      </div>

      {/* Filter Tab, Pencarian & Pengurutan */}
      <div className="nilai-toolbar">
        <div className="tabs" role="tablist" aria-label="Filter status evaluasi peserta">
          {[
            { id: 'semua', label: 'Semua', count: ringkasanLive.total },
            { id: 'sudah_dinilai', label: 'Sudah dinilai', count: ringkasanLive.sudah_dinilai },
            { id: 'belum_dinilai', label: 'Belum dinilai', count: ringkasanLive.belum_dinilai },
            { id: 'belum_pretest', label: 'Belum pre-test', count: ringkasanLive.belum_pretest },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filterTab === t.id}
              className={`tab${filterTab === t.id ? ' active' : ''}`}
              onClick={() => setFilterTab(t.id)}
            >
              {t.label}
              <span className="tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="nilai-toolbar-kanan">
          <div className="input-wrap nilai-search">
            <span className="input-icon"><Icon name="search" size={16} /></span>
            <input
              type="text"
              className="input"
              placeholder="Cari nama, NIM, atau prodi..."
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              aria-label="Cari peserta"
            />
          </div>
          <select
            className="input input-plain select-sm"
            value={urutan}
            onChange={(e) => setUrutan(e.target.value)}
            aria-label="Urutkan peserta"
          >
            <option value="nama">Urut: Nama (A–Z)</option>
            <option value="nilai_tinggi">Urut: Nilai akhir tertinggi</option>
            <option value="nilai_rendah">Urut: Nilai akhir terendah</option>
            <option value="peningkatan_tinggi">Urut: Peningkatan (Δ) tertinggi</option>
          </select>
        </div>
      </div>

      {/* Bilah Aksi Massal */}
      {terpilih.size > 0 && (
        <div className="bulk-bar presensi-massal">
          <span><strong>{terpilih.size}</strong> peserta dipilih</span>
          <div className="bulk-bar-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={kosongkanTerpilih} disabled={saving}>
              Kosongkan nilai terpilih
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setTerpilih(new Set())} disabled={saving}>
              Batal pilih
            </button>
          </div>
        </div>
      )}

      {detail.peserta.length === 0 ? (
        <EmptyState
          icon="users"
          title="Belum ada peserta terverifikasi"
          text="Peserta muncul setelah pembayaran pendaftarannya diverifikasi oleh admin."
        />
      ) : pesertaTampil.length === 0 ? (
        <EmptyState
          icon="search"
          title="Tidak ada peserta yang cocok"
          text="Coba ubah tab filter atau kata kunci pencarian."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table presensi-table">
              <thead>
                <tr>
                  <th className="col-pilih">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua peserta yang ditampilkan"
                      checked={semuaTampilTerpilih}
                      ref={(el) => { if (el) el.indeterminate = sebagianTampilTerpilih; }}
                      onChange={centangSemuaTampil}
                      disabled={saving}
                    />
                  </th>
                  <th>Peserta</th>
                  <th>Kehadiran</th>
                  <th>Pre-test (0–100)</th>
                  <th>Nilai akhir / Post-test (0–100)</th>
                  <th>Perkembangan (Δ)</th>
                  <th>Status penilaian</th>
                </tr>
              </thead>
              <tbody>
                {pesertaTampil.map((p) => {
                  const d = draft[p.id_pendaftaran] || {
                    nilai_pretest: toStr(p.nilai_pretest),
                    nilai_akhir: toStr(p.nilai_akhir),
                  };
                  const berubah = berubahIds.has(p.id_pendaftaran);
                  const dipilih = terpilih.has(p.id_pendaftaran);
                  const preParsed = parseSkor(d.nilai_pretest);
                  const akhirParsed = parseSkor(d.nilai_akhir);
                  const selisih = preParsed.ok && akhirParsed.ok && preParsed.nilai !== null && akhirParsed.nilai !== null
                    ? Math.round((akhirParsed.nilai - preParsed.nilai) * 100) / 100
                    : null;
                  const stEval = statusEvaluasi(preParsed.nilai, akhirParsed.nilai);

                  return (
                    <tr
                      key={p.id_pendaftaran}
                      className={`${berubah ? 'is-berubah' : ''}${dipilih ? ' is-dipilih' : ''}`}
                    >
                      <td className="col-pilih">
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${p.nama_lengkap}`}
                          checked={dipilih}
                          onChange={() => centang(p.id_pendaftaran)}
                          disabled={saving}
                        />
                      </td>
                      <td>
                        <p className="cell-title">{p.nama_lengkap}</p>
                        <p className="cell-sub">
                          {[p.nim, p.program_studi].filter(Boolean).join(' · ') || 'Peserta umum'}
                        </p>
                      </td>
                      <td>
                        {detail.total_sesi === 0 ? (
                          <span className="cell-sub">Belum ada sesi presensi</span>
                        ) : (
                          <div className="nilai-kehadiran-cell">
                            <div className="nilai-kehadiran-top">
                              <strong>{p.kehadiran_persen}%</strong>
                              <span className="nilai-kehadiran-rincian">
                                {p.hadir}/{detail.total_sesi} hadir
                                {(p.izin > 0 || p.alpha > 0) && ` (${p.izin}I · ${p.alpha}A)`}
                              </span>
                            </div>
                            <Meter
                              value={p.kehadiran_persen}
                              max={100}
                              tone="brand"
                              label={`Kehadiran ${p.nama_lengkap}`}
                            />
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="nilai-input-cell">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className={`input nilai-input${!preParsed.ok ? ' is-invalid' : ''}`}
                            placeholder="0–100"
                            aria-label={`Nilai pre-test ${p.nama_lengkap}`}
                            value={d.nilai_pretest}
                            onChange={(e) => updateField(p, 'nilai_pretest', e.target.value)}
                            disabled={saving}
                          />
                          {!preParsed.ok && <span className="nilai-input-hint is-err">Isi 0–100</span>}
                        </div>
                      </td>
                      <td>
                        <div className="nilai-input-cell">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className={`input nilai-input${!akhirParsed.ok ? ' is-invalid' : ''}`}
                            placeholder="0–100"
                            aria-label={`Nilai akhir ${p.nama_lengkap}`}
                            value={d.nilai_akhir}
                            onChange={(e) => updateField(p, 'nilai_akhir', e.target.value)}
                            disabled={saving}
                          />
                          {!akhirParsed.ok && <span className="nilai-input-hint is-err">Isi 0–100</span>}
                        </div>
                      </td>
                      <td className="nowrap">
                        {selisih === null ? (
                          <span className="cell-sub">—</span>
                        ) : (
                          <span className={`nilai-selisih ${selisih > 0 ? 'is-naik' : selisih < 0 ? 'is-turun' : 'is-tetap'}`}>
                            {selisih > 0 ? `+${fmtAngka(selisih)}` : selisih < 0 ? fmtAngka(selisih) : '0'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${stEval.badge}`}>
                          {stEval.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <footer className="presensi-simpan">
            <span>
              {berubahIds.size > 0
                ? `${berubahIds.size} perubahan nilai peserta belum disimpan`
                : 'Semua nilai tersimpan · Peserta menerima notifikasi saat nilai evaluasi diperbarui'}
            </span>
            <div className="action-group">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={resetDraft}
                disabled={saving || berubahIds.size === 0}
              >
                Batalkan
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={saving || berubahIds.size === 0}
              >
                <Icon name="check" size={15} /> {saving ? 'Menyimpan...' : 'Simpan perubahan'}
              </button>
            </div>
          </footer>
        </>
      )}
    </form>
  );
}
