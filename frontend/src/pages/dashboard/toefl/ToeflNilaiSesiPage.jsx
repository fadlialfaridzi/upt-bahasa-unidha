import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import {
  TOEFL_RAW_LIMITS,
  hitungSkorToeflDariRaw,
  konversiRawToefl,
  parseRawScore,
} from '../../../config/toeflConversion.js';

const STATUS_SESI = {
  terbuka: { label: 'Pendaftaran dibuka', badge: 'badge-muted' },
  menunggu_override: { label: 'Menunggu persetujuan', badge: 'badge-warning' },
  ujian_dibuka: { label: 'Ujian dibuka', badge: 'badge-accent' },
  dijadwalkan: { label: 'Terjadwal', badge: 'badge-success' },
  selesai: { label: 'Selesai', badge: 'badge-muted' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const STATUS_KEHADIRAN = {
  hadir: { label: 'Hadir', badge: 'badge-success' },
  izin: { label: 'Izin', badge: 'badge-warning' },
  sakit: { label: 'Sakit', badge: 'badge-accent' },
  alpha: { label: 'Alpa', badge: 'badge-danger' },
  alpa: { label: 'Alpa', badge: 'badge-danger' },
};

const FILTER_TABS = [
  { key: 'semua', label: 'Semua' },
  { key: 'hadir', label: 'Hadir' },
  { key: 'sudah_dinilai', label: 'Sudah dinilai' },
  { key: 'belum_dinilai', label: 'Belum dinilai' },
  { key: 'tidak_hadir', label: 'Tidak hadir / belum' },
  { key: 'terkunci', label: 'Sertifikat terbit' },
];

const toStr = (v) => (v === null || v === undefined ? '' : String(v));
const formatAngka = (n) => (n === null || n === undefined ? '—' : String(n).replace('.', ','));

const formatTanggal = (value) => {
  if (!value) return 'Belum ditentukan';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Belum ditentukan';
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
};

const formatJam = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 5);
  return d.toISOString().slice(11, 16);
};

function evaluasiDraftBaris(baris) {
  const l = parseRawScore(baris?.raw_listening, 'listening');
  const s = parseRawScore(baris?.raw_structure, 'structure');
  const r = parseRawScore(baris?.raw_reading, 'reading');

  const convL = l.ok && !l.empty ? konversiRawToefl('listening', l.nilai) : null;
  const convS = s.ok && !s.empty ? konversiRawToefl('structure', s.nilai) : null;
  const convR = r.ok && !r.empty ? konversiRawToefl('reading', r.nilai) : null;

  if (!l.ok) {
    return {
      valid: false,
      error: `Listening: ${l.error}`,
      rawL: null,
      rawS: s.ok ? s.nilai : null,
      rawR: r.ok ? r.nilai : null,
      convL,
      convS,
      convR,
      finalScore: null,
    };
  }
  if (!s.ok) {
    return {
      valid: false,
      error: `Structure & Written Expression: ${s.error}`,
      rawL: l.nilai,
      rawS: null,
      rawR: r.ok ? r.nilai : null,
      convL,
      convS,
      convR,
      finalScore: null,
    };
  }
  if (!r.ok) {
    return {
      valid: false,
      error: `Reading Comprehension: ${r.error}`,
      rawL: l.nilai,
      rawS: s.nilai,
      rawR: null,
      convL,
      convS,
      convR,
      finalScore: null,
    };
  }

  const semuaKosong = l.empty && s.empty && r.empty;
  const semuaTerisi = !l.empty && !s.empty && !r.empty;

  if (!semuaKosong && !semuaTerisi) {
    return {
      valid: false,
      error: 'Isi lengkap Raw Score Listening, Structure, dan Reading (atau kosongkan ketiganya untuk reset)',
      rawL: l.nilai,
      rawS: s.nilai,
      rawR: r.nilai,
      convL,
      convS,
      convR,
      finalScore: null,
    };
  }

  if (semuaKosong) {
    return {
      valid: true,
      error: null,
      rawL: null,
      rawS: null,
      rawR: null,
      convL: null,
      convS: null,
      convR: null,
      finalScore: null,
    };
  }

  const konversi = hitungSkorToeflDariRaw({
    raw_listening: l.nilai,
    raw_structure: s.nilai,
    raw_reading: r.nilai,
  });

  if (konversi.skor_toefl === null) {
    return {
      valid: false,
      error: 'Konversi tidak tersedia pada tabel resmi untuk kombinasi Raw Score ini',
      rawL: l.nilai,
      rawS: s.nilai,
      rawR: r.nilai,
      convL,
      convS,
      convR,
      finalScore: null,
    };
  }

  return {
    valid: true,
    error: null,
    rawL: l.nilai,
    rawS: s.nilai,
    rawR: r.nilai,
    convL: konversi.nilai_listening,
    convS: konversi.nilai_structure,
    convR: konversi.nilai_reading,
    finalScore: konversi.skor_toefl,
  };
}

