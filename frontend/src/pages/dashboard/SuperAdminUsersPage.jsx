import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader, StatGrid } from '../../components/dashboard/Widgets.jsx';
import { ROLE_LABELS } from '../../config/roles.js';
import Icon from '../../components/ui/Icon.jsx';

const initialsOf = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const ROLE_BADGE_CLASS = {
  super_admin: 'badge-accent',
  kepala_upt: 'badge-warning',
  staf_upt: 'badge-muted',
  pengajar: 'badge-muted',
  peserta: 'badge-muted',
  penerjemah: 'badge-muted',
};

function SuperAdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, byRole: {} });
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal States
  const [modalCreate, setModalCreate] = useState(false);
  const [modalEdit, setModalEdit] = useState(null);
  const [modalReset, setModalReset] = useState(null);
  const [modalDelete, setModalDelete] = useState(null);

  // Form Create / Edit
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    email: '',
    username: '',
    password: '',
    no_hp: '',
    nim: '',
    program_studi: '',
    tipe_pengguna: 'mahasiswa',
    id_role: '',
    id_role_ekstra: '',
    status_aktif: true,
  });

  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch Master Roles
  const fetchRoles = useCallback(async () => {
    try {
      const res = await api.get('/admin/roles');
      setRoles(res.data.data);
    } catch (err) {
      console.error('Gagal mengambil data role:', err);
    }
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filterRole !== 'all') params.role = filterRole;
      if (filterStatus !== 'all') params.status = filterStatus;

      const res = await api.get('/admin/users', { params });
      setUsers(res.data.data);
      if (res.data.stats) setStats(res.data.stats);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat data akun');
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterStatus]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  // Handle Form Change
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
      nama_lengkap: '',
      email: '',
      username: '',
      password: '',
      no_hp: '',
      nim: '',
      program_studi: '',
      tipe_pengguna: 'mahasiswa',
      id_role: roles[0]?.id_role || '',
      id_role_ekstra: '',
      status_aktif: true,
    });
    setModalCreate(true);
  };

  // Submit Create User
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/users', formData);
      toast.success('Akun pengguna berhasil ditambahkan');
      setModalCreate(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat akun');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u) => {
    setFormData({
      nama_lengkap: u.nama_lengkap,
      email: u.email,
      username: u.username || '',
      password: '',
      no_hp: u.no_hp || '',
      nim: u.nim || '',
      program_studi: u.program_studi || '',
      tipe_pengguna: u.tipe_pengguna || 'mahasiswa',
      id_role: u.id_role || '',
      id_role_ekstra: u.id_role_ekstra || '',
      status_aktif: u.status_aktif,
    });
    setModalEdit(u);
  };

  // Submit Edit User
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/admin/users/${modalEdit.id_pengguna}`, formData);
      toast.success('Perubahan akun berhasil disimpan');
      setModalEdit(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status Aktif
  const handleToggleStatus = async (u) => {
    if (u.id_pengguna === currentUser.id_pengguna) {
      toast.warning('Anda tidak dapat menonaktifkan akun sendiri');
      return;
    }
    try {
      const res = await api.patch(`/admin/users/${u.id_pengguna}/status`);
      toast.success(res.data.message);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah status');
    }
  };

  // Submit Reset Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPasswordVal || resetPasswordVal.length < 8) {
      toast.error('Password baru minimal 8 karakter');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/admin/users/${modalReset.id_pengguna}/reset-password`, {
        password_baru: resetPasswordVal,
      });
      toast.success(`Password untuk ${modalReset.email} berhasil direset`);
      setModalReset(null);
      setResetPasswordVal('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mereset kata sandi');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Delete User
  const handleDeleteSubmit = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/admin/users/${modalDelete.id_pengguna}`);
      toast.success('Pengguna berhasil dihapus');
      setModalDelete(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus pengguna');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Dashboard / Super Admin / Akun & Role"
        title="Kelola Akun & Hak Akses"
        subtitle="Kelola seluruh pengguna sistem, penetapan peran utama, dan aktivasi fitur Switch Role."
        action={
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            <Icon name="plus" size={18} />
            Tambah Akun
          </button>
        }
      />

      {/* Ringkasan Statistik Pengguna */}
      <StatGrid
        items={[
          { label: 'Total Pengguna', value: stats.total, icon: 'users', hint: 'Semua role terdaftar' },
          { label: 'Akun Aktif', value: stats.active, icon: 'checkCircle', hint: 'Dapat login ke portal' },
          { label: 'Akun Nonaktif', value: stats.inactive, icon: 'alert', hint: 'Akses dinonaktifkan' },
          {
            label: 'Dosen & Staf',
            value: (stats.byRole?.pengajar || 0) + (stats.byRole?.staf_upt || 0),
            icon: 'shield',
            hint: 'Pengajar & Tenaga Kependidikan',
          },
        ]}
      />

      {/* Toolbar Pencarian & Filter */}
      <div className="mgmt-toolbar">
        <div className="mgmt-filters">
          <div className="search-box">
            <Icon name="search" size={16} className="input-icon" />
            <input
              type="text"
              placeholder="Cari nama, email, atau NIM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="select-filter"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Semua Peran (Role)</option>
            {roles.map((r) => (
              <option key={r.id_role} value={r.nama_role}>
                {ROLE_LABELS[r.nama_role] || r.nama_role}
              </option>
            ))}
          </select>

          <select
            className="select-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>

        <button type="button" className="btn btn-outline btn-sm" onClick={fetchUsers} title="Refresh Data">
          <Icon name="refresh" size={16} />
          Muat Ulang
        </button>
      </div>

      {/* Tabel Data Pengguna */}
      <div className="table-responsive">
        <table className="mgmt-table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Role Utama</th>
              <th>Role Tambahan (Switch Role)</th>
              <th>Identitas / Kontak</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                  Memuat data pengguna...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                  Tidak ada pengguna yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isMe = u.id_pengguna === currentUser.id_pengguna;
                return (
                  <tr key={u.id_pengguna}>
                    <td>
                      <div className="user-cell">
                        <span className="user-avatar-sm">{initialsOf(u.nama_lengkap)}</span>
                        <div className="user-info">
                          <strong>
                            {u.nama_lengkap}
                            {isMe && <span className="badge badge-accent" style={{ marginLeft: 6, fontSize: '0.68rem' }}>Anda</span>}
                          </strong>
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${ROLE_BADGE_CLASS[u.role] || 'badge-muted'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      {u.role_ekstra ? (
                        <span className="badge badge-warning" title="Pengguna ini dapat beralih ke role ini">
                          <Icon name="switch" size={13} />
                          {ROLE_LABELS[u.role_ekstra] || u.role_ekstra}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {u.nim && <div><strong>NIM:</strong> {u.nim}</div>}
                        {u.program_studi && <div style={{ color: 'var(--muted)' }}>{u.program_studi}</div>}
                        {u.no_hp && <div style={{ color: 'var(--muted)' }}><Icon name="phone" size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{u.no_hp}</div>}
                        {!u.nim && !u.no_hp && !u.program_studi && <span style={{ color: 'var(--muted)' }}>Tipe: {u.tipe_pengguna}</span>}
                      </div>
                    </td>
                    <td>
                      {u.status_aktif ? (
                        <span className="badge badge-success">Aktif</span>
                      ) : (
                        <span className="badge badge-muted" style={{ background: 'var(--danger-50)', color: 'var(--danger)' }}>
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="action-group" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-icon-action"
                          onClick={() => openEditModal(u)}
                          title="Edit Akun & Peran"
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action warning"
                          onClick={() => {
                            setModalReset(u);
                            setResetPasswordVal('');
                          }}
                          title="Reset Kata Sandi"
                        >
                          <Icon name="key" size={15} />
                        </button>
                        <button
                          type="button"
                          className={`btn-icon-action ${u.status_aktif ? 'danger' : ''}`}
                          onClick={() => handleToggleStatus(u)}
                          disabled={isMe}
                          title={isMe ? 'Akun Anda sendiri' : u.status_aktif ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                        >
                          <Icon name={u.status_aktif ? 'x' : 'check'} size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action danger"
                          onClick={() => setModalDelete(u)}
                          disabled={isMe}
                          title={isMe ? 'Akun Anda sendiri' : 'Hapus Akun'}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================
          MODAL: Tambah Pengguna Baru
          ======================================================== */}
      {modalCreate && (
        <div className="modal-overlay" onClick={() => !submitting && setModalCreate(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tambah Akun Pengguna Baru</h3>
              <button type="button" className="icon-btn" onClick={() => setModalCreate(false)} disabled={submitting}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '14px' }}>
                <div className="field">
                  <label className="field-label">Nama Lengkap *</label>
                  <input
                    type="text"
                    name="nama_lengkap"
                    className="input"
                    placeholder="Nama lengkap sesuai KTP / identitas"
                    value={formData.nama_lengkap}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Email *</label>
                    <input
                      type="email"
                      name="email"
                      className="input"
                      placeholder="nama@domain.ac.id"
                      value={formData.email}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Kata Sandi Awal *</label>
                    <input
                      type="password"
                      name="password"
                      className="input"
                      placeholder="Min. 8 karakter"
                      value={formData.password}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Role Utama *</label>
                    <select
                      name="id_role"
                      className="input"
                      value={formData.id_role}
                      onChange={handleFormChange}
                      required
                    >
                      {roles.map((r) => (
                        <option key={r.id_role} value={r.id_role}>
                          {ROLE_LABELS[r.nama_role] || r.nama_role} ({r.keterangan})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field-label">Role Tambahan (Switch Role)</label>
                    <select
                      name="id_role_ekstra"
                      className="input"
                      value={formData.id_role_ekstra}
                      onChange={handleFormChange}
                    >
                      <option value="">— Tidak Ada —</option>
                      {roles
                        .filter((r) => String(r.id_role) !== String(formData.id_role))
                        .map((r) => (
                          <option key={r.id_role} value={r.id_role}>
                            {ROLE_LABELS[r.nama_role] || r.nama_role}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Tipe Pengguna</label>
                    <select
                      name="tipe_pengguna"
                      className="input"
                      value={formData.tipe_pengguna}
                      onChange={handleFormChange}
                    >
                      <option value="mahasiswa">Mahasiswa</option>
                      <option value="internal">Internal / Staf / Dosen</option>
                      <option value="umum">Umum</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">No. HP / WhatsApp</label>
                    <input
                      type="text"
                      name="no_hp"
                      className="input"
                      placeholder="08xxxxxxxxxx"
                      value={formData.no_hp}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                {formData.tipe_pengguna === 'mahasiswa' && (
                  <div className="form-grid-2">
                    <div className="field">
                      <label className="field-label">NIM</label>
                      <input
                        type="text"
                        name="nim"
                        className="input"
                        placeholder="Nomor Induk Mahasiswa"
                        value={formData.nim}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label">Program Studi</label>
                      <input
                        type="text"
                        name="program_studi"
                        className="input"
                        placeholder="contoh: Sistem Informasi"
                        value={formData.program_studi}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalCreate(false)} disabled={submitting}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: Edit Akun & Hak Akses
          ======================================================== */}
      {modalEdit && (
        <div className="modal-overlay" onClick={() => !submitting && setModalEdit(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Akun & Peran Pengguna</h3>
              <button type="button" className="icon-btn" onClick={() => setModalEdit(null)} disabled={submitting}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '14px' }}>
                <div className="field">
                  <label className="field-label">Nama Lengkap *</label>
                  <input
                    type="text"
                    name="nama_lengkap"
                    className="input"
                    value={formData.nama_lengkap}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Email *</label>
                    <input
                      type="email"
                      name="email"
                      className="input"
                      value={formData.email}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">No. HP / WhatsApp</label>
                    <input
                      type="text"
                      name="no_hp"
                      className="input"
                      value={formData.no_hp}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Role Utama *</label>
                    <select
                      name="id_role"
                      className="input"
                      value={formData.id_role}
                      onChange={handleFormChange}
                      required
                    >
                      {roles.map((r) => (
                        <option key={r.id_role} value={r.id_role}>
                          {ROLE_LABELS[r.nama_role] || r.nama_role} ({r.keterangan})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field-label">Role Tambahan (Switch Role)</label>
                    <select
                      name="id_role_ekstra"
                      className="input"
                      value={formData.id_role_ekstra || ''}
                      onChange={handleFormChange}
                    >
                      <option value="">— Tidak Ada —</option>
                      {roles
                        .filter((r) => String(r.id_role) !== String(formData.id_role))
                        .map((r) => (
                          <option key={r.id_role} value={r.id_role}>
                            {ROLE_LABELS[r.nama_role] || r.nama_role}
                          </option>
                        ))}
                    </select>
                    <small style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                      Pilih role ekstra agar akun ini dapat beralih peran (misal Dosen ↔ Admin UPT).
                    </small>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Tipe Pengguna</label>
                    <select
                      name="tipe_pengguna"
                      className="input"
                      value={formData.tipe_pengguna}
                      onChange={handleFormChange}
                    >
                      <option value="mahasiswa">Mahasiswa</option>
                      <option value="internal">Internal / Staf / Dosen</option>
                      <option value="umum">Umum</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Status Akun</label>
                    <select
                      name="status_aktif"
                      className="input"
                      value={formData.status_aktif ? 'true' : 'false'}
                      onChange={(e) => setFormData((p) => ({ ...p, status_aktif: e.target.value === 'true' }))}
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </div>
                </div>

                {formData.tipe_pengguna === 'mahasiswa' && (
                  <div className="form-grid-2">
                    <div className="field">
                      <label className="field-label">NIM</label>
                      <input
                        type="text"
                        name="nim"
                        className="input"
                        value={formData.nim}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label">Program Studi</label>
                      <input
                        type="text"
                        name="program_studi"
                        className="input"
                        value={formData.program_studi}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalEdit(null)} disabled={submitting}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: Reset Kata Sandi
          ======================================================== */}
      {modalReset && (
        <div className="modal-overlay" onClick={() => !submitting && setModalReset(null)}>
          <div className="modal-box" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Kata Sandi Pengguna</h3>
              <button type="button" className="icon-btn" onClick={() => setModalReset(null)} disabled={submitting}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '14px' }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                  Atur ulang kata sandi untuk akun <strong>{modalReset.email}</strong> ({modalReset.nama_lengkap}).
                </p>
                <div className="field">
                  <label className="field-label">Kata Sandi Baru *</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Minimal 8 karakter"
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalReset(null)} disabled={submitting}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Memproses...' : 'Ubah Kata Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: Konfirmasi Hapus Akun
          ======================================================== */}
      {modalDelete && (
        <div className="modal-overlay" onClick={() => !submitting && setModalDelete(null)}>
          <div className="modal-box" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}>Hapus Pengguna</h3>
              <button type="button" className="icon-btn" onClick={() => setModalDelete(null)} disabled={submitting}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: '12px' }}>
              <p style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>
                Apakah Anda yakin ingin menghapus akun <strong>{modalDelete.email}</strong> ({modalDelete.nama_lengkap})?
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', background: 'var(--danger-50)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                Tindakan ini tidak dapat dibatalkan. Jika pengguna ini telah memiliki riwayat transaksi/pendaftaran, sebaiknya ubah statusnya menjadi <strong>Nonaktif</strong>.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setModalDelete(null)} disabled={submitting}>
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleDeleteSubmit}
                disabled={submitting}
              >
                {submitting ? 'Menghapus...' : 'Ya, Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SuperAdminUsersPage;
