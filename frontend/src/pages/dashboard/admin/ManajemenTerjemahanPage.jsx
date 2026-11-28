/**
 * #62 — Manajemen Penerjemahan (Workspace Staf / Admin UPT)
 *
 * Tab 1 · Pesanan Baru  — unduh dok mentah, input biaya final → terbitkan tagihan
 * Tab 2 · Verifikasi Bayar — pantau pesanan yang sudah upload bukti bayar (link ke #66)
 * Tab 3 · Alokasi Penerjemah — assign 1 penerjemah per pesanan, relasi 1:1 (#35)
 *
 * Koneksi API real + fallback mock interaktif agar bisa demo/screenshot tanpa backend.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import {
  EmptyState, PageHeader, Panel, StatGrid,
} from '../../../components/dashboard/Widgets.jsx';

/* ─── MOCK FALLBACK (dipakai jika API belum ready) ───────────────────────── */
const MOCK_PESANAN = [
  {
    id_terjemahan: 'TRJ-001', pemohon: { nama_lengkap: 'Rina Aulia Putri', nim: '2110003411' },
    tarif_penerjemahan: { jenis_dokumen: 'Tersumpah', bahasa_asal: 'Indonesia', bahasa_tujuan: 'Inggris' },
    judul_dokumen: 'Ijazah S1 Teknik Informatika', jumlah_halaman: 4,
    catatan_pemohon: 'Untuk beasiswa LPDP', tanggal_ajuan: '2026-11-18T10:00:00Z',
    status: 'menunggu_pengecekan', biaya_estimasi: 320000, biaya_final: null,
    file_dokumen_url: null, bukti_bayar_url: null, penerjemah: null,
  },
  {
    id_terjemahan: 'TRJ-002', pemohon: { nama_lengkap: 'Budi Santoso', nim: '2010001234' },
    tarif_penerjemahan: { jenis_dokumen: 'Biasa', bahasa_asal: 'Indonesia', bahasa_tujuan: 'Inggris' },
    judul_dokumen: 'Transkrip Nilai Sarjana', jumlah_halaman: 8,
    catatan_pemohon: '', tanggal_ajuan: '2026-11-19T09:00:00Z',
    status: 'menunggu_pengecekan', biaya_estimasi: 480000, biaya_final: null,
    file_dokumen_url: null, bukti_bayar_url: null, penerjemah: null,
  },
  {
    id_terjemahan: 'TRJ-003', pemohon: { nama_lengkap: 'Siti Mardiah', nim: '2110005678' },
    tarif_penerjemahan: { jenis_dokumen: 'Biasa', bahasa_asal: 'Indonesia', bahasa_tujuan: 'Arab' },
    judul_dokumen: 'Surat Rekomendasi Dosen', jumlah_halaman: 2,
    catatan_pemohon: 'Urgent — butuh 3 hari', tanggal_ajuan: '2026-11-17T14:00:00Z',
    status: 'menunggu_verifikasi', biaya_estimasi: 160000, biaya_final: 175000,
    file_dokumen_url: '#', bukti_bayar_url: '#', penerjemah: null,
  },
  {
    id_terjemahan: 'TRJ-004', pemohon: { nama_lengkap: 'Ahmad Fauzi', nim: '1910009999' },
    tarif_penerjemahan: { jenis_dokumen: 'Biasa', bahasa_asal: 'Indonesia', bahasa_tujuan: 'Inggris' },
    judul_dokumen: 'Abstrak Skripsi', jumlah_halaman: 3,
    catatan_pemohon: '', tanggal_ajuan: '2026-11-15T08:00:00Z',
    status: 'terverifikasi', biaya_estimasi: 240000, biaya_final: 250000,
    file_dokumen_url: '#', bukti_bayar_url: '#', penerjemah: null,
  },
];

const MOCK_PENERJEMAH = [
  { id_pengguna: 'P01', nama_lengkap: 'Dr. Yusuf Hamdan, M.Hum', job_aktif: 1 },
  { id_pengguna: 'P02', nama_lengkap: 'Nadia Fitri, S.S.', job_aktif: 0 },
  { id_pengguna: 'P03', nama_lengkap: 'Reza Putra, M.Pd.', job_aktif: 2 },
];

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */
const rupiah = (n) => n == null
  ? 'Belum ditentukan'
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n));

