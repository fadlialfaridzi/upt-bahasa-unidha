import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';

function ToeflJadwalPage() {
  const [jadwal, setJadwal] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/toefl/jadwal')
      .then((res) => setJadwal(res.data.data))
      .catch(() => toast.error('Gagal memuat jadwal'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 2rem' }}>
      <h1 style={{ color: '#1e3a5f', marginBottom: '0.5rem' }}>Jadwal Tes TOEFL</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>Pilih jadwal yang tersedia dan daftarkan diri Anda.</p>

      {loading ? (
        <p>Memuat jadwal...</p>
      ) : jadwal.length === 0 ? (
        <p style={{ color: '#64748b' }}>Belum ada jadwal tes yang tersedia saat ini.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {jadwal.map((j) => (
            <div key={j.id} style={{
              background: 'white', borderRadius: '10px', padding: '1.5rem',
              boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
            }}>
              <div>
                <h3 style={{ color: '#1e3a5f', marginBottom: '0.3rem' }}>
                  {new Date(j.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>⏰ {j.waktu} &nbsp;|&nbsp; 📍 {j.lokasi}</p>
                {j.keterangan && <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.3rem' }}>{j.keterangan}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 'bold', color: '#1e3a5f', fontSize: '1.1rem' }}>
                  Rp {Number(j.biaya).toLocaleString('id-ID')}
                </p>
                <p style={{ fontSize: '0.85rem', color: j.kuotaTerisi >= j.kuota ? '#ef4444' : '#22c55e', marginBottom: '0.5rem' }}>
                  Sisa kuota: {j.kuota - j.kuotaTerisi}/{j.kuota}
                </p>
                <Link
                  to={`/toefl/daftar/${j.id}`}
                  style={{
                    background: j.kuotaTerisi >= j.kuota ? '#94a3b8' : '#1e3a5f',
                    color: 'white', padding: '0.5rem 1.2rem', borderRadius: '6px', fontSize: '0.9rem',
                    pointerEvents: j.kuotaTerisi >= j.kuota ? 'none' : 'auto',
                  }}
                >
                  {j.kuotaTerisi >= j.kuota ? 'Penuh' : 'Daftar'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ToeflJadwalPage;
