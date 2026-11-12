import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Layout from './components/layout/Layout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import PrivateRoute from './components/common/PrivateRoute.jsx';
import RoleRoute, { DashboardRedirect } from './components/common/RoleRoute.jsx';

import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ToeflJadwalPage from './pages/toefl/ToeflJadwalPage.jsx';
import ToeflDaftarPage from './pages/toefl/ToeflDaftarPage.jsx';
import PelatihanPage from './pages/pelatihan/PelatihanPage.jsx';
import TerjemahanPage from './pages/terjemahan/TerjemahanPage.jsx';
import SuperAdminDashboard from './pages/dashboard/SuperAdminDashboard.jsx';
import AdminDashboard from './pages/dashboard/AdminDashboard.jsx';
import DosenDashboard from './pages/dashboard/DosenDashboard.jsx';
import MahasiswaDashboard from './pages/dashboard/MahasiswaDashboard.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Halaman login berdiri sendiri (tanpa navbar publik) */}
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard per role - butuh login */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardRedirect />} />
            <Route path="super-admin" element={<RoleRoute dashboard="superadmin"><SuperAdminDashboard /></RoleRoute>} />
            <Route path="admin" element={<RoleRoute dashboard="admin"><AdminDashboard /></RoleRoute>} />
            <Route path="dosen" element={<RoleRoute dashboard="dosen"><DosenDashboard /></RoleRoute>} />
            <Route path="mahasiswa" element={<RoleRoute dashboard="mahasiswa"><MahasiswaDashboard /></RoleRoute>} />
          </Route>
        </Route>

        {/* Situs publik */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="register" element={<RegisterPage />} />
          {/* Halaman lama: belum disesuaikan dengan skema database baru */}
          <Route path="toefl" element={<ToeflJadwalPage />} />
          <Route path="pelatihan" element={<PelatihanPage />} />
          <Route element={<PrivateRoute />}>
            <Route path="toefl/daftar/:jadwalId" element={<ToeflDaftarPage />} />
            <Route path="terjemahan" element={<TerjemahanPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