const rataRata = (arr) => {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
};

function ToeflNilaiSesiPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isDosen = user?.role === 'pengajar';
  const basePath = isDosen ? '/dashboard/dosen/toefl' : '/dashboard/admin/toefl';

  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState({});
  const [cari, setCari] = useState('');
  const [filterTab, setFilterTab] = useState('semua');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const inisialisasiDraft = useCallback((pesertaList) => {
    const awal = {};
    for (const p of pesertaList) {
      awal[p.id_pendaftaran] = {
        raw_listening: toStr(p.raw_listening),
        raw_structure: toStr(p.raw_structure),
        raw_reading: toStr(p.raw_reading),
      };
    }
    setDraft(awal);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/toefl/sesi/${id}/nilai`);
      const d = res.data?.data;
      setDetail(d);
      inisialisasiDraft(d?.peserta || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal memuat data nilai sesi TOEFL.');
    } finally {
      setLoading(false);
    }
  }, [id, inisialisasiDraft]);

  useEffect(() => {
    load();
  }, [load]);

  const evaluasiPerPeserta = useMemo(() => {
    const map = new Map();
    for (const p of detail?.peserta || []) {
      const baris = draft[p.id_pendaftaran] || {
        raw_listening: toStr(p.raw_listening),
        raw_structure: toStr(p.raw_structure),
        raw_reading: toStr(p.raw_reading),
      };
      const ev = evaluasiDraftBaris(baris);
      const berubah = p.bisa_dinilai && (
        !ev.valid
          ? (
            baris.raw_listening !== toStr(p.raw_listening)
            || baris.raw_structure !== toStr(p.raw_structure)
            || baris.raw_reading !== toStr(p.raw_reading)
          )
          : (
            ev.rawL !== p.raw_listening
            || ev.rawS !== p.raw_structure
            || ev.rawR !== p.raw_reading
            || ev.convL !== p.nilai_listening
            || ev.convS !== p.nilai_structure
            || ev.convR !== p.nilai_reading
            || ev.finalScore !== p.skor_toefl
          )
      );
      map.set(p.id_pendaftaran, { ...ev, berubah });
    }
    return map;
  }, [detail, draft]);

  const berubahList = useMemo(
    () => (detail?.peserta || []).filter((p) => evaluasiPerPeserta.get(p.id_pendaftaran)?.berubah),
    [detail, evaluasiPerPeserta],
  );

  const errorBarisCount = useMemo(
    () => berubahList.filter((p) => !evaluasiPerPeserta.get(p.id_pendaftaran)?.valid).length,
    [berubahList, evaluasiPerPeserta],
  );

  // Seluruh statistik live hanya menghitung peserta berstatus 'hadir'
  const ringkasanLive = useMemo(() => {
    const peserta = detail?.peserta || [];
    const hadirList = peserta.filter((p) => p.status_kehadiran === 'hadir');
    const finalList = [];
    let sudahDinilai = 0;

    for (const p of hadirList) {
      const ev = evaluasiPerPeserta.get(p.id_pendaftaran);
      const finalScore = p.bisa_dinilai && ev?.valid ? ev.finalScore : p.skor_toefl;
      if (finalScore !== null && finalScore !== undefined) {
        finalList.push(finalScore);
        sudahDinilai += 1;
      }
    }

    return {
      total_peserta: peserta.length,
      total_hadir: hadirList.length,
      sudah_dinilai: sudahDinilai,
      belum_dinilai: Math.max(0, hadirList.length - sudahDinilai),
      sertifikat_terbit: peserta.filter((p) => p.sertifikat_terbit).length,
      rerata_total: rataRata(finalList),
      nilai_tertinggi: finalList.length ? Math.max(...finalList) : null,
      nilai_terendah: finalList.length ? Math.min(...finalList) : null,
    };
  }, [detail, evaluasiPerPeserta]);

  const pesertaTampil = useMemo(() => {
    const list = detail?.peserta || [];
    const q = cari.trim().toLowerCase();

    return list.filter((p) => {
      if (q) {
        const cocokNama = (p.nama_lengkap || '').toLowerCase().includes(q);
        const cocokNim = (p.nim || '').toLowerCase().includes(q);
        if (!cocokNama && !cocokNim) return false;
      }

      const ev = evaluasiPerPeserta.get(p.id_pendaftaran);
      const skorSekarang = p.bisa_dinilai && ev?.valid ? ev.finalScore : p.skor_toefl;

      if (filterTab === 'hadir') return p.status_kehadiran === 'hadir';
      if (filterTab === 'sudah_dinilai') return p.status_kehadiran === 'hadir' && skorSekarang !== null;
      if (filterTab === 'belum_dinilai') return p.status_kehadiran === 'hadir' && skorSekarang === null;
      if (filterTab === 'tidak_hadir') return p.status_kehadiran !== 'hadir';
      if (filterTab === 'terkunci') return p.sertifikat_terbit;
      return true;
    });
  }, [detail, cari, filterTab, evaluasiPerPeserta]);

  const updateField = (p, field, value) => {
    if (!p.bisa_dinilai || saving) return;
    setDraft((prev) => {
      const cur = prev[p.id_pendaftaran] || {
        raw_listening: toStr(p.raw_listening),
        raw_structure: toStr(p.raw_structure),
        raw_reading: toStr(p.raw_reading),
      };
      return {
        ...prev,
        [p.id_pendaftaran]: { ...cur, [field]: value },
      };
    });
  };

  const kosongkanBaris = (p) => {
    if (!p.bisa_dinilai || saving) return;
    setDraft((prev) => ({
      ...prev,
      [p.id_pendaftaran]: {
        raw_listening: '',
        raw_structure: '',
        raw_reading: '',
      },
    }));
  };

  const handleResetPerubahan = () => {
    if (!detail || saving) return;
    inisialisasiDraft(detail.peserta);
  };

  const handleSimpan = async (e) => {
    if (e) e.preventDefault();
    if (!detail || saving || berubahList.length === 0) return;

    if (errorBarisCount > 0) {
      toast.error('Periksa kembali Raw Score yang belum valid sebelum menyimpan.');
      return;
    }

    const payload = berubahList.map((p) => {
      const baris = draft[p.id_pendaftaran];
      return {
        id_pendaftaran: p.id_pendaftaran,
        raw_listening: baris?.raw_listening === '' ? null : baris?.raw_listening,
        raw_structure: baris?.raw_structure === '' ? null : baris?.raw_structure,
        raw_reading: baris?.raw_reading === '' ? null : baris?.raw_reading,
      };
    });

    setSaving(true);
    try {
      const res = await api.put(`/toefl/sesi/${id}/nilai`, { nilai: payload });
      const updated = res.data?.data;
      setDetail(updated);
      inisialisasiDraft(updated?.peserta || []);
      toast.success(res.data?.message || 'Nilai TOEFL berhasil disimpan');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan nilai TOEFL');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !detail) {
    return (
      <>
        <Link to={`${basePath}/nilai`} className="back-link dash-back">
          <Icon name="arrowLeft" size={16} /> Kembali ke Daftar Nilai TOEFL
        </Link>
        <PageHeader eyebrow="Pengelolaan Nilai TOEFL" title="Input Nilai Sesi TOEFL" />
        <p className="table-message">Memuat data nilai sesi TOEFL...</p>
      </>
    );
  }

  if (errorMsg && !detail) {
    return (
      <>
        <Link to={`${basePath}/nilai`} className="back-link dash-back">
          <Icon name="arrowLeft" size={16} /> Kembali ke Daftar Nilai TOEFL
        </Link>
        <PageHeader eyebrow="Pengelolaan Nilai TOEFL" title="Input Nilai Sesi TOEFL" />
        <div className="table-message" role="alert">
          <p>{errorMsg}</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={load}>
            <Icon name="refresh" size={15} /> Coba lagi
          </button>
        </div>
      </>
    );
  }

  if (!detail?.sesi) return null;

  const { sesi } = detail;
  const statusSesiMeta = STATUS_SESI[sesi.status] || { label: sesi.status, badge: 'badge-muted' };

  return (
    <>
      <Link to={`${basePath}/nilai`} className="back-link dash-back">
        <Icon name="arrowLeft" size={16} /> Kembali ke Daftar Nilai TOEFL
      </Link>

      <PageHeader
        eyebrow={isDosen ? 'Dosen / Pengelolaan Nilai TOEFL' : 'TOEFL / Administrasi ujian / Nilai'}
        title={sesi.nama_sesi}
        subtitle={`${formatTanggal(sesi.tanggal)} · ${formatJam(sesi.jam_mulai)}–${formatJam(sesi.jam_selesai)} WIB · ${sesi.ruang || 'Ruang belum ditentukan'}`}
        action={
          <div className="action-group">
            <span className={`badge ${statusSesiMeta.badge}`}>{statusSesiMeta.label}</span>
            {!isDosen && (
              <Link
                to={`/dashboard/admin/toefl/sesi/${sesi.id_sesi}/absensi`}
                className="btn btn-outline btn-sm"
                style={{ textDecoration: 'none' }}
              >
                <Icon name="qr" size={15} /> Absensi Sesi
              </Link>
            )}
            <button type="button" className="btn btn-soft btn-sm" onClick={load} disabled={loading || saving}>
              <Icon name="refresh" size={15} /> Muat ulang
            </button>
          </div>
        }
      />

      {/* Ringkasan Statistik Final Score Sesi (Hanya Peserta Hadir) */}
      <div
        className="summary-row"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 12, marginBottom: 16 }}
      >
        <div className="summary-item">
          <strong>{ringkasanLive.total_hadir}</strong>
          <span>Hadir (dari {ringkasanLive.total_peserta})</span>
        </div>
        <div className="summary-item">
          <strong>{ringkasanLive.sudah_dinilai}</strong>
          <span>Sudah dinilai</span>
        </div>
        <div className="summary-item">
          <strong>{ringkasanLive.belum_dinilai}</strong>
          <span>Belum dinilai</span>
        </div>
        <div className="summary-item">
          <strong>{formatAngka(ringkasanLive.rerata_total)}</strong>
          <span>Rata-rata Final Score</span>
        </div>
        <div className="summary-item">
          <strong>{formatAngka(ringkasanLive.nilai_tertinggi)}</strong>
          <span>Final Score tertinggi</span>
        </div>
        <div className="summary-item">
          <strong>{formatAngka(ringkasanLive.nilai_terendah)}</strong>
          <span>Final Score terendah</span>
        </div>
      </div>

      {!sesi.bisa_dinilai && (
        <div className="alert alert-danger" role="alert" style={{ marginBottom: 16 }}>
          <Icon name="alert" size={18} />
          <span>{sesi.alasan_tidak_bisa_dinilai}</span>
        </div>
      )}

      {ringkasanLive.sertifikat_terbit > 0 && (
        <div
          role="note"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon name="lock" size={16} style={{ flexShrink: 0 }} />
          <span>
            {ringkasanLive.sertifikat_terbit} peserta telah memiliki sertifikat terbit sehingga nilainya dikunci untuk menjaga konsistensi dokumen sertifikat.
          </span>
        </div>
      )}

      <section className="panel" style={{ padding: '20px' }}>
        <header className="panel-head" style={{ marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 className="panel-title">Input Raw Score &amp; Konversi Nilai TOEFL</h2>
            <p className="panel-sub">
              Masukkan <strong>Raw Score</strong> (jumlah jawaban benar): Listening ({TOEFL_RAW_LIMITS.listening.min}–{TOEFL_RAW_LIMITS.listening.max}), Structure ({TOEFL_RAW_LIMITS.structure.min}–{TOEFL_RAW_LIMITS.structure.max}), Reading ({TOEFL_RAW_LIMITS.reading.min}–{TOEFL_RAW_LIMITS.reading.max}). Converted Score &amp; Final Score dihitung otomatis dari tabel resmi UPT Bahasa.
            </p>
          </div>
          <span className="badge badge-muted">
            {ringkasanLive.sudah_dinilai}/{ringkasanLive.total_hadir} hadir dinilai
          </span>
        </header>

        <form onSubmit={handleSimpan} className="panel-body">
          {/* Toolbar Pencarian & Filter */}
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div className="input-wrap toolbar-search">
              <Icon name="search" size={18} className="input-icon" />
              <input
                className="input"
                placeholder="Cari nama atau NIM peserta..."
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                aria-label="Cari peserta berdasarkan nama atau NIM"
              />
            </div>

            <div className="preset-group" role="tablist" aria-label="Filter peserta">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={filterTab === tab.key}
                  className={`preset-btn${filterTab === tab.key ? ' active' : ''}`}
                  onClick={() => setFilterTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {detail.peserta.length === 0 ? (
            <EmptyState
              icon="users"
              title="Belum ada peserta terverifikasi"
              text="Peserta yang pembayarannya telah terverifikasi pada sesi TOEFL ini akan tampil di sini."
            />
          ) : pesertaTampil.length === 0 ? (
            <EmptyState
              icon="search"
              title="Tidak ada peserta yang cocok"
              text="Ubah kata kunci pencarian atau pilih tab filter lain."
            />
          ) : (
            <div className="table-wrap">
              <table className="table presensi-table">
                <thead>
                  <tr>
                    <th>Peserta</th>
                    <th>Kehadiran</th>
                    <th style={{ width: 140 }}>
                      Listening
                      <div className="cell-sub" style={{ fontWeight: 400 }}>Raw 0–50</div>
                    </th>
                    <th style={{ width: 140 }}>
                      Structure
                      <div className="cell-sub" style={{ fontWeight: 400 }}>Raw 0–40</div>
                    </th>
                    <th style={{ width: 140 }}>
                      Reading
                      <div className="cell-sub" style={{ fontWeight: 400 }}>Raw 0–50</div>
                    </th>
                    <th className="nowrap" style={{ width: 128 }}>
                      Final Score
                      <div className="cell-sub" style={{ fontWeight: 400 }}>(L+S+R) × 10 ÷ 3</div>
                    </th>
                    <th>Status Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {pesertaTampil.map((p) => {
                    const hadirMeta = p.status_kehadiran
                      ? (STATUS_KEHADIRAN[p.status_kehadiran] || { label: p.status_kehadiran, badge: 'badge-muted' })
                      : { label: 'Belum tercatat', badge: 'badge-muted' };

                    const baris = draft[p.id_pendaftaran] || {
                      raw_listening: toStr(p.raw_listening),
                      raw_structure: toStr(p.raw_structure),
                      raw_reading: toStr(p.raw_reading),
                    };
                    const ev = evaluasiPerPeserta.get(p.id_pendaftaran);
                    const convL = p.bisa_dinilai ? ev?.convL : p.nilai_listening;
                    const convS = p.bisa_dinilai ? ev?.convS : p.nilai_structure;
                    const convR = p.bisa_dinilai ? ev?.convR : p.nilai_reading;
                    const finalPreview = p.bisa_dinilai ? ev?.finalScore : p.skor_toefl;
                    const adaIsi = Boolean(baris.raw_listening || baris.raw_structure || baris.raw_reading);

                    return (
                      <tr key={p.id_pendaftaran} className={ev?.berubah ? 'is-berubah' : ''}>
                        <td>
                          <p className="cell-title">{p.nama_lengkap || '—'}</p>
                          <p className="cell-sub">
                            {[p.nim || `ID #${p.id_pendaftaran}`, p.program_studi].filter(Boolean).join(' · ')}
                          </p>
                          {!p.bisa_dinilai && p.alasan_terkunci && (
                            <p className="cell-sub" style={{ color: p.sertifikat_terbit ? '#b45309' : 'var(--muted)', marginTop: 2 }}>
                              {p.alasan_terkunci}
                            </p>
                          )}
                          {p.bisa_dinilai && ev && !ev.valid && (
                            <p className="field-error" style={{ margin: '4px 0 0', fontSize: '0.76rem' }}>
                              {ev.error}
                            </p>
                          )}
                        </td>

                        <td className="nowrap">
                          <span className={`badge ${hadirMeta.badge}`}>{hadirMeta.label}</span>
                        </td>

                        <td>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="input input-plain"
                              aria-label={`Raw Score Listening ${p.nama_lengkap}`}
                              placeholder="0–50"
                              value={baris.raw_listening}
                              onChange={(e) => updateField(p, 'raw_listening', e.target.value)}
                              disabled={!p.bisa_dinilai || saving}
                              style={{ width: '96px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                            />
                            <span className="cell-sub" style={{ fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums' }}>
                              Konversi: <strong style={{ color: 'var(--brand-900)' }}>{formatAngka(convL)}</strong>
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="input input-plain"
                              aria-label={`Raw Score Structure ${p.nama_lengkap}`}
                              placeholder="0–40"
                              value={baris.raw_structure}
                              onChange={(e) => updateField(p, 'raw_structure', e.target.value)}
                              disabled={!p.bisa_dinilai || saving}
                              style={{ width: '96px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                            />
                            <span className="cell-sub" style={{ fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums' }}>
                              Konversi: <strong style={{ color: 'var(--brand-900)' }}>{formatAngka(convS)}</strong>
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="input input-plain"
                              aria-label={`Raw Score Reading ${p.nama_lengkap}`}
                              placeholder="0–50"
                              value={baris.raw_reading}
                              onChange={(e) => updateField(p, 'raw_reading', e.target.value)}
                              disabled={!p.bisa_dinilai || saving}
                              style={{ width: '96px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                            />
                            <span className="cell-sub" style={{ fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums' }}>
                              Konversi: <strong style={{ color: 'var(--brand-900)' }}>{formatAngka(convR)}</strong>
                            </span>
                          </div>
                        </td>

                        <td className="nowrap" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <strong style={{ fontSize: '1.05rem', color: 'var(--brand-900)' }}>
                            {formatAngka(finalPreview)}
                          </strong>
                        </td>

                        <td className="nowrap">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {p.sertifikat_terbit ? (
                              <span
                                className="badge badge-warning"
                                title={p.no_sertifikat ? `Sertifikat ${p.no_sertifikat} sudah terbit` : 'Sertifikat telah diterbitkan'}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <Icon name="lock" size={12} /> Sertifikat terbit
                              </span>
                            ) : p.status_kehadiran !== 'hadir' ? (
                              <span className="badge badge-muted">Tidak hadir</span>
                            ) : finalPreview !== null ? (
                              <span className="badge badge-success">Sudah dinilai</span>
                            ) : (
                              <span className="badge badge-muted">Belum dinilai</span>
                            )}

                            {p.bisa_dinilai && adaIsi && (
                              <button
                                type="button"
                                className="icon-action"
                                title={`Kosongkan nilai ${p.nama_lengkap}`}
                                aria-label={`Kosongkan nilai ${p.nama_lengkap}`}
                                onClick={() => kosongkanBaris(p)}
                                disabled={saving}
                              >
                                <Icon name="x" size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Action bar simpan massal */}
          {detail.peserta.length > 0 && sesi.bisa_dinilai && (
            <div
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ fontSize: '0.84rem', color: errorBarisCount > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                {errorBarisCount > 0 ? (
                  <span>Terdapat <strong>{errorBarisCount}</strong> baris Raw Score yang belum valid. Perbaiki sebelum menyimpan.</span>
                ) : berubahList.length > 0 ? (
                  <span><strong>{berubahList.length}</strong> peserta memiliki perubahan nilai yang belum disimpan.</span>
                ) : (
                  <span>Semua nilai tersimpan. Masukkan Raw Score Listening, Structure, dan Reading lalu klik Simpan Nilai.</span>
                )}
              </div>

              <div className="action-group">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResetPerubahan}
                  disabled={saving || berubahList.length === 0}
                >
                  <Icon name="refresh" size={15} /> Reset perubahan
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || berubahList.length === 0 || errorBarisCount > 0}
                >
                  <Icon name="check" size={16} />
                  {saving ? 'Menyimpan...' : `Simpan Nilai${berubahList.length > 0 ? ` (${berubahList.length})` : ''}`}
                </button>
              </div>
            </div>
          )}
        </form>
      </section>
    </>
  );
}

export default ToeflNilaiSesiPage;
