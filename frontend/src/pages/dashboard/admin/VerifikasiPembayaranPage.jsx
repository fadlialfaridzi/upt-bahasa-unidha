// Validasi pembayaran (admin) - #67
import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import TinjauPembayaranModal from './TinjauPembayaranModal.jsx';
import { formatRupiah } from '../../../config/pelatihan.js';

const TAB = [
  { value: 'menunggu', label: 'Menunggu verifikasi' },
  { value: 'terverifikasi', label: 'Diterima' },
  { value: 'ditolak', label: 'Ditolak' },
];

const LAYANAN = { pelatihan: 'Pelatihan', toefl: 'TOEFL', penerjemahan: 'Penerjemahan' };

const waktu = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function VerifikasiPembayaranPage({ jenisLayanan = null }) {
  const [status, setStatus] = useState('menunggu');
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [jumlah, setJumlah] = useState({ menunggu: 0, terverifikasi: 0, ditolak: 0 });
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [tinjau, setTinjau] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setGagal(false);
    try {
      const res = await api.get('/pembayaran', {
        params: { status, q: q.trim() || undefined, jenis_layanan: jenisLayanan || undefined },
      });
      setList(res.data.data);
      setJumlah(res.data.jumlah);
    } catch {
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0); // debounce pencarian
    return () => clearTimeout(t);
  }, [load, q]);

  const selesaiTinjau = () => {
    setTinjau(null);
    load();
  };

  return (
    <>
      <PageHeader
        eyebrow={jenisLayanan === 'toefl' ? 'TOEFL / Pembayaran' : 'Tagihan & pembayaran'}
        title={jenisLayanan === 'toefl' ? 'Validasi Pembayaran TOEFL' : 'Verifikasi pembayaran'}
        subtitle={jenisLayanan === 'toefl'
          ? 'Tinjau bukti transfer peserta TOEFL, lalu verifikasi atau tolak dengan alasan yang jelas.'
          : 'Periksa bukti transfer peserta, lalu terima atau tolak dengan alasan.'}
      />

      <div className="tabs" role="tablist" aria-label="Status pembayaran">
        {TAB.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={status === t.value}
            className={`tab ${status === t.value ? 'active' : ''}`}
            onClick={() => setStatus(t.value)}
          >
            {t.label}
            <span className="tab-count">{jumlah[t.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="toolbar toolbar-single">
          <div className="input-wrap">
            <Icon name="search" size={18} className="input-icon" />
            <input
              className="input"
              placeholder={jenisLayanan === 'toefl' ? 'Cari nama peserta, NIM, atau kode tagihan' : 'Cari nama peserta, kelas, atau kode tagihan'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari pembayaran"
            />
          </div>
        </div>

        {loading && !list.length ? (
          <p className="table-message">Memuat data pembayaran...</p>
        ) : gagal ? (
          <div className="table-message">
            <p>Gagal memuat data pembayaran.</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={status === 'menunggu' ? 'checkCircle' : 'wallet'}
            title={q
              ? 'Tidak ada yang cocok'
              : status === 'menunggu'
                ? `Tidak ada bukti ${jenisLayanan === 'toefl' ? 'TOEFL ' : ''}yang menunggu`
                : 'Belum ada data'}
            text={status === 'menunggu' && !q
              ? `Bukti pembayaran${jenisLayanan === 'toefl' ? ' TOEFL' : ''} yang diunggah peserta akan muncul di sini.`
              : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Peserta</th>
                  <th>Layanan</th>
                  <th>Pembayaran</th>
                  <th className="num">Harus dibayar</th>
                  <th>{status === 'menunggu' ? 'Diunggah' : 'Diproses'}</th>
                  <th className="actions"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id_pembayaran}>
                    <td>
                      <p className="cell-title">{p.pendaftar?.nama_lengkap ?? '—'}</p>
                      <p className="cell-sub">{p.pendaftar?.nim || p.pendaftar?.email}</p>
                    </td>
                    <td>
                      <p>{p.layanan.nama}</p>
                      <p className="cell-sub">{LAYANAN[p.tagihan.jenis_layanan] ?? p.tagihan.jenis_layanan} · {p.tagihan.kode_tagihan}</p>
                    </td>
                    <td className="nowrap">
                      {p.cicilan ? `Cicilan ${p.cicilan.cicilan_ke}/${p.cicilan.jumlah_cicilan ?? '?'}` : 'Lunas'}
                      <p className="cell-sub">{p.jenis_bukti === 'pdf' ? 'PDF' : 'Gambar'}</p>
                    </td>
                    <td className="num nowrap">{formatRupiah(p.cicilan ? p.cicilan.nominal : p.tagihan.total_tagihan)}</td>
                    <td className="nowrap">
                      {waktu(status === 'menunggu' ? p.tanggal_unggah : p.tanggal_verifikasi)}
                      {p.catatan && <p className="cell-sub" title={p.catatan}>{p.catatan.length > 40 ? `${p.catatan.slice(0, 40)}…` : p.catatan}</p>}
                    </td>
                    <td className="actions">
                      <button type="button" className={`btn btn-sm ${status === 'menunggu' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTinjau(p)}>
                        {status === 'menunggu' ? 'Tinjau' : 'Lihat'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {tinjau && <TinjauPembayaranModal pembayaran={tinjau} onClose={() => setTinjau(null)} onDone={selesaiTinjau} />}
    </>
  );
}

export default VerifikasiPembayaranPage;
