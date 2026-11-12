import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardPathFor } from '../../config/roles.js';
import Icon from '../ui/Icon.jsx';

const NAV_LINKS = [
  { href: '/', label: 'Beranda', hash: '' },
  { href: '/#layanan', label: 'Layanan', hash: '#layanan' },
  { href: '/#alur', label: 'Alur Layanan', hash: '#alur' },
  { href: '/#validasi', label: 'Validasi Sertifikat', hash: '#validasi' },
];

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="UPT Bahasa Unidha - Beranda">
      <span className="logo-mark">u.</span>
      <span className="brand-text">
        <strong>UPT Bahasa Unidha</strong>
        <small>Universitas Dharma Andalas</small>
      </span>
    </Link>
  );
}

function Navbar() {
  const { user } = useAuth();
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (link) => pathname === '/' && hash === link.hash;

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Brand />

        <nav className={`site-nav ${open ? 'open' : ''}`} aria-label="Navigasi utama">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={isActive(link) ? 'active' : ''}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="site-actions">
          {user ? (
            <Link to={dashboardPathFor(user.role)} className="btn btn-light btn-sm">
              <Icon name="grid" size={16} />
              <span className="btn-label">Dashboard</span>
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              <Icon name="user" size={16} />
              <span className="btn-label">Masuk</span>
            </Link>
          )}
          <button
            type="button"
            className="nav-toggle"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'x' : 'menu'} size={24} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
