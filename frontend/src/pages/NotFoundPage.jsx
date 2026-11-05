import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
      <h1 style={{ fontSize: '5rem', color: '#1e3a5f', marginBottom: '1rem' }}>404</h1>
      <p style={{ fontSize: '1.2rem', color: '#64748b', marginBottom: '2rem' }}>Halaman tidak ditemukan.</p>
      <Link to="/" style={{ background: '#1e3a5f', color: 'white', padding: '0.7rem 1.5rem', borderRadius: '8px' }}>
        Kembali ke Beranda
      </Link>
    </div>
  );
}

export default NotFoundPage;
