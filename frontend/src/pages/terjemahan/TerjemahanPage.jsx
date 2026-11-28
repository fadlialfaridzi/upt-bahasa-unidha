/**
 * TerjemahanPage.jsx
 *
 * #23 — AI Estimator Biaya & Waktu (sebelum upload file)
 * #61 — Pendaftaran Penerjemahan (peserta)
 *       Status awal setelah submit: "menunggu_pengecekan" (tagihan BELUM terbit otomatis)
 */

import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';

/* ─── TARIF & MULTIPLIER (#23 — AI Estimator) ───────────────────────────── */
const TARIF = {
  Biasa:     { base: 35000, perHal: 25000 },
  Tersumpah: { base: 75000, perHal: 60000 },
  Legalisir: { base: 50000, perHal: 40000 },
};
const MULTIPLIER = {
  'Indonesia → Inggris':  1.0,
  'Inggris → Indonesia':  1.0,
  'Indonesia → Arab':     1.4,
  'Indonesia → Mandarin': 1.5,
  'Indonesia → Jepang':   1.5,
  'Indonesia → Prancis':  1.3,
  'Indonesia → Jerman':   1.3,
};
const DURASI_PER_HAL = { Biasa: 0.6, Tersumpah: 1.0, Legalisir: 0.8 };
const JENIS_OPTIONS   = Object.keys(TARIF);
const PASANGAN_OPTIONS = Object.keys(MULTIPLIER);
const BAHASA = ['Indonesia', 'Inggris', 'Arab', 'Mandarin', 'Jepang', 'Prancis', 'Jerman'];

const rupiah = (n) => n == null ? '—'
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n));

function hitungEstimasi(halaman, jenis, pasangan) {
  if (!halaman || !jenis || !pasangan || !TARIF[jenis]) return null;
  const h    = Math.max(1, parseInt(halaman, 10));
  const mult = MULTIPLIER[pasangan] ?? 1;
  const min  = Math.ceil((TARIF[jenis].base + TARIF[jenis].perHal * h) * mult);
  return { min, max: Math.ceil(min * 1.15), durasi: Math.max(1, Math.ceil(h * DURASI_PER_HAL[jenis])) };
}

/* ─── SHARED STYLES ──────────────────────────────────────────────────────── */
const inp = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #cbd5e1',
  borderRadius: 8, fontSize: '0.92rem', boxSizing: 'border-box', background: '#fff',
};
const lbl = { display: 'block', marginBottom: 5, fontWeight: 600, fontSize: '0.83rem', color: '#374151' };

