import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardKeyFor, dashboardPathFor } from '../../config/roles.js';

// Hanya izinkan dashboard yang sesuai role; selain itu arahkan ke dashboard milik pengguna.
function RoleRoute({ dashboard, children }) {
  const { user } = useAuth();
  if (dashboardKeyFor(user.role) !== dashboard) {
    return <Navigate to={dashboardPathFor(user.role)} replace />;
  }
  return children;
}

export function DashboardRedirect() {
  const { user } = useAuth();
  return <Navigate to={dashboardPathFor(user.role)} replace />;
}

export default RoleRoute;
