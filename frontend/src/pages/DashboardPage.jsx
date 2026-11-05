import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

function DashboardPage() {
  const { user } = useAuth();
  const [toefl, setToefl] = useState([]);
  const [pelatihan, setPelatihan] = useState([]);
  const [terjemahan, setTerjemahan] = useState([]);

  useEffect(() => {
    api.get('/toefl/my-pendaftaran').then((r) => setToefl(r.data.data)).catch(() => {});
    api.get('/pelatihan/my-pelatihan').then((r) => setPelatihan(r.data.data)).catch(() => {});
    api.get('/terjemahan/my-terjemahan').then((r) => setTerjemahan(r.data.data)).catch(() => {});
  }, []);

  const statusColor = {
    MENUNGGU: '#f59e0b',
    DIKONFIRMASI: '#3b82f6',
    SELESAI: '#22c55e',
    DITOLAK: '#ef4444',
    DIPROSES: '#8b5cf6',
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 2rem' }}>
      <h1 style={{ color: '#1e3a5f', marginBottom: '0.5rem' }}>Dashboard</h1>
      <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>Selamat datang, {user?.nama}!</p>

      <Section title="Pendaftaran Tes TOEFL" items={toefl} renderItem={(item) => (
        <div key={item.id} style={cardStyle}>
          <p style={{ fontWeight: '600' }}>{new Date(item.jadwal.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>📍 {item.jadwal.lokasi}</p>
          <StatusBadge status={item.status} color={statusColor[item.status]} />
        </div>
      )} />

      <Section title="Pelatihan TOEFL" items={pelatihan} renderItem={(item) => (
        <div key={item.id} style={cardStyle}>
          <p style={{ fontWeight: '600' }}>{item.pelatihan.nama}</p>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {new Date(item.pelatihan.tanggalMulai).toLocaleDateString('id-ID')} - {new Date(item.pelatihan.tanggalSelesai).toLocaleDateString('id-ID')}
          </p>
          <StatusBadge status={item.status} color={statusColor[item.status]} />
        </div>
      )} />

      <Section title="Pengajuan Terjemahan" items={terjemahan} renderItem={(item) => (
        <div key={item.id} style={cardStyle}>
          <p style={{ fontWeight: '600' }}>{item.judulDokumen}</p>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{item.bahasaAsal} → {item.bahasaTujuan}</p>
          {item.harga && <p style={{ color: '#1e3a5f', fontSize: '0.9rem' }}>Rp {Number(item.harga).toLocaleString('id-ID')}</p>}
          <StatusBadge status={item.status} color={statusColor[item.status]} />
        </div>
      )} />
    </div>
  );
}

function Section({ title, items, renderItem }) {
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ color: '#1e3a5f', marginBottom: '1rem', fontSize: '1.3rem' }}>{title}</h2>
      {items.length === 0 ? (
        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum ada data.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, color }) {
  return (
    <span style={{
      display: 'inline-block', marginTop: '0.5rem',
      background: color + '20', color: color,
      padding: '0.2rem 0.8rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600',
    }}>
      {status}
    </span>
  );
}

const cardStyle = {
  background: 'white', borderRadius: '8px', padding: '1.2rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

export default DashboardPage;
