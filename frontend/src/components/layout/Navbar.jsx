import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={{
      background: '#1e3a5f',
      color: 'white',
      padding: '0 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '64px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <Link to="/" style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
        UPT Bahasa Unidha
      </Link>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <Link to="/toefl" style={{ color: 'white', opacity: 0.9 }}>Tes TOEFL</Link>
        <Link to="/pelatihan" style={{ color: 'white', opacity: 0.9 }}>Pelatihan</Link>
        <Link to="/terjemahan" style={{ color: 'white', opacity: 0.9 }}>Terjemahan</Link>
        {user ? (
          <>
            <Link to="/dashboard" style={{ color: 'white', opacity: 0.9 }}>Dashboard</Link>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid white',
                color: 'white',
                padding: '0.4rem 1rem',
                borderRadius: '4px',
              }}
            >
              Keluar
            </button>
          </>
        ) : (
          <Link
            to="/login"
            style={{
              background: '#e8b84b',
              color: '#1e3a5f',
              padding: '0.4rem 1rem',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          >
            Masuk
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
