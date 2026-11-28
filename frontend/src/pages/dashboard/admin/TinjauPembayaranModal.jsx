// Tinjau satu bukti pembayaran: pratinjau file + detail tagihan, lalu terima / tolak - #67
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { formatRupiah, formatTanggal } from '../../../config/pelatihan.js';

const STATUS_CICILAN = {
  belum_terbit: { label: 'Belum terbit', badge: 'badge-muted' },
  menunggu_pembayaran: { label: 'Menunggu bayar', badge: 'badge-warning' },
  menunggu_verifikasi: { label: 'Menunggu verifikasi', badge: 'badge-accent' },
  lunas: { label: 'Lunas', badge: 'badge-success' },
};

const waktu = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function TinjauPembayaranModal({ pembayaran: p, onClose, onDone }) {
  const [fileUrl, setFileUrl] = useState(null);
  const [gagalFile, setGagalFile] = useState(false);
  const [mode, setMode] = useState(null); // null | 'tolak'
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bisaDiproses = p.status === 'menunggu';

  // Bukti diambil lewat endpoint admin (bukan link publik) lalu ditampilkan sebagai object URL
  useEffect(() => {
    let url;
    let batal = false;
    api
      .get(`/pembayaran/${p.id_pembayaran}/bukti`, { responseType: 'blob' })
      .then((res) => {
        if (batal) return;
        url = URL.createObjectURL(res.data);
        setFileUrl(url);
      })
      .catch(() => !batal && setGagalFile(true));
    return () => {
      batal = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [p.id_pembayaran]);

  const kirim = async (keputusan) => {
    if (keputusan === 'tolak' && catatan.trim().length < 5) {
      setError('Tuliskan alasan penolakan (minimal 5 karakter) agar peserta tahu apa yang harus diperbaiki.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/pembayaran/${p.id_pembayaran}/verifikasi`, { keputusan, catatan: catatan.trim() || undefined });
      toast.success(res.data.message);
      onDone(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses pembayaran');
      if (err.response?.status === 409) onDone(null);
    } finally {
      setBusy(false);
    }
  };

  // Sistem tidak tahu jumlah yang benar-benar ditransfer (peserta tidak mengisinya);
  // admin mencocokkan jumlah di foto bukti dengan jumlah yang harus dibayar ini.
  const harusDibayar = p.cicilan ? p.cicilan.nominal : p.tagihan.total_tagihan;

  return (
    <Modal
      title={p.tagihan.jenis_layanan === 'toefl' ? 'Tinjau bukti pembayaran TOEFL' : 'Tinjau bukti pembayaran'}
      subtitle={`${p.tagihan.kode_tagihan} · ${p.layanan.nama}`}
      onClose={onClose}
      busy={busy}
      size="xl"
      footer={
        !bisaDiproses ? (
          <button type="button" className="btn btn-outline" onClick={onClose}>Tutup</button>
        ) : mode === 'tolak' ? (
          <>
            <button type="button" className="btn btn-outline" onClick={() => { setMode(null); setError(''); }} disabled={busy}>Kembali</button>
            <button type="button" className="btn btn-danger" onClick={() => kirim('tolak')} disabled={busy}>
              {busy ? 'Memproses...' : 'Tolak pembayaran'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-outline" onClick={() => setMode('tolak')} disabled={busy}>
              <Icon name="x" size={16} /> Tolak
            </button>
            <button type="button" className="btn btn-primary" onClick={() => kirim('terima')} disabled={busy}>
              <Icon name="checkCircle" size={16} /> {busy ? 'Memproses...' : 'Terima & verifikasi'}
            </button>
          </>
        )
      }
    >
      <div className="review-grid">
        <div className="bukti-frame">
          {gagalFile ? (
            <p className="table-message">File bukti tidak dapat dibuka.</p>
          ) : !fileUrl ? (
            <p className="table-message">Memuat bukti...</p>
          ) : p.jenis_bukti === 'pdf' ? (
            <iframe src={fileUrl} title="Bukti pembayaran (PDF)" />
          ) : (
            <img src={fileUrl} alt={`Bukti pembayaran ${p.tagihan.kode_tagihan}`} />
          )}
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm bukti-open">
              Buka ukuran penuh
            </a>
          )}
        </div>

        <div className="review-detail">
          <dl className="detail-list">
            <dt>Peserta</dt>
            <dd>
              <strong>{p.pendaftar?.nama_lengkap ?? '—'}</strong>
              <span>{[p.pendaftar?.nim, p.pendaftar?.email, p.pendaftar?.no_hp].filter(Boolean).join(' · ')}</span>
            </dd>
            <dt>Layanan</dt>
            <dd>{p.layanan.nama}</dd>
            <dt>Jenis pembayaran</dt>
            <dd>{p.cicilan ? `Cicilan ke-${p.cicilan.cicilan_ke} dari ${p.cicilan.jumlah_cicilan ?? '?'} (${p.cicilan.kode_tagihan_termin})` : 'Lunas (sekali bayar)'}</dd>
            <dt>Harus dibayar</dt>
            <dd>
              <strong className="nominal">{formatRupiah(harusDibayar)}</strong>
              <span>
                {p.cicilan
                  ? `Cicilan ke-${p.cicilan.cicilan_ke} dari total tagihan ${formatRupiah(p.tagihan.total_tagihan)}`
                  : p.tagihan.batas_bayar && `Batas bayar ${formatTanggal(p.tagihan.batas_bayar)}`}
              </span>
            </dd>
            <dt>Diunggah</dt>
            <dd>{waktu(p.tanggal_unggah)}</dd>
            {!bisaDiproses && (
              <>
                <dt>Diproses</dt>
                <dd>
                  {waktu(p.tanggal_verifikasi)}
                  {p.catatan && <span>Catatan: {p.catatan}</span>}
                </dd>
              </>
            )}
          </dl>

          {p.daftar_cicilan.length > 0 && (
            <div className="cicilan-mini">
              <p className="field-label">Termin cicilan</p>
              <ul>
                {p.daftar_cicilan.map((c) => (
                  <li key={c.cicilan_ke} className={p.cicilan?.cicilan_ke === c.cicilan_ke ? 'is-current' : ''}>
                    <span>Ke-{c.cicilan_ke} · {formatRupiah(c.nominal)} · jatuh tempo {formatTanggal(c.jatuh_tempo, { day: 'numeric', month: 'short' })}</span>
                    <span className={`badge ${STATUS_CICILAN[c.status]?.badge ?? 'badge-muted'}`}>{STATUS_CICILAN[c.status]?.label ?? c.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bisaDiproses && mode === 'tolak' && (
            <div className="field">
              <label className="field-label" htmlFor="alasan-tolak">Alasan penolakan</label>
              <textarea
                id="alasan-tolak"
                className="input textarea"
                rows={3}
                maxLength={200}
                value={catatan}
                onChange={(e) => { setCatatan(e.target.value); setError(''); }}
                placeholder="Contoh: Nominal transfer tidak sesuai / bukti tidak terbaca"
                autoFocus
              />
              {error ? <span className="field-error">{error}</span> : <span className="field-hint">Alasan dikirim ke peserta sebagai notifikasi.</span>}
            </div>
          )}
          {bisaDiproses && mode !== 'tolak' && (
            <p className="field-hint">
              Cocokkan jumlah transfer dan rekening tujuan pada foto bukti dengan jumlah yang harus dibayar. Menerima pembayaran akan memverifikasi pendaftaran peserta
              {p.cicilan ? ' dan menerbitkan termin cicilan berikutnya' : ''}.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default TinjauPembayaranModal;