/* ─── KOMPONEN: AI ESTIMATOR ─────────────────────────────────────────────── */
function AIEstimator({ halaman, jenis, pasangan, onLanjut }) {
  const est = useMemo(() => hitungEstimasi(halaman, jenis, pasangan), [halaman, jenis, pasangan]);

  return (
    <div style={{ background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: '18px 20px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ background: '#1d4ed8', color: '#fff', borderRadius: 8, width: 32, height: 32, display: 'grid', placeItems: 'center', fontSize: '0.9rem', flexShrink: 0 }}>✦</span>
        <div>
          <strong style={{ fontSize: '0.9rem', color: '#1e3a5f' }}>AI Estimator Biaya &amp; Waktu</strong>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Perkiraan sebelum mengunggah file — tidak mengikat</p>
        </div>
      </div>

      {!(halaman && jenis && pasangan) ? (
        <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>
          Isi jumlah halaman, jenis layanan, dan pasangan bahasa untuk melihat estimasi.
        </p>
      ) : !est ? (
        <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>Kombinasi bahasa belum tersedia.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Estimasi Biaya', value: `${rupiah(est.min)} – ${rupiah(est.max)}`, sub: 'Biaya final ditentukan staf UPT', color: '#1d4ed8', bg: '#dbeafe' },
              { label: 'Estimasi Durasi', value: `${est.durasi} hari kerja`, sub: 'Sejak diterima & diverifikasi', color: '#059669', bg: '#d1fae5' },
              { label: 'Per Halaman (min)', value: rupiah(Math.ceil(est.min / Math.max(1, parseInt(halaman, 10)))), sub: `${halaman} hal. × ${jenis}`, color: '#7c3aed', bg: '#ede9fe' },
            ].map((c) => (
              <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>{c.label}</p>
                <p style={{ margin: '0 0 2px', fontSize: '0.88rem', fontWeight: 700, color: c.color }}>{c.value}</p>
                <p style={{ margin: 0, fontSize: '0.68rem', color: '#9ca3af' }}>{c.sub}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
              ⚠ Estimasi indikatif. Biaya final ditetapkan staf setelah dokumen diperiksa.
            </p>
            {onLanjut && (
              <button type="button" onClick={onLanjut}
                style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                Lanjut ke Form →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── KOMPONEN: STATUS TRACKER ───────────────────────────────────────────── */
const STEPS = [
  { key: 'menunggu_pengecekan', label: 'Dikirim' },
  { key: 'menunggu_pembayaran', label: 'Tagihan Terbit' },
  { key: 'menunggu_verifikasi', label: 'Bayar' },
  { key: 'terverifikasi',       label: 'Diverifikasi' },
  { key: 'dikerjakan',          label: 'Diterjemahkan' },
  { key: 'selesai',             label: 'Selesai' },
];

function StatusTracker({ status }) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 4 }}>
      {STEPS.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
              background: i < idx ? '#16a34a' : i === idx ? '#1d4ed8' : '#e5e7eb',
              color: i <= idx ? '#fff' : '#9ca3af', fontSize: '0.72rem', fontWeight: 700,
            }}>{i < idx ? '✓' : i + 1}</div>
            <p style={{ margin: '4px 0 0', fontSize: '0.6rem', textAlign: 'center',
              color: i === idx ? '#1d4ed8' : i < idx ? '#16a34a' : '#9ca3af',
              fontWeight: i === idx ? 700 : 400 }}>{s.label}</p>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ height: 2, flex: 0.5, background: i < idx ? '#16a34a' : '#e5e7eb', marginBottom: 18 }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── MOCK RIWAYAT ───────────────────────────────────────────────────────── */
const MOCK_RIWAYAT = [
  {
    id_pesanan: 'TRJ-000', judul_dokumen: 'Surat Keterangan Aktif',
    tarif_penerjemahan: { bahasa_asal: 'Indonesia', bahasa_tujuan: 'Inggris', jenis_dokumen: 'Biasa' },
    tanggal_ajuan: '2026-11-10T08:00:00Z', status: 'menunggu_pengecekan',
    biaya_estimasi: 160000, biaya_final: null,
  },
];

const STATUS_LABEL = {
  menunggu_pengecekan: { label: 'Menunggu Pengecekan Staf', cls: 'badge-warning' },
  menunggu_pembayaran: { label: 'Tagihan Terbit', cls: 'badge-accent' },
  menunggu_verifikasi: { label: 'Menunggu Verifikasi Bayar', cls: 'badge-warning' },
  terverifikasi:       { label: 'Pembayaran Terverifikasi', cls: 'badge-success' },
  dialokasikan:        { label: 'Penerjemah Ditugaskan', cls: 'badge-accent' },
  dikerjakan:          { label: 'Sedang Diterjemahkan', cls: 'badge-accent' },
  selesai:             { label: 'Selesai', cls: 'badge-success' },
  dibatalkan:          { label: 'Dibatalkan', cls: 'badge-danger' },
};

const tglFmt = (iso) => iso
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—';

/* ─── MAIN PAGE ──────────────────────────────────────────────────────────── */
function TerjemahanPage() {
  /* Estimator state — bisa dishare ke form */
  const [halaman,  setHalaman]  = useState('');
  const [jenis,    setJenis]    = useState('');
  const [pasangan, setPasangan] = useState('');

  /* Form state */
  const [form, setForm] = useState({
    judulDokumen: '', bahasaAsal: '', bahasaTujuan: '', jenis: '', halaman: '', catatan: '',
  });
  const [file,      setFile]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [riwayat,   setRiwayat]   = useState(MOCK_RIWAYAT);
  const [tab,       setTab]       = useState('estimator');

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  /* Sync estimator → form & pindah ke tab form */
  const lanjutKeForm = () => {
    setForm((p) => ({ ...p, jenis: jenis || p.jenis, halaman: halaman || p.halaman }));
    setTab('daftar');
  };

  /* Pasangan untuk estimator dalam tab form */
  const pasanganForm = form.bahasaAsal && form.bahasaTujuan
    ? `${form.bahasaAsal} → ${form.bahasaTujuan}` : pasangan;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('dokumen', file);
      const res = await api.post('/terjemahan/ajukan', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const baru = res.data?.data;
      if (baru) setRiwayat((p) => [baru, ...p]);
      toast.success('Pengajuan berhasil! Staf UPT akan memeriksa dokumen Anda.');
      setSubmitted(true);
      setForm({ judulDokumen: '', bahasaAsal: '', bahasaTujuan: '', jenis: '', halaman: '', catatan: '' });
      setFile(null);
      setTimeout(() => { setSubmitted(false); setTab('riwayat'); }, 1800);
    } catch {
      /* fallback mock */
      const baru = {
        id_pesanan: `TRJ-${String(Date.now()).slice(-4)}`,
        judul_dokumen: form.judulDokumen,
        tarif_penerjemahan: { bahasa_asal: form.bahasaAsal, bahasa_tujuan: form.bahasaTujuan, jenis_dokumen: form.jenis },
        tanggal_ajuan: new Date().toISOString(),
        status: 'menunggu_pengecekan',
        biaya_estimasi: hitungEstimasi(form.halaman, form.jenis, `${form.bahasaAsal} → ${form.bahasaTujuan}`)?.min ?? 0,
        biaya_final: null,
      };
      setRiwayat((p) => [baru, ...p]);
      toast.success('Pengajuan berhasil dikirim! Staf UPT akan memeriksa dokumen Anda.');
      setSubmitted(true);
      setForm({ judulDokumen: '', bahasaAsal: '', bahasaTujuan: '', jenis: '', halaman: '', catatan: '' });
      setFile(null);
      setTimeout(() => { setSubmitted(false); setTab('riwayat'); }, 1800);
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: 'estimator', label: '✦ Estimasi Biaya' },
    { id: 'daftar',    label: '📄 Form Pendaftaran' },
    { id: 'riwayat',   label: `📋 Riwayat (${riwayat.length})` },
  ];

  return (
    <div style={{ maxWidth: 760, margin: '2.5rem auto', padding: '0 1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Layanan UPT Bahasa
        </p>
        <h1 style={{ margin: '4px 0', color: '#1e3a5f', fontSize: '1.6rem', fontWeight: 800 }}>
          Jasa Penerjemahan Dokumen
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.88rem' }}>
          Ajukan dokumen Anda untuk diterjemahkan oleh penerjemah tersertifikasi UPT Bahasa UNIDHA.
        </p>
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
            padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? '#1e3a5f' : '#6b7280',
            borderBottom: tab === t.id ? '2px solid #1e3a5f' : '2px solid transparent',
            marginBottom: -2, fontSize: '0.85rem',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══ TAB: ESTIMATOR ══ */}
      {tab === 'estimator' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#1e3a5f' }}>✦ Estimasi Biaya &amp; Durasi</h2>
          <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '0.82rem' }}>
            Dapatkan perkiraan biaya sebelum mengisi form. Tidak perlu upload file dulu.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={lbl}>Jumlah Halaman</label>
              <input type="number" min="1" value={halaman} onChange={(e) => setHalaman(e.target.value)} placeholder="mis: 5" style={inp} />
            </div>
            <div>
              <label style={lbl}>Jenis Layanan</label>
              <select value={jenis} onChange={(e) => setJenis(e.target.value)} style={inp}>
                <option value="">Pilih jenis</option>
                {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Pasangan Bahasa</label>
              <select value={pasangan} onChange={(e) => setPasangan(e.target.value)} style={inp}>
                <option value="">Pilih pasangan</option>
                {PASANGAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <AIEstimator halaman={halaman} jenis={jenis} pasangan={pasangan} onLanjut={lanjutKeForm} />

          {/* Tabel tarif referensi */}
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>📋 Lihat tabel tarif referensi</summary>
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Jenis', 'Base Fee', 'Per Halaman', 'Mult. Arab', 'Mult. Mandarin/Jepang'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {JENIS_OPTIONS.map((j) => (
                    <tr key={j}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{j}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>{rupiah(TARIF[j].base)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>{rupiah(TARIF[j].perHal)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>×1.4</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>×1.5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* ══ TAB: FORM PENDAFTARAN ══ */}
      {tab === 'daftar' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#1e3a5f' }}>📄 Form Pendaftaran Penerjemahan</h2>
          <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '0.82rem' }}>
            Setelah dikirim, status akan menjadi{' '}
            <strong style={{ color: '#d97706' }}>Menunggu Pengecekan Staf</strong>.
            Tagihan diterbitkan setelah staf memeriksa dokumen Anda.
          </p>

          {/* Estimator ringkas di atas form */}
          {(form.halaman || halaman) && (form.jenis || jenis) && (
            <AIEstimator
              halaman={form.halaman || halaman}
              jenis={form.jenis || jenis}
              pasangan={pasanganForm}
            />
          )}

          {submitted && (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '1.4rem' }}>✅</span>
              <div>
                <strong style={{ color: '#15803d' }}>Pengajuan berhasil dikirim!</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#16a34a' }}>
                  Status: Menunggu Pengecekan Staf. Staf akan menghubungi Anda setelah dokumen diperiksa.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>Judul / Nama Dokumen *</label>
              <input type="text" name="judulDokumen" value={form.judulDokumen} onChange={handleChange} required
                placeholder="contoh: Ijazah S1, Transkrip Nilai, Surat Rekomendasi" style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Bahasa Asal *</label>
                <select name="bahasaAsal" value={form.bahasaAsal} onChange={handleChange} required style={inp}>
                  <option value="">Pilih bahasa</option>
                  {BAHASA.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Bahasa Tujuan *</label>
                <select name="bahasaTujuan" value={form.bahasaTujuan} onChange={handleChange} required style={inp}>
                  <option value="">Pilih bahasa</option>
                  {BAHASA.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Jenis Layanan *</label>
                <select name="jenis" value={form.jenis} onChange={(e) => { handleChange(e); setJenis(e.target.value); }} required style={inp}>
                  <option value="">Pilih jenis</option>
                  {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Jumlah Halaman (estimasi) *</label>
                <input type="number" name="halaman" min="1" max="500"
                  value={form.halaman} onChange={(e) => { handleChange(e); setHalaman(e.target.value); }}
                  placeholder="mis: 5" required style={inp} />
              </div>
            </div>

            {/* Upload dokumen */}
            <div>
              <label style={lbl}>Upload Dokumen (PDF/Word, maks 10 MB) *</label>
              <div onClick={() => document.getElementById('tjFileInput').click()} style={{
                border: '2px dashed #cbd5e1', borderRadius: 10, padding: 20, textAlign: 'center',
                cursor: 'pointer', background: file ? '#f0fdf4' : '#fafafa',
              }}>
                {file ? (
                  <div>
                    <span style={{ fontSize: '1.4rem' }}>📎</span>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>{file.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: '1.4rem' }}>☁️</span>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>Klik atau drag &amp; drop file</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>PDF, DOC, DOCX</p>
                  </div>
                )}
              </div>
              <input id="tjFileInput" type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files[0])} required />
            </div>

            <div>
              <label style={lbl}>Catatan Tambahan</label>
              <textarea name="catatan" value={form.catatan} onChange={handleChange} rows={3}
                placeholder="Urgensi, format khusus, instruksi untuk penerjemah..."
                style={{ ...inp, resize: 'vertical' }} />
            </div>

            {/* Info alur */}
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', fontSize: '0.8rem', color: '#78350f' }}>
              ℹ️ <strong>Alur:</strong> Dokumen dikirim → Staf UPT periksa → Tagihan diterbitkan → Anda bayar → Penerjemah mengerjakan → Hasil selesai.
            </div>

            <button type="submit" disabled={loading} style={{
              background: loading ? '#9ca3af' : '#1e3a5f', color: '#fff',
              padding: 12, borderRadius: 10, border: 'none', fontWeight: 700,
              fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '⏳ Mengirim...' : '📄 Kirim Pengajuan Terjemahan'}
            </button>
          </form>
        </div>
      )}

      {/* ══ TAB: RIWAYAT ══ */}
      {tab === 'riwayat' && (
        <div>
          {riwayat.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, padding: '40px 28px', textAlign: 'center', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: '2rem' }}>📋</p>
              <p style={{ color: '#374151', fontWeight: 600 }}>Belum ada pesanan</p>
              <p style={{ color: '#6b7280', fontSize: '0.82rem' }}>Riwayat pesanan penerjemahan Anda akan muncul di sini.</p>
              <button type="button" onClick={() => setTab('daftar')} style={{ marginTop: 12, background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                Ajukan Sekarang
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {riwayat.map((r) => {
                const sc = STATUS_LABEL[r.status] || { label: r.status, cls: 'badge-muted' };
                return (
                  <div key={r.id_pesanan} style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ color: '#1e3a5f' }}>{r.judul_dokumen}</strong>
                          <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 99 }}>{r.id_pesanan}</span>
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
                          {r.tarif_penerjemahan?.bahasa_asal} → {r.tarif_penerjemahan?.bahasa_tujuan} · {r.tarif_penerjemahan?.jenis_dokumen} · {tglFmt(r.tanggal_ajuan)}
                        </p>
                      </div>
                      <span className={`badge ${sc.cls}`} style={{ fontSize: '0.72rem' }}>{sc.label}</span>
                    </div>
                    <StatusTracker status={r.status} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                        Estimasi AI: <strong style={{ color: '#1e3a5f' }}>{rupiah(r.biaya_estimasi)}</strong>
                        {r.biaya_final && <> → Tagihan Final: <strong style={{ color: '#d97706' }}>{rupiah(r.biaya_final)}</strong></>}
                      </div>
                      {r.status === 'menunggu_pembayaran' && (
                        <button type="button" onClick={() => toast.info('Buka halaman tagihan untuk upload bukti bayar.')}
                          style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                          💳 Upload Bukti Bayar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-weight:600; }
        .badge-warning { background:#fef3c7; color:#d97706; }
        .badge-success { background:#d1fae5; color:#065f46; }
        .badge-accent  { background:#dbeafe; color:#1d4ed8; }
        .badge-muted   { background:#f1f5f9; color:#475569; }
        .badge-danger  { background:#fee2e2; color:#991b1b; }
      `}</style>
    </div>
  );
}

export default TerjemahanPage;
