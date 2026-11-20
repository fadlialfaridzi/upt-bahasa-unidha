import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { formatRupiah } from '../../../config/pelatihan.js';

function UploadBuktiModal({ tagihan, cicilan = null, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const nominal = cicilan ? Number(cicilan.nominal) : Number(tagihan.total_tagihan);
  const labelTarget = cicilan
    ? `Pembayaran Cicilan ke-${cicilan.cicilan_ke} (${cicilan.kode_termin || tagihan.kode_tagihan})`
    : `Pembayaran Lunas (${tagihan.kode_tagihan})`;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5 MB');
      return;
    }

    setFile(selected);
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Pilih file struk bukti pembayaran terlebih dahulu');
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('id_tagihan', tagihan.id_tagihan);
      if (cicilan) formData.append('id_cicilan', cicilan.id_cicilan);
      formData.append('bukti', file);

      const res = await api.post('/pelatihan/pembayaran/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(res.data.message || 'Bukti pembayaran berhasil diunggah!');
      onSuccess(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah bukti pembayaran');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Unggah Bukti Pembayaran Bank"
      subtitle={labelTarget}
      onClose={onClose}
      busy={busy}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="upload-bukti-form" className="btn btn-primary" disabled={busy || !file}>
            {busy ? 'Mengunggah...' : 'Kirim Bukti Pembayaran'}
          </button>
        </>
      }
    >
      <form id="upload-bukti-form" onSubmit={handleSubmit}>
        {/* Info Rekening Bank */}
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Nominal yang Harus Dibayar:</span>
            <strong style={{ fontSize: '1.2rem', color: '#15803d' }}>{formatRupiah(nominal)}</strong>
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
            <div>🏦 <strong>Bank Tujuan:</strong> Bank Nagari (Setoran Tunai / Transfer)</div>
            <div>🔢 <strong>Nomor Rekening:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: 'var(--brand-800)' }}>0102.0210.01234-5</span></div>
            <div>👤 <strong>Atas Nama:</strong> UPT Bahasa Universitas Dharma Andalas</div>
            <div>📝 <strong>Berita / Keterangan:</strong> {cicilan ? cicilan.kode_termin : tagihan.kode_tagihan}</div>
          </div>
        </div>

        {/* Upload Input */}
        <div className="field field-full" style={{ marginBottom: '14px' }}>
          <label className="field-label" style={{ fontWeight: 600 }}>File Struk / Bukti Pembayaran</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            className="input input-plain"
            style={{ padding: '8px' }}
          />
          <span className="field-hint">Format yang didukung: JPG, PNG, WebP, atau PDF (Maksimal 5 MB).</span>
        </div>

        {/* Image Preview */}
        {preview && (
          <div style={{ marginBottom: '14px', textAlign: 'center', background: '#f1f5f9', padding: '10px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Pratinjau Bukti:</span>
            <img src={preview} alt="Pratinjau bukti" style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
        )}

        {file && !preview && file.type === 'application/pdf' && (
          <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', padding: '10px', borderRadius: '8px', color: '#1e40af', fontSize: '0.84rem' }}>
            <Icon name="file" size={20} />
            <span>Dokumen PDF terpilih: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        <div className="alert alert-info" style={{ background: '#fefce8', border: '1px solid #fef08a', color: '#854d0e', padding: '10px 12px', fontSize: '0.82rem' }}>
          <Icon name="alert" size={16} />
          <div>
            <strong>Catatan:</strong>
            <p style={{ margin: '2px 0 0' }}>
              Bukti pembayaran yang Anda unggah akan divalidasi oleh tim admin UPT Bahasa. Status pendaftaran akan berubah menjadi <strong>Terverifikasi</strong> setelah validasi selesai.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default UploadBuktiModal;
