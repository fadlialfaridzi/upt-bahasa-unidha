import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';

function ToeflDaftarPage() {
  const { jadwalId } = useParams();
  const navigate = useNavigate();
  const [jadwal, setJadwal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/toefl/jadwal/${jadwalId}`)
      .then((res) => setJadwal(res.data.data))
      .catch(() => toast.error('Gagal memuat detail jadwal'))
      .finally(() => setLoading(false));
  }, [jadwalId]);

  const handleDaftar = async () => {
    setSubmitting(true);
    try {
      await api.post('/toefl/daftar', { jadwalId });
      toast.success('Pendaftaran berhasil! Silakan cek dashboard Anda.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mendaftar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ padding: '3rem', textAlign: 'center' }}>Memuat...</p>;
  if (!jadwal) return <p style={{ padding: '3rem', textAlign: 'center' }}>Jadwal tidak ditemukan.</p>;

  return (
    <div style={{ maxWidth: '600px', margin: '3rem auto', padding: '0 2rem' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#1e3a5f', marginBottom: '1.5rem' }}>Konfirmasi Pendaftaran Tes TOEFL</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
          <DetailItem label="Tanggal" value={new Date(jadwal.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
          <DetailItem label="Waktu" value={jadwal.waktu} />
          <DetailItem label="Lokasi" value={jadwal.lokasi} />
          <DetailItem label="Biaya" value={`Rp ${Number(jadwal.biaya).toLocaleString('id-ID')}`} />
          <DetailItem label="Sisa Kuota" value={`${jadwal.kuota - jadwal.kuotaTerisi} tempat`} />
        </div>
        <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Dengan mendaftar, Anda menyetujui bahwa data yang digunakan adalah data akun Anda.
        </p>
        <button
          onClick={handleDaftar} disabled={submitting}
          style={{ width: '100%', background: '#1e3a5f', color: 'white', padding: '0.9rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1rem' }}
        >
          {submitting ? 'Memproses...' : 'Konfirmasi Pendaftaran'}
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: '500', color: '#1e3a5f' }}>{value}</span>
    </div>
  );
}

export default ToeflDaftarPage;
