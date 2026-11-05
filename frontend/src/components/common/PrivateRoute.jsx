import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function PrivateRoute() {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export default PrivateRoute;
