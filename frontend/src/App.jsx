import { Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Layout from './components/layout/Layout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import PrivateRoute from './components/common/PrivateRoute.jsx';
import RoleRoute, { DashboardRedirect } from './components/common/RoleRoute.jsx';

import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import VerifyOtpPage from './pages/auth/VerifyOtpPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import ToeflJadwalPage from './pages/toefl/ToeflJadwalPage.jsx';
import PelatihanPage from './pages/pelatihan/PelatihanPage.jsx';
import TerjemahanPage from './pages/terjemahan/TerjemahanPage.jsx';
import SuperAdminDashboard from './pages/dashboard/SuperAdminDashboard.jsx';
import SuperAdminUsersPage from './pages/dashboard/SuperAdminUsersPage.jsx';
import AdminDashboard from './pages/dashboard/AdminDashboard.jsx';
import DosenDashboard from './pages/dashboard/DosenDashboard.jsx';
import MahasiswaDashboard from './pages/dashboard/MahasiswaDashboard.jsx';
import MahasiswaPelatihanPage from './pages/dashboard/mahasiswa/MahasiswaPelatihanPage.jsx';
import MahasiswaTerjemahanPage from './pages/dashboard/mahasiswa/MahasiswaTerjemahanPage.jsx';
import TagihanToeflPage from './pages/dashboard/mahasiswa/TagihanToeflPage.jsx';
import ToeflDaftarPage from './pages/toefl/ToeflDaftarPage.jsx';
import KelasAdminPage from './pages/dashboard/admin/KelasAdminPage.jsx';
import JadwalKelasPage from './pages/dashboard/admin/JadwalKelasPage.jsx';
import ToeflSesiPage from './pages/dashboard/admin/ToeflSesiPage.jsx';
import ToeflSesiFormPage from './pages/dashboard/admin/ToeflSesiFormPage.jsx';
import VerifikasiPembayaranPage from './pages/dashboard/admin/VerifikasiPembayaranPage.jsx';
import AdminHasilTerjemahanPage from './pages/dashboard/admin/AdminHasilTerjemahanPage.jsx';
import ToeflKuotaPage from './pages/dashboard/admin/ToeflKuotaPage.jsx';
import KegiatanDosenPage from './pages/dashboard/dosen/KegiatanDosenPage.jsx';
import KelasSayaPage from './pages/dashboard/dosen/KelasSayaPage.jsx';
import JobOrderTerjemahanPage from './pages/dashboard/penerjemah/JobOrderTerjemahanPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Halaman auth berdiri sendiri (tanpa navbar publik) */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-otp"      element={<VerifyOtpPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />

        {/* Dashboard per role - butuh login */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardRedirect />} />
            <Route path="super-admin" element={<RoleRoute dashboard="superadmin"><SuperAdminDashboard /></RoleRoute>} />
            <Route path="super-admin/users" element={<RoleRoute dashboard="superadmin"><SuperAdminUsersPage /></RoleRoute>} />
            <Route path="admin"       element={<RoleRoute dashboard="admin"><AdminDashboard /></RoleRoute>} />
            <Route path="admin/kelas" element={<RoleRoute dashboard="admin"><KelasAdminPage /></RoleRoute>} />
            <Route path="admin/kelas/:id/jadwal" element={<RoleRoute dashboard="admin"><JadwalKelasPage /></RoleRoute>} />
            <Route path="admin/toefl/kuota" element={<RoleRoute dashboard="admin"><ToeflKuotaPage /></RoleRoute>} />
            <Route path="admin/toefl/pembayaran" element={<RoleRoute dashboard="admin"><VerifikasiPembayaranPage jenisLayanan="toefl" /></RoleRoute>} />
            <Route path="admin/toefl/sesi" element={<RoleRoute dashboard="admin"><ToeflSesiPage /></RoleRoute>} />
            <Route path="admin/toefl/sesi/tambah" element={<RoleRoute dashboard="admin"><ToeflSesiFormPage /></RoleRoute>} />
            <Route path="admin/toefl/sesi/:id/edit" element={<RoleRoute dashboard="admin"><ToeflSesiFormPage /></RoleRoute>} />
            <Route path="admin/pembayaran" element={<RoleRoute dashboard="admin"><VerifikasiPembayaranPage /></RoleRoute>} />
            <Route path="admin/terjemahan/hasil" element={<RoleRoute dashboard="admin"><AdminHasilTerjemahanPage /></RoleRoute>} />
            <Route path="dosen"       element={<RoleRoute dashboard="dosen"><DosenDashboard /></RoleRoute>} />
            <Route path="dosen/jadwal" element={<RoleRoute dashboard="dosen"><KegiatanDosenPage /></RoleRoute>} />
            <Route path="dosen/kelas" element={<RoleRoute dashboard="dosen"><KelasSayaPage /></RoleRoute>} />
            <Route path="penerjemah" element={<RoleRoute dashboard="penerjemah"><JobOrderTerjemahanPage /></RoleRoute>} />
            <Route path="dosen/penerjemahan" element={<Navigate to="/dashboard/penerjemah" replace />} />
            <Route path="mahasiswa"   element={<RoleRoute dashboard="mahasiswa"><MahasiswaDashboard /></RoleRoute>} />
            <Route path="mahasiswa/pelatihan" element={<RoleRoute dashboard="mahasiswa"><MahasiswaPelatihanPage /></RoleRoute>} />
            <Route path="mahasiswa/terjemahan" element={<RoleRoute dashboard="mahasiswa"><MahasiswaTerjemahanPage /></RoleRoute>} />
            <Route path="mahasiswa/toefl/tagihan" element={<RoleRoute dashboard="mahasiswa"><TagihanToeflPage /></RoleRoute>} />
            <Route path="mahasiswa/toefl" element={<RoleRoute dashboard="mahasiswa"><ToeflDaftarPage /></RoleRoute>} />
          </Route>
        </Route>

        {/* Situs publik */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="register" element={<RegisterPage />} />
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
