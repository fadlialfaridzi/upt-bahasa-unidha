import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

function PelatihanPage() {
  const [pelatihanList, setPelatihanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [daftarLoading, setDaftarLoading] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/pelatihan')
      .then((res) => setPelatihanList(res.data.data))
      .catch(() => toast.error('Gagal memuat data pelatihan'))
      .finally(() => setLoading(false));
  }, []);

  const handleDaftar = async (pelatihanId) => {
    if (!user) { navigate('/login'); return; }
    setDaftarLoading(pelatihanId);
    try {
      await api.post('/pelatihan/daftar', { pelatihanId });
      toast.success('Pendaftaran pelatihan berhasil!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mendaftar');
    } finally {
      setDaftarLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 2rem' }}>
      <h1 style={{ color: '#1e3a5f', marginBottom: '0.5rem' }}>Pelatihan TOEFL</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>Program pelatihan intensif untuk meningkatkan skor TOEFL Anda.</p>

      {loading ? (
        <p>Memuat data pelatihan...</p>
      ) : pelatihanList.length === 0 ? (
        <p style={{ color: '#64748b' }}>Belum ada program pelatihan yang tersedia.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {pelatihanList.map((p) => (
            <div key={p.id} style={{ background: 'white', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
              <h3 style={{ color: '#1e3a5f', marginBottom: '0.5rem' }}>{p.nama}</h3>
              {p.deskripsi && <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>{p.deskripsi}</p>}
              <p style={{ fontSize: '0.85rem', color: '#475569' }}>📅 {new Date(p.tanggalMulai).toLocaleDateString('id-ID')} - {new Date(p.tanggalSelesai).toLocaleDateString('id-ID')}</p>
              <p style={{ fontSize: '0.85rem', color: '#475569' }}>⏰ {p.waktu}</p>
              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1rem' }}>📍 {p.lokasi}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 'bold', color: '#1e3a5f' }}>Rp {Number(p.biaya).toLocaleString('id-ID')}</p>
                  <p style={{ fontSize: '0.8rem', color: p.kuotaTerisi >= p.kuota ? '#ef4444' : '#22c55e' }}>
                    Sisa: {p.kuota - p.kuotaTerisi}/{p.kuota}
                  </p>
                </div>
                <button
                  onClick={() => handleDaftar(p.id)}
                  disabled={daftarLoading === p.id || p.kuotaTerisi >= p.kuota}
                  style={{
                    background: p.kuotaTerisi >= p.kuota ? '#94a3b8' : '#1e3a5f',
                    color: 'white', padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', fontSize: '0.9rem',
                  }}
                >
                  {daftarLoading === p.id ? '...' : p.kuotaTerisi >= p.kuota ? 'Penuh' : 'Daftar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PelatihanPage;
