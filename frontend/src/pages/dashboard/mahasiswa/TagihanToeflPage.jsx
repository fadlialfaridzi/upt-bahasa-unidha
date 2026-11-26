import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';

const STATUS_TAGIHAN = {
  menunggu_pembayaran: { label: 'Belum dibayar', badge: 'badge-warning' },
  menunggu_verifikasi: { label: 'Menunggu verifikasi', badge: 'badge-accent' },
  lunas: { label: 'Lunas', badge: 'badge-success' },
  kedaluwarsa: { label: 'Kedaluwarsa', badge: 'badge-danger' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const STATUS_BUKTI = {
  menunggu: { label: 'Menunggu verifikasi', badge: 'badge-accent' },
  terverifikasi: { label: 'Terverifikasi', badge: 'badge-success' },
  ditolak: { label: 'Ditolak', badge: 'badge-danger' },
};

const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const tanggal = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
  : '-';

const waktu = (value) => value
  ? String(value).slice(11, 16)
  : '-';

const buktiUrl = (idPendaftaran) => {
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return `${base}/api/toefl/pendaftaran/${idPendaftaran}/bukti`;
};

function TagihanToeflPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [file, setFile] = useState(null);
  const [previewFileUrl, setPreviewFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setGagal(false);
    try {
      const res = await api.get('/toefl/tagihan');
      setList(res.data.data || []);
    } catch {
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (previewFileUrl.startsWith('blob:')) URL.revokeObjectURL(previewFileUrl);
    };
  }, [previewFileUrl]);

  const chooseFile = (event) => {
    const next = event.target.files?.[0] || null;
    setFile(next);
    if (previewFileUrl.startsWith('blob:')) URL.revokeObjectURL(previewFileUrl);
    if (next && next.type !== 'application/pdf') {
      setPreviewFileUrl(URL.createObjectURL(next));
    } else {
      setPreviewFileUrl('');
    }
  };

  const removeFile = () => {
    if (previewFileUrl.startsWith('blob:')) URL.revokeObjectURL(previewFileUrl);
    setFile(null);
    setPreviewFileUrl('');
  };

  const openUpload = (item) => {
    setSelected(item);
    removeFile();
    setUploadOpen(true);
  };

  const openProof = async (item) => {
    setSelected(item);
    setPreviewUrl('');
    setPreviewOpen(true);
    try {
      const res = await api.get(`/toefl/pendaftaran/${item.id_pendaftaran}/bukti`, { responseType: 'blob' });
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch {
      toast.error('Bukti pembayaran belum tersedia atau tidak dapat dibuka');
    }
  };

  const uploadProof = async (event) => {
    event.preventDefault();
    if (!file) {
      toast.error('Pilih file bukti pembayaran');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      toast.error('Format bukti harus JPG, PNG, WebP, atau PDF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran bukti maksimal 5 MB');
      return;
    }

    const form = new FormData();
    form.append('bukti', file);
    form.append('id_pendaftaran', selected.id_pendaftaran);
    setUploading(true);
    try {
      await api.post('/toefl/pembayaran/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Bukti pembayaran berhasil dikirim');
      setUploadOpen(false);
      removeFile();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah bukti pembayaran');
    } finally {
      setUploading(false);
    }
  };

  const printSlip = (item) => {
    setSelected(item);
    document.body.classList.add('printing-toefl-slip');
    window.setTimeout(() => window.print(), 50);
    window.setTimeout(() => document.body.classList.remove('printing-toefl-slip'), 500);
  };

  const activePaymentBlocked = (item) => (
    item.tagihan?.pembayaran && item.tagihan.pembayaran.status !== 'ditolak'
  );

  return (
    <>
      <PageHeader
        eyebrow="Peserta / TOEFL"
        title="Slip Tagihan & Bukti Bayar"
        subtitle="Unduh slip, bayar melalui teller Bank Nagari, lalu unggah bukti transfer untuk diverifikasi."
      />

      {loading ? (
        <p className="table-message">Memuat tagihan TOEFL...</p>
      ) : gagal ? (
        <div className="table-message">
          <p>Gagal memuat tagihan TOEFL.</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="Belum ada tagihan TOEFL"
          text="Tagihan akan tersedia setelah Anda menyelesaikan pendaftaran ujian."
        />
      ) : (
        <div className="toefl-billing-list">
          {list.map((item) => {
            const tagihanStatus = STATUS_TAGIHAN[item.tagihan?.status] || STATUS_TAGIHAN.menunggu_pembayaran;
            const buktiStatus = item.tagihan?.pembayaran
              ? STATUS_BUKTI[item.tagihan.pembayaran.status] || STATUS_BUKTI.menunggu
              : null;
            return (
              <article className="panel toefl-billing-card" key={item.id_pendaftaran}>
                <header className="panel-head">
                  <div>
                    <p className="eyebrow">TAGIHAN TOEFL</p>
                    <h2 className="panel-title">{item.tagihan?.kode_tagihan}</h2>
                    <p className="panel-sub">{item.sesi?.nama_sesi || 'Sesi TOEFL'}</p>
                  </div>
                  <span className={`badge ${tagihanStatus.badge}`}>{tagihanStatus.label}</span>
                </header>
                <div className="panel-body">
                  <div className="billing-main-grid">
                    <dl className="billing-details">
                      <div><dt>Peserta</dt><dd>{item.pengguna?.nama_lengkap}</dd></div>
                      <div><dt>NIM / Identitas</dt><dd>{item.pengguna?.nim || '-'}</dd></div>
                      <div><dt>Tanggal ujian</dt><dd>{tanggal(item.sesi?.tanggal)}</dd></div>
                      <div><dt>Waktu</dt><dd>{waktu(item.sesi?.waktu)} WIB</dd></div>
                      <div><dt>Lokasi</dt><dd>{item.sesi?.lokasi || '-'}</dd></div>
                    </dl>

                    <section className="billing-payment">
                      <p className="cell-sub">Jumlah tagihan</p>
                      <strong className="billing-total">{rupiah(item.tagihan?.total_tagihan)}</strong>
                      <div className="billing-bank">
                        <span>Bank tujuan</span>
                        <strong>{item.rekening?.bank}</strong>
                        <span>Nomor rekening</span>
                        <strong>{item.rekening?.nomor_rekening}</strong>
                        <small>Atas nama: {item.rekening?.atas_nama}</small>
                      </div>
                      {item.tagihan?.batas_bayar && (
                        <p className="billing-deadline">Batas bayar: {tanggal(item.tagihan.batas_bayar)}</p>
                      )}
                    </section>
                  </div>

                  {item.tagihan?.pembayaran && (
                    <div className="billing-proof-summary">
                      <div>
                        <p className="cell-sub">Bukti pembayaran</p>
                        <strong>{buktiStatus.label}</strong>
                        {item.tagihan.pembayaran.catatan && (
                          <small className="billing-proof-note">Catatan admin: {item.tagihan.pembayaran.catatan}</small>
                        )}
                      </div>
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => openProof(item)}>
                        <Icon name="eye" size={15} /> Lihat bukti
                      </button>
                    </div>
                  )}
                </div>

                <footer className="panel-foot billing-actions">
                  <button type="button" className="btn btn-outline" onClick={() => printSlip(item)}>
                    <Icon name="download" size={16} /> Unduh slip tagihan
                  </button>
                  {!['lunas', 'kedaluwarsa', 'dibatalkan'].includes(item.tagihan?.status) && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openUpload(item)}
                      disabled={activePaymentBlocked(item)}
                    >
                      <Icon name="upload" size={16} />
                      {item.tagihan?.pembayaran?.status === 'menunggu'
                        ? 'Menunggu verifikasi'
                        : activePaymentBlocked(item)
                          ? 'Pembayaran terverifikasi'
                          : item.tagihan?.pembayaran
                            ? 'Unggah ulang bukti'
                            : 'Unggah bukti bayar'}
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <article className="toefl-billing-slip-print">
          <header>
            <div className="slip-logo">U</div>
            <div><strong>UPT Bahasa UNIDHA</strong><small>Universitas Dharma Andalas</small></div>
            <span>SLIP TAGIHAN TOEFL</span>
          </header>
          <dl>
            <div><dt>Kode Tagihan</dt><dd>{selected.tagihan?.kode_tagihan}</dd></div>
            <div><dt>Nama Peserta</dt><dd>{selected.pengguna?.nama_lengkap}</dd></div>
            <div><dt>NIM / Identitas</dt><dd>{selected.pengguna?.nim || '-'}</dd></div>
            <div><dt>Sesi Ujian</dt><dd>{selected.sesi?.nama_sesi}</dd></div>
            <div><dt>Tanggal Ujian</dt><dd>{tanggal(selected.sesi?.tanggal)}</dd></div>
            <div><dt>Jumlah Bayar</dt><dd>{rupiah(selected.tagihan?.total_tagihan)}</dd></div>
          </dl>
          <section>
            <strong>{selected.rekening?.bank}</strong>
            <span>Nomor rekening: {selected.rekening?.nomor_rekening}</span>
            <small>Atas nama: {selected.rekening?.atas_nama}</small>
          </section>
          <footer>Bayar melalui teller dan simpan bukti transaksi. Unggah bukti bayar pada menu Tagihan TOEFL setelah pembayaran.</footer>
        </article>
      )}

      {uploadOpen && selected && (
        <Modal
          title="Unggah Bukti Pembayaran"
          subtitle={selected.tagihan?.kode_tagihan}
          onClose={() => setUploadOpen(false)}
          busy={uploading}
          size="md"
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Batal</button>
              <button type="submit" form="toefl-proof-upload" className="btn btn-primary" disabled={uploading || !file}>
                {uploading ? 'Mengunggah...' : 'Kirim Bukti'}
              </button>
            </>
          }
        >
          <form id="toefl-proof-upload" onSubmit={uploadProof}>
            <label className="proof-drop">
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={chooseFile} />
              {previewFileUrl ? (
                <img className="proof-image-preview" src={previewFileUrl} alt="Preview bukti pembayaran" />
              ) : (
                <Icon name={file?.type === 'application/pdf' ? 'file' : 'upload'} size={22} />
              )}
              <strong>{file ? file.name : 'Pilih bukti transfer'}</strong>
              {file && <span className="proof-ready"><Icon name="checkCircle" size={14} /> Siap dikirim</span>}
              <small>{file ? `${(file.size / 1024).toFixed(0)} KB · ` : ''}JPG, PNG, WebP, atau PDF · Maks. 5 MB</small>
            </label>
            {file && (
              <button type="button" className="proof-remove-btn" onClick={removeFile}>
                <Icon name="x" size={14} /> Hapus pilihan
              </button>
            )}
          </form>
        </Modal>
      )}

      {previewOpen && selected && (
        <Modal title="Preview Bukti Pembayaran" subtitle={selected.tagihan?.kode_tagihan} onClose={() => {
          if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
          setPreviewUrl('');
          setPreviewOpen(false);
        }} size="lg">
          {previewUrl ? (
            <img className="proof-modal-preview" src={previewUrl} alt="Bukti pembayaran" />
          ) : (
            <p className="table-message">Memuat bukti pembayaran...</p>
          )}
        </Modal>
      )}
    </>
  );
}

export default TagihanToeflPage;
