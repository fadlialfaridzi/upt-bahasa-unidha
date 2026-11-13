import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';
import { DASHBOARDS, ROLE_LABELS, dashboardKeyFor } from '../../config/roles.js';
import Icon from '../ui/Icon.jsx';

const initialsOf = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// Role yang boleh switch (harus punya role_ekstra)
const SWITCH_LABEL = {
  pengajar: 'Beralih ke Admin UPT',
  staf_upt: 'Beralih ke Dosen',
};

function DashboardLayout() {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const config = DASHBOARDS[dashboardKeyFor(user.role)];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Tampilkan tombol switch hanya jika punya role_ekstra
  const canSwitch = !!user.role_ekstra;
  const switchLabel = SWITCH_LABEL[user.role] || `Beralih ke ${ROLE_LABELS[user.role_ekstra] ?? user.role_ekstra}`;

  const handleSwitchRole = async () => {
    if (!user.role_ekstra) return;
    setSwitching(true);
    try {
      const updated = await switchRole(user.role_ekstra);
      toast.success(`Berhasil beralih ke ${ROLE_LABELS[updated.role] ?? updated.role}`);
      // Redirect ke dashboard yang sesuai role baru
      navigate(dashboardKeyFor(updated.role) === 'superadmin'
        ? '/dashboard/super-admin'
        : `/dashboard/${dashboardKeyFor(updated.role)}`,
        { replace: true }
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal beralih role.');
    } finally {
      setSwitching(false);
    }
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

        {/* Switch Role di sidebar */}
        {canSwitch && (
          <div style={{ padding: '0 1rem 1rem' }}>
            <button
              type="button"
              className="btn btn-soft btn-sm"
              style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              onClick={handleSwitchRole}
              disabled={switching}
            >
              <Icon name="switch" size={16} />
              {switching ? 'Beralih...' : switchLabel}
            </button>
          </div>
        )}

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
            {/* Switch Role di topbar (mobile-friendly) */}
            {canSwitch && (
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={handleSwitchRole}
                disabled={switching}
                title={switchLabel}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon name="switch" size={16} />
                <span className="btn-label">{switching ? 'Beralih...' : switchLabel}</span>
              </button>
            )}

            <button type="button" className="icon-btn" aria-label="Notifikasi">
              <Icon name="bell" />
            </button>

            <div className="user-chip">
              <span className="avatar" aria-hidden="true">{initialsOf(user.nama_lengkap)}</span>
              <span className="user-meta">
                <strong>{user.nama_lengkap}</strong>
                <small>
                  {ROLE_LABELS[user.role] ?? user.role}
                  {user.role_ekstra && (
                    <span style={{ color: '#94a3b8' }}> · juga {ROLE_LABELS[user.role_ekstra] ?? user.role_ekstra}</span>
                  )}
                </small>
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