const tgl = (iso) => iso
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—';

const STATUS_CFG = {
  menunggu_pengecekan: { label: 'Menunggu Pengecekan', cls: 'badge-warning' },
  menunggu_pembayaran: { label: 'Tagihan Terbit', cls: 'badge-accent' },
  menunggu_verifikasi: { label: 'Bukti Bayar Masuk', cls: 'badge-warning' },
  terverifikasi:       { label: 'Siap Dialokasikan', cls: 'badge-success' },
  dialokasikan:        { label: 'Dialokasikan', cls: 'badge-accent' },
  dikerjakan:          { label: 'Sedang Diproses', cls: 'badge-accent' },
  selesai:             { label: 'Selesai', cls: 'badge-success' },
  dibatalkan:          { label: 'Dibatalkan', cls: 'badge-danger' },
};

function Badge({ status }) {
  const c = STATUS_CFG[status] || { label: status, cls: 'badge-muted' };
  return <span className={`badge ${c.cls}`} style={{ fontSize: '0.72rem' }}>{c.label}</span>;
}

function RowKV({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--muted)', fontSize: '0.79rem', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

/* ─── TAB BAR ─────────────────────────────────────────────────────────────── */
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--line)', marginBottom: 20 }}>
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
          padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
          fontWeight: active === t.id ? 700 : 400,
          color: active === t.id ? 'var(--brand-800)' : 'var(--muted)',
          borderBottom: active === t.id ? '2px solid var(--brand-800)' : '2px solid transparent',
          marginBottom: -2, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {t.icon && <Icon name={t.icon} size={14} />}
          {t.label}
          {t.count != null && (
            <span style={{
              background: active === t.id ? 'var(--brand-800)' : 'var(--line)',
              color: active === t.id ? '#fff' : 'var(--muted)',
              borderRadius: 99, fontSize: '0.68rem', padding: '1px 7px', fontWeight: 700,
            }}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 1 — PESANAN BARU
   Staf unduh dokumen mentah → input Total Biaya Final → terbitkan tagihan
   ═══════════════════════════════════════════════════════════════════════════*/
function TabPesananBaru({ pesanan, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [biaya, setBiaya]       = useState('');
  const [confirm, setConfirm]   = useState(false);
  const [loading, setLoading]   = useState(false);

  const list = pesanan.filter((p) => p.status === 'menunggu_pengecekan');

  const buka  = (p) => { setSelected(p); setBiaya(p.biaya_estimasi ?? ''); setConfirm(false); };
  const tutup = () => { setSelected(null); setBiaya(''); setConfirm(false); };

  const handleTerbitkan = async () => {
    if (!biaya || isNaN(biaya) || Number(biaya) <= 0) return;
    if (!confirm) { setConfirm(true); return; }
    setLoading(true);
    try {
      await api.patch(`/terjemahan/${selected.id_terjemahan}/status`, {
        status: 'menunggu_pembayaran',
        biaya_final: Number(biaya),
      });
      toast.success('Tagihan berhasil diterbitkan!');
      tutup();
      onRefresh();
    } catch {
      // fallback mock
      toast.success(`[MOCK] Tagihan ${rupiah(Number(biaya))} diterbitkan untuk ${selected.judul_dokumen}.`);
      tutup();
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  if (list.length === 0) return (
    <EmptyState icon="file" title="Tidak ada pesanan baru"
      text="Pesanan baru akan muncul di sini saat pemohon mengajukan dokumen." />
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {list.map((p) => (
        <div key={p.id_terjemahan} style={{
          background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          padding: '14px 16px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'grid', gap: 5, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--brand-900)' }}>{p.judul_dokumen}</strong>
              <Badge status={p.status} />
              <span className="badge badge-muted" style={{ fontSize: '0.68rem' }}>
                {p.tarif_penerjemahan?.jenis_dokumen}
              </span>
            </div>
            <RowKV label="Pemohon" value={`${p.pemohon?.nama_lengkap} (${p.pemohon?.nim ?? '—'})`} />
            <RowKV label="Bahasa" value={`${p.tarif_penerjemahan?.bahasa_asal} → ${p.tarif_penerjemahan?.bahasa_tujuan}`} />
            <RowKV label="Halaman" value={`${p.jumlah_halaman ?? '—'} hal.`} />
            <RowKV label="Tanggal Ajuan" value={tgl(p.tanggal_ajuan)} />
            <RowKV label="Estimasi Awal" value={rupiah(p.biaya_estimasi)} />
            {p.catatan_pemohon && <RowKV label="Catatan" value={p.catatan_pemohon} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
            <button type="button" className="btn btn-soft" style={{ fontSize: '0.8rem' }}
              onClick={() => { if (p.file_dokumen_url && p.file_dokumen_url !== '#') window.open(p.file_dokumen_url); else alert('[MOCK] Mengunduh dokumen mentah...'); }}>
              <Icon name="upload" size={14} /> Unduh Dokumen
            </button>
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => buka(p)}>
              <Icon name="wallet" size={14} /> Terbitkan Tagihan
            </button>
          </div>
        </div>
      ))}

      {/* Modal Terbitkan Tagihan */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', color: 'var(--brand-900)' }}>Terbitkan Tagihan</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '0.82rem' }}>
              {selected.judul_dokumen} — {selected.pemohon?.nama_lengkap}
            </p>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'grid', gap: 6 }}>
              <RowKV label="Jenis" value={selected.tarif_penerjemahan?.jenis_dokumen} />
              <RowKV label="Bahasa" value={`${selected.tarif_penerjemahan?.bahasa_asal} → ${selected.tarif_penerjemahan?.bahasa_tujuan}`} />
              <RowKV label="Halaman" value={`${selected.jumlah_halaman} hal.`} />
              <RowKV label="Estimasi AI" value={rupiah(selected.biaya_estimasi)} />
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.85rem' }}>
              Total Biaya Final (Rp) *
            </label>
            <input type="number" value={biaya} onChange={(e) => { setBiaya(e.target.value); setConfirm(false); }}
              placeholder="masukkan biaya setelah diperiksa"
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box', marginBottom: 4 }} />
            <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Tagihan akan dikirim ke akun pemohon setelah dikonfirmasi.
            </p>
            {confirm && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.82rem', color: '#92400e' }}>
                ⚠ Konfirmasi: Tagihan sebesar <strong>{rupiah(Number(biaya))}</strong> akan diterbitkan dan tidak bisa diubah. Lanjutkan?
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-soft" style={{ flex: 1 }} onClick={tutup}>Batal</button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }}
                onClick={handleTerbitkan} disabled={loading || !biaya || isNaN(biaya) || Number(biaya) <= 0}>
                {loading ? 'Memproses...' : confirm ? '✓ Ya, Terbitkan' : 'Terbitkan Tagihan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2 — VERIFIKASI PEMBAYARAN (#66 — link ke VerifikasiPembayaranPage)
   ═══════════════════════════════════════════════════════════════════════════*/
function TabVerifikasiBayar({ pesanan, onRefresh }) {
  const [loadingId, setLoadingId] = useState(null);
  const list = pesanan.filter((p) => p.status === 'menunggu_verifikasi');

  const verifikasi = async (id, setuju) => {
    setLoadingId(id + setuju);
    try {
      await api.patch(`/terjemahan/${id}/status`, {
        status: setuju ? 'terverifikasi' : 'menunggu_pembayaran',
      });
      toast.success(setuju ? 'Pembayaran diverifikasi!' : 'Pembayaran ditolak.');
      onRefresh();
    } catch {
      toast.success(setuju
        ? '[MOCK] Pembayaran diverifikasi, pesanan siap dialokasikan.'
        : '[MOCK] Pembayaran ditolak, pemohon diminta upload ulang.');
      onRefresh();
    } finally {
      setLoadingId(null);
    }
  };

  if (list.length === 0) return (
    <EmptyState icon="wallet" title="Tidak ada bukti bayar masuk"
      text="Pesanan yang sudah upload bukti bayar akan tampil di sini." />
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {list.map((p) => (
        <div key={p.id_terjemahan} style={{
          background: 'var(--bg)', border: '1px solid #fcd34d', borderRadius: 'var(--radius)',
          padding: '14px 16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'grid', gap: 5, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ color: 'var(--brand-900)' }}>{p.judul_dokumen}</strong>
              <Badge status={p.status} />
            </div>
            <RowKV label="Pemohon" value={`${p.pemohon?.nama_lengkap} (${p.pemohon?.nim ?? '—'})`} />
            <RowKV label="Bahasa" value={`${p.tarif_penerjemahan?.bahasa_asal} → ${p.tarif_penerjemahan?.bahasa_tujuan}`} />
            <RowKV label="Total Tagihan" value={rupiah(p.biaya_final)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 170 }}>
            <button type="button" className="btn btn-soft" style={{ fontSize: '0.8rem' }}
              onClick={() => { if (p.bukti_bayar_url && p.bukti_bayar_url !== '#') window.open(p.bukti_bayar_url); else alert('[MOCK] Membuka bukti pembayaran...'); }}>
              <Icon name="upload" size={14} /> Lihat Bukti Bayar
            </button>
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem' }}
              disabled={loadingId === p.id_terjemahan + true} onClick={() => verifikasi(p.id_terjemahan, true)}>
              {loadingId === p.id_terjemahan + true ? 'Memproses...' : '✓ Verifikasi & Setujui'}
            </button>
            <button type="button" className="btn btn-soft" style={{ fontSize: '0.8rem', color: '#dc2626' }}
              disabled={loadingId === p.id_terjemahan + false} onClick={() => verifikasi(p.id_terjemahan, false)}>
              {loadingId === p.id_terjemahan + false ? 'Memproses...' : '✗ Tolak'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 3 — ALOKASI PENERJEMAH (#35, relasi 1:1)
   ═══════════════════════════════════════════════════════════════════════════*/
function TabAlokasi({ pesanan, penerjemah, onRefresh }) {
  const [pilihan, setPilihan] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const list = pesanan.filter((p) => p.status === 'terverifikasi');

  const alokasi = async (pesananId) => {
    const pid = pilihan[pesananId];
    if (!pid) return;
    setLoadingId(pesananId);
    try {
      await api.post(`/terjemahan/${pesananId}/alokasi`, { id_penerjemah: pid });
      toast.success('Penerjemah berhasil dialokasikan!');
      setPilihan((prev) => { const n = { ...prev }; delete n[pesananId]; return n; });
      onRefresh();
    } catch {
      const pj = penerjemah.find((x) => x.id_pengguna === pid);
      toast.success(`[MOCK] Pesanan dialokasikan ke ${pj?.nama_lengkap}.`);
      setPilihan((prev) => { const n = { ...prev }; delete n[pesananId]; return n; });
      onRefresh();
    } finally {
      setLoadingId(null);
    }
  };

  if (list.length === 0) return (
    <EmptyState icon="users" title="Belum ada pesanan siap dialokasikan"
      text="Pesanan yang sudah diverifikasi pembayarannya akan tampil di sini." />
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {list.map((p) => (
        <div key={p.id_terjemahan} style={{
          background: 'var(--bg)', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)',
          padding: '14px 16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'grid', gap: 5, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ color: 'var(--brand-900)' }}>{p.judul_dokumen}</strong>
              <Badge status={p.status} />
            </div>
            <RowKV label="Pemohon" value={`${p.pemohon?.nama_lengkap} (${p.pemohon?.nim ?? '—'})`} />
            <RowKV label="Bahasa" value={`${p.tarif_penerjemahan?.bahasa_asal} → ${p.tarif_penerjemahan?.bahasa_tujuan}`} />
            <RowKV label="Halaman" value={`${p.jumlah_halaman} hal.`} />
            <RowKV label="Jenis" value={p.tarif_penerjemahan?.jenis_dokumen} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pilih Penerjemah (1:1)</label>
            <select value={pilihan[p.id_terjemahan] || ''} onChange={(e) => setPilihan((prev) => ({ ...prev, [p.id_terjemahan]: e.target.value }))}
              style={{ padding: '8px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: '0.82rem', background: '#fff' }}>
              <option value="">— Pilih penerjemah —</option>
              {penerjemah.map((pj) => (
                <option key={pj.id_pengguna} value={pj.id_pengguna}>
                  {pj.nama_lengkap} ({pj.job_aktif ?? 0} aktif)
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem' }}
              disabled={!pilihan[p.id_terjemahan] || loadingId === p.id_terjemahan}
              onClick={() => alokasi(p.id_terjemahan)}>
              <Icon name="user" size={14} />
              {loadingId === p.id_terjemahan ? 'Mengalokasikan...' : 'Alokasikan Penerjemah'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════*/
function ManajemenTerjemahanPage() {
  const [pesanan, setPesanan]       = useState(MOCK_PESANAN);
  const [penerjemah, setPenerjemah] = useState(MOCK_PENERJEMAH);
  const [activeTab, setActiveTab]   = useState('baru');
  const [loading, setLoading]       = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resPesanan, resPenerjemah] = await Promise.all([
        api.get('/terjemahan/admin/pesanan'),
        api.get('/terjemahan/admin/penerjemah'),
      ]);
      if (resPesanan.data?.data?.length) setPesanan(resPesanan.data.data);
      if (resPenerjemah.data?.data?.length) setPenerjemah(resPenerjemah.data.data);
    } catch {
      // pakai mock fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const cBaru    = pesanan.filter((p) => p.status === 'menunggu_pengecekan').length;
  const cVerif   = pesanan.filter((p) => p.status === 'menunggu_verifikasi').length;
  const cAlokasi = pesanan.filter((p) => p.status === 'terverifikasi').length;
  const cProses  = pesanan.filter((p) => ['dialokasikan', 'dikerjakan'].includes(p.status)).length;

  const TABS = [
    { id: 'baru',    label: 'Pesanan Baru',       icon: 'file',       count: cBaru },
    { id: 'verif',   label: 'Verifikasi Bayar',   icon: 'wallet',     count: cVerif },
    { id: 'alokasi', label: 'Alokasi Penerjemah', icon: 'users',      count: cAlokasi },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Workspace Staf UPT / Penerjemahan"
        title="Manajemen Penerjemahan"
        subtitle="Tinjau dokumen pesanan baru, terbitkan tagihan biaya final, verifikasi pembayaran, dan alokasikan penerjemah."
      />

      <StatGrid items={[
        { label: 'Pesanan Baru',       icon: 'file',      value: cBaru,    hint: 'Menunggu pengecekan staf' },
        { label: 'Menunggu Verifikasi', icon: 'wallet',    value: cVerif,   hint: 'Bukti bayar masuk' },
        { label: 'Siap Dialokasikan',  icon: 'users',     value: cAlokasi, hint: 'Pembayaran lunas' },
        { label: 'Sedang Diproses',    icon: 'languages', value: cProses,  hint: 'Dalam pengerjaan' },
      ]} />

      <Panel title="Daftar Pesanan Penerjemahan" icon="languages"
        subtitle="Kelola seluruh alur pesanan dari masuk hingga dialokasikan ke penerjemah">
        {loading ? (
          <p style={{ padding: 16, color: 'var(--muted)', textAlign: 'center' }}>Memuat data pesanan...</p>
        ) : (
          <>
            <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
            {activeTab === 'baru'    && <TabPesananBaru    pesanan={pesanan} onRefresh={loadData} />}
            {activeTab === 'verif'   && <TabVerifikasiBayar pesanan={pesanan} onRefresh={loadData} />}
            {activeTab === 'alokasi' && <TabAlokasi        pesanan={pesanan} penerjemah={penerjemah} onRefresh={loadData} />}
          </>
        )}
      </Panel>

      {/* Panel pesanan sedang diproses */}
      {pesanan.filter((p) => ['dialokasikan', 'dikerjakan'].includes(p.status)).length > 0 && (
        <Panel title="Sedang Diproses" icon="languages" subtitle="Job order yang sudah diteruskan ke penerjemah">
          <div style={{ display: 'grid', gap: 10 }}>
            {pesanan.filter((p) => ['dialokasikan', 'dikerjakan'].includes(p.status)).map((p) => (
              <div key={p.id_terjemahan} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)',
              }}>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--brand-900)' }}>{p.judul_dokumen}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    {p.pemohon?.nama_lengkap} · {p.tarif_penerjemahan?.bahasa_asal} → {p.tarif_penerjemahan?.bahasa_tujuan}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {p.penerjemah && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Penerjemah: <strong>{p.penerjemah?.nama_lengkap ?? p.penerjemah}</strong>
                    </span>
                  )}
                  <Badge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

export default ManajemenTerjemahanPage;
