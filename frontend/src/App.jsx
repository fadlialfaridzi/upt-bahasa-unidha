import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Layout from './components/layout/Layout.jsx';
import PrivateRoute from './components/common/PrivateRoute.jsx';

import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ToeflJadwalPage from './pages/toefl/ToeflJadwalPage.jsx';
import ToeflDaftarPage from './pages/toefl/ToeflDaftarPage.jsx';
import PelatihanPage from './pages/pelatihan/PelatihanPage.jsx';
import TerjemahanPage from './pages/terjemahan/TerjemahanPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="toefl" element={<ToeflJadwalPage />} />
          <Route path="pelatihan" element={<PelatihanPage />} />
          {/* Protected routes - butuh login */}
          <Route element={<PrivateRoute />}>
            <Route path="toefl/daftar/:jadwalId" element={<ToeflDaftarPage />} />
            <Route path="terjemahan" element={<TerjemahanPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
