import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { DASHBOARDS, ROLE_LABELS, dashboardKeyFor } from '../../config/roles.js';
import Icon from '../ui/Icon.jsx';

const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const config = DASHBOARDS[dashboardKeyFor(user.role)];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dash-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Menu dashboard">
        <div className="sidebar-brand">
          <Link to="/" className="brand">
            <span className="logo-mark">u.</span>
            <span className="brand-text">
              <strong>UPT Bahasa</strong>
              <small>Portal layanan</small>
            </span>
          </Link>
          <button type="button" className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <Icon name="x" />
          </button>
        </div>

        <p className="side-label">Menu {config.label}</p>
        <nav className="side-nav">
          {config.menu.map((item, i) => {
            const active = i === 0;
            return (
              <button
                key={item.label}
                type="button"
                className={`side-link ${active ? 'active' : ''}`}
                disabled={!active}
                aria-current={active ? 'page' : undefined}
                title={active ? undefined : 'Segera hadir'}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <strong>Tahun akademik 2026/2027</strong>
          Dashboard sementara · data belum terhubung
        </div>
      </aside>

      {open && <div className="backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="dash-main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Buka menu">
              <Icon name="menu" />
            </button>
            <p className="crumb">
              Portal UPT<span>/</span>{config.label}<span>/</span><strong>Ringkasan</strong>
            </p>
          </div>

          <div className="topbar-right">
            <button type="button" className="icon-btn" aria-label="Notifikasi">
              <Icon name="bell" />
            </button>
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">{initialsOf(user.nama_lengkap)}</span>
              <span className="user-meta">
                <strong>{user.nama_lengkap}</strong>
                <small>{ROLE_LABELS[user.role] ?? user.role}</small>
              </span>
            </div>
            <button type="button" className="btn btn-soft btn-sm" onClick={handleLogout} aria-label="Keluar">
              <Icon name="logout" size={16} />
              <span className="btn-label">Keluar</span>
            </button>
          </div>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
