import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { EmptyState, PageHeader, Panel, SoonButton, StatGrid } from '../../components/dashboard/Widgets.jsx';
import { ROLE_LABELS } from '../../config/roles.js';
import Icon from '../../components/ui/Icon.jsx';

const initialsOf = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

function SuperAdminDashboard() {
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, byRole: {} });
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/users')
      .then((res) => {
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.data) setRecentUsers(res.data.data.slice(0, 4));
      })
      .catch((err) => {
        console.error('Gagal mengambil ringkasan dashboard:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard / Super Admin"
        title="Kendali sistem dalam satu layar."
        subtitle="Kelola akun, hak akses, dan parameter sistem, serta pantau jejak aktivitas pengguna."
      />

      <StatGrid
        items={[
          { label: 'Total pengguna', value: stats.total, icon: 'users', hint: 'Seluruh role' },
          { label: 'Role terdaftar', value: 6, icon: 'shield', hint: 'Peserta s.d. super admin' },
          { label: 'Aktivitas hari ini', value: '—', icon: 'history', hint: 'Dari audit log' },
          { label: 'Akun nonaktif', value: stats.inactive, icon: 'user', hint: stats.inactive > 0 ? 'Perlu ditinjau' : 'Semua akun aktif' },
        ]}
      />

      <div className="dash-grid cols-2-1">
        <Panel
          title="Akun & role"
          subtitle="Pengguna terbaru dan hak aksesnya"
          icon="users"
          footer={
            <Link to="/dashboard/super-admin/users" className="btn btn-soft btn-block">
              <Icon name="users" size={18} />
              Kelola akun
            </Link>
          }
        >
          {loading ? (
            <p style={{ padding: '16px', color: 'var(--muted)', textAlign: 'center' }}>Memuat data akun...</p>
          ) : recentUsers.length === 0 ? (
            <EmptyState icon="users" text="Daftar akun beserta role-nya akan tampil di sini." />
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {recentUsers.map((u) => (
                <div
                  key={u.id_pengguna}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--brand-800)',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                      }}
                    >
                      {initialsOf(u.nama_lengkap)}
                    </span>
                    <div>
                      <strong style={{ fontSize: '0.88rem', display: 'block', color: 'var(--ink)' }}>{u.nama_lengkap}</strong>
                      <small style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{u.email}</small>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-muted" style={{ fontSize: '0.72rem' }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    {u.role_ekstra && (
                      <span className="badge badge-warning" style={{ fontSize: '0.72rem' }} title="Role Ekstra">
                        +{ROLE_LABELS[u.role_ekstra] || u.role_ekstra}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Parameter sistem"
          subtitle="Kuota, ambang EWS, batas bayar"
          icon="sliders"
          footer={<SoonButton icon="sliders">Ubah parameter</SoonButton>}
        >
          <EmptyState icon="sliders" text="Nilai dari tabel parameter_sistem akan tampil di sini." />
        </Panel>
      </div>

      <div className="dash-grid cols-2">
        <Panel title="Audit log terbaru" subtitle="Jejak aksi seluruh pengguna (read-only)" icon="history">
          <EmptyState icon="history" title="Belum ada aktivitas" text="Setiap aksi penting pengguna akan tercatat di sini." />
        </Panel>
        <Panel title="Dokumen SOP" subtitle="Panduan operasional layanan" icon="file">
          <EmptyState icon="file" text="Dokumen SOP yang aktif akan tampil di sini." />
        </Panel>
      </div>
    </>
  );
}

export default SuperAdminDashboard;
