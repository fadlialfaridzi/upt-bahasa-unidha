import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { JENIS_PELATIHAN, TIPE_KELAS, formatRupiah } from '../../../config/pelatihan.js';

function DaftarPelatihanModal({ kelas, onClose, onSuccess }) {
  const [metode, setMetode] = useState('cicilan'); // 'lunas' | 'cicilan'
  const [jumlahCicilan, setJumlahCicilan] = useState(3); // 2 | 3
  const [alasan, setAlasan] = useState('');
  const [busy, setBusy] = useState(false);

  const totalTarif = Number(kelas.tarif || 0);

  // Perhitungan simulasi termin cicilan
  const nominalPerTermin = Math.floor(totalTarif / jumlahCicilan);
  const sisaPembulatan = totalTarif - nominalPerTermin * jumlahCicilan;

  const totalPertemuan = kelas.jumlah_pertemuan || 20;
  const pertemuanTengah = Math.round(totalPertemuan / 2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        id_kelas: kelas.id_kelas,
        metode_pembayaran: metode,
        jumlah_cicilan: metode === 'cicilan' ? Number(jumlahCicilan) : undefined,
        alasan_cicilan: metode === 'cicilan' ? alasan : undefined,
      };

      const res = await api.post('/pelatihan/daftar', payload);
      toast.success(res.data.message || 'Pendaftaran kelas berhasil!');
      onSuccess(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal melakukan pendaftaran');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Form Pendaftaran Kelas Pelatihan"
      subtitle={`${kelas.nama_kelas} · ${JENIS_PELATIHAN[kelas.jenis_pelatihan] || kelas.jenis_pelatihan}`}
      onClose={onClose}
      busy={busy}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="daftar-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Memproses...' : 'Konfirmasi Pendaftaran'}
          </button>
        </>
      }
    >
      <form id="daftar-form" onSubmit={handleSubmit}>
        {/* Ringkasan Kelas */}
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Biaya Pelatihan ({kelas.jumlah_pertemuan} Pertemuan)</span>
            <strong style={{ fontSize: '1.15rem', color: 'var(--brand-800)' }}>{formatRupiah(totalTarif)}</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-2)', display: 'grid', gap: '4px' }}>
            <div>📌 <strong>Tipe:</strong> {TIPE_KELAS[kelas.tipe_kelas] || kelas.tipe_kelas}</div>
            <div>👥 <strong>Kuota Tersisa:</strong> {kelas.sisa_kuota} dari {kelas.kuota_maks} peserta</div>
            {kelas.pengajar?.length > 0 && <div>👨‍🏫 <strong>Dosen PJ:</strong> {kelas.pengajar.join(', ')}</div>}
          </div>
        </div>

        {/* Pilihan Metode Pembayaran */}
        <div className="field field-full" style={{ marginBottom: '14px' }}>
          <label className="field-label" style={{ fontWeight: 600 }}>Pilihan Skema Pembayaran</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
            {/* Opsi Cicilan */}
            <div
              onClick={() => setMetode('cicilan')}
              style={{
                border: `2px solid ${metode === 'cicilan' ? 'var(--brand-700)' : 'var(--line)'}`,
                background: metode === 'cicilan' ? '#f0fdf4' : '#fff',
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="radio"
                  name="metode"
                  checked={metode === 'cicilan'}
                  onChange={() => setMetode('cicilan')}
                />
                <strong style={{ fontSize: '0.9rem', color: 'var(--brand-900)' }}>Cicilan (Angsuran)</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', marginLeft: '22px' }}>
                Maksimal 3x bayar (diawal, ditengah, & diakhir kelas).
              </p>
            </div>

            {/* Opsi Lunas */}
            <div
              onClick={() => setMetode('lunas')}
              style={{
                border: `2px solid ${metode === 'lunas' ? 'var(--brand-700)' : 'var(--line)'}`,
                background: metode === 'lunas' ? '#f0fdf4' : '#fff',
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="radio"
                  name="metode"
                  checked={metode === 'lunas'}
                  onChange={() => setMetode('lunas')}
                />
                <strong style={{ fontSize: '0.9rem', color: 'var(--brand-900)' }}>Bayar Lunas (1x)</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', marginLeft: '22px' }}>
                1x pembayaran penuh di awal pendaftaran.
              </p>
            </div>
          </div>
        </div>

        {/* Jika Cicilan dipilih */}
        {metode === 'cicilan' && (
          <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span className="field-label" style={{ margin: 0, fontWeight: 600 }}>Jumlah Termin Cicilan</span>
              <select
                className="input input-plain"
                style={{ width: 'auto', padding: '4px 10px', fontSize: '0.85rem' }}
                value={jumlahCicilan}
                onChange={(e) => setJumlahCicilan(Number(e.target.value))}
              >
                <option value={3}>3x Cicilan (Direkomendasikan)</option>
                <option value={2}>2x Cicilan</option>
              </select>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' }}>
              Rincian jadwal & nominal angsuran per termin:
            </p>

            <div style={{ display: 'grid', gap: '8px' }}>
              {/* Cicilan 1: Diawal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.82rem' }}>
                <div>
                  <strong>Termin 1 (Diawal - Pertemuan 1)</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Dibayar sebelum kelas dimulai</div>
                </div>
                <strong style={{ color: 'var(--brand-800)' }}>{formatRupiah(nominalPerTermin)}</strong>
              </div>

              {/* Cicilan 2: Ditengah jika 3x cicilan */}
              {jumlahCicilan === 3 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.82rem' }}>
                  <div>
                    <strong>Termin 2 (Ditengah - Pertemuan {pertemuanTengah})</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Pertengahan periode kelas</div>
                  </div>
                  <strong style={{ color: 'var(--brand-800)' }}>{formatRupiah(nominalPerTermin)}</strong>
                </div>
              )}

              {/* Cicilan Terakhir: Diakhir */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.82rem' }}>
                <div>
                  <strong>Termin {jumlahCicilan} (Diakhir - Pertemuan {totalPertemuan})</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Sebelum kelas selesai / sertifikat terbit</div>
                </div>
                <strong style={{ color: 'var(--brand-800)' }}>{formatRupiah(nominalPerTermin + sisaPembulatan)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Informasi Pembayaran Bank */}
        <div className="alert alert-info" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '10px 12px', fontSize: '0.82rem', marginBottom: '8px' }}>
          <Icon name="alert" size={16} />
          <div>
            <strong>Instruksi Pembayaran:</strong>
            <p style={{ margin: '2px 0 0' }}>
              Setelah pendaftaran dibuat, silakan lakukan pembayaran tunai/transfer ke rekening Bank UPT Bahasa UNIDHA, lalu unggah struk bukti bayar di sistem untuk divalidasi admin.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default DaftarPelatihanModal;
