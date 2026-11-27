import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyState, PageHeader, StatGrid } from '../../components/dashboard/Widgets.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Modal from '../../components/ui/Modal.jsx';

const OVERRIDE_STATUS = {
  diajukan: { label: 'Diajukan', badge: 'badge-warning' },
  disetujui: { label: 'Disetujui', badge: 'badge-success' },
  ditolak: { label: 'Ditolak', badge: 'badge-danger' },
};

const MIN_ALASAN = 5;
const MAX_ALASAN = 500;

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatDate = (value) => {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Belum ditentukan';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const sortOverrides = (items) => [...items].sort((a, b) => {
  if (a.status === 'diajukan' && b.status !== 'diajukan') return -1;
  if (a.status !== 'diajukan' && b.status === 'diajukan') return 1;
  return new Date(b.tanggal_ajuan || 0) - new Date(a.tanggal_ajuan || 0);
});

const isSameUserId = (a, b) => {
  if (a === null || a === undefined || a === '' || b === null || b === undefined || b === '') {
    return false;
  }
  const numA = Number(a);
  const numB = Number(b);
  return Number.isInteger(numA) && numA > 0 && numA === numB;
};

function SuperAdminOverrideToeflPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Filter & Pencarian
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal States
  const [detailTarget, setDetailTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadOverrides = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await api.get('/toefl/override');
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setOverrides(sortOverrides(rows));
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memuat daftar pengajuan override TOEFL.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  const stats = useMemo(() => {
    let diajukan = 0;
    let disetujui = 0;
    let ditolak = 0;
    for (const item of overrides) {
      if (item.status === 'diajukan') diajukan += 1;
      else if (item.status === 'disetujui') disetujui += 1;
      else if (item.status === 'ditolak') ditolak += 1;
    }
    return { total: overrides.length, diajukan, disetujui, ditolak };
  }, [overrides]);

  const filteredOverrides = useMemo(() => {
    const q = search.trim().toLowerCase();
    return overrides.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!q) return true;
      const namaSesi = (item.sesi?.nama_sesi || '').toLowerCase();
      const namaPengaju = (item.pengaju?.nama_lengkap || '').toLowerCase();
      const emailPengaju = (item.pengaju?.email || '').toLowerCase();
      const alasan = (item.alasan || '').toLowerCase();
      return namaSesi.includes(q) || namaPengaju.includes(q) || emailPengaju.includes(q) || alasan.includes(q);
    });
  }, [overrides, search, statusFilter]);

  const openApproveModal = (item) => {
    if (submitting || item.status !== 'diajukan') return;
    setDetailTarget(null);
    setApproveTarget(item);
  };

  const closeApproveModal = () => {
    if (submitting) return;
    setApproveTarget(null);
  };

  const openRejectModal = (item) => {
    if (submitting || item.status !== 'diajukan') return;
    setDetailTarget(null);
    setRejectReason('');
    setRejectTarget(item);
  };

  const closeRejectModal = () => {
    if (submitting) return;
    setRejectTarget(null);
    setRejectReason('');
  };

  const handleConfirmApprove = async () => {
    if (submitting || !approveTarget) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/toefl/override/${approveTarget.id_override}/putusan`, {
        keputusan: 'setuju',
      });
      toast.success(res.data?.message || 'Permohonan override kuota TOEFL berhasil disetujui');
      setApproveTarget(null);
      await loadOverrides();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyetujui permohonan override');
    } finally {
      setSubmitting(false);
    }
  };

  const trimmedRejectReason = rejectReason.trim();
  const isRejectReasonTooShort = rejectReason.length > 0 && trimmedRejectReason.length < MIN_ALASAN;
  const isRejectReasonTooLong = trimmedRejectReason.length > MAX_ALASAN;
  const canSubmitReject = !submitting
    && Boolean(rejectTarget)
    && trimmedRejectReason.length >= MIN_ALASAN
    && trimmedRejectReason.length <= MAX_ALASAN;

  const handleConfirmReject = async (e) => {
    e?.preventDefault();
    if (submitting || !rejectTarget) return;
    if (trimmedRejectReason.length < MIN_ALASAN) {
      toast.error(`Alasan penolakan wajib diisi minimal ${MIN_ALASAN} karakter`);
      return;
    }
    if (trimmedRejectReason.length > MAX_ALASAN) {
      toast.error(`Alasan penolakan maksimal ${MAX_ALASAN} karakter`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.patch(`/toefl/override/${rejectTarget.id_override}/putusan`, {
        keputusan: 'tolak',
        catatan_putusan: trimmedRejectReason,
      });
      toast.success(res.data?.message || 'Permohonan override kuota TOEFL berhasil ditolak');
      setRejectTarget(null);
      setRejectReason('');
      await loadOverrides();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menolak permohonan override');
    } finally {
      setSubmitting(false);
    }
  };

  const currentUserId = user?.id_pengguna ?? user?.id;

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon="shield"
        title="Akses terbatas"
        text="Halaman persetujuan override TOEFL hanya dapat diakses oleh Kepala UPT Bahasa (Super Admin)."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Dashboard / Super Admin / Override TOEFL"
        title="Persetujuan Override Kuota TOEFL"
        subtitle="Tinjau dan putuskan permohonan pengecualian kuota minimum sesi TOEFL yang diajukan oleh Staf UPT."
        action={
          <button type="button" className="btn btn-soft btn-sm" onClick={loadOverrides} disabled={loading || submitting}>
            <Icon name="refresh" size={16} />
            {loading ? 'Memuat...' : 'Muat ulang'}
          </button>
        }
      />

      {!loading && !errorMessage && stats.diajukan > 0 && (
        <div className="notice notice-warning" role="status">
          <Icon name="alert" size={18} />
          <p>
            <strong>{stats.diajukan} pengajuan override menunggu keputusan.</strong> Permohonan berstatus{' '}
            <strong>Diajukan</strong> diprioritaskan di bagian atas daftar.
          </p>
        </div>
      )}

      <StatGrid
        items={[
          { label: 'Menunggu keputusan', value: stats.diajukan, icon: 'clock', hint: 'Berstatus diajukan' },
          { label: 'Disetujui', value: stats.disetujui, icon: 'checkCircle', hint: 'Lanjut rilis jadwal oleh Staf UPT' },
          { label: 'Ditolak', value: stats.ditolak, icon: 'alert', hint: 'Sesi kembali berstatus terbuka' },
          { label: 'Total pengajuan', value: stats.total, icon: 'shield', hint: 'Seluruh riwayat override' },
        ]}
      />

      <section className="panel">
        <header className="panel-head">
          <div className="panel-title-wrap">
            <span className="icon-tile"><Icon name="shield" /></span>
            <div>
              <h2 className="panel-title">Daftar pengajuan override kuota</h2>
              <p className="panel-sub">
                Persetujuan hanya mengizinkan sesi melewati batas kuota minimum; rilis jadwal tetap dilakukan Staf UPT setelah jadwal lengkap.
              </p>
            </div>
          </div>
          <span className="badge badge-muted">{filteredOverrides.length} tampil</span>
        </header>

        <div className="panel-body">
          <div className="toolbar">
            <div className="input-wrap toolbar-search">
              <Icon name="search" size={18} className="input-icon" />
              <input
                type="text"
                className="input"
                placeholder="Cari nama sesi, pengaju, atau alasan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="input input-plain select"
              aria-label="Filter status pengajuan"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Semua status (prioritas diajukan)</option>
              <option value="diajukan">Diajukan (Menunggu keputusan)</option>
              <option value="disetujui">Disetujui</option>
              <option value="ditolak">Ditolak</option>
            </select>
          </div>

          {loading ? (
            <p className="table-message">Memuat daftar pengajuan override TOEFL...</p>
          ) : errorMessage ? (
            <div className="table-message" role="alert">
              <p>{errorMessage}</p>
              <button type="button" className="btn btn-soft btn-sm" onClick={loadOverrides}>
                <Icon name="refresh" size={15} />
                Coba lagi
              </button>
            </div>
          ) : filteredOverrides.length === 0 ? (
            <EmptyState
              icon="shield"
              title={overrides.length === 0 ? 'Belum ada pengajuan override' : 'Tidak ada pengajuan yang cocok'}
              text={
                overrides.length === 0
                  ? 'Permohonan override kuota minimum TOEFL yang diajukan Staf UPT akan muncul di sini.'
                  : 'Coba ubah kata kunci pencarian atau filter status.'
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sesi TOEFL</th>
                    <th>Tanggal pengajuan</th>
                    <th>Pengaju</th>
                    <th>Peserta / Kuota min</th>
                    <th>Alasan pengajuan</th>
                    <th>Status</th>
                    <th className="actions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOverrides.map((item) => {
                    const statusMeta = OVERRIDE_STATUS[item.status] || { label: item.status, badge: 'badge-muted' };
                    const isPending = item.status === 'diajukan';

                    return (
                      <tr key={item.id_override}>
                        <td>
                          <p className="cell-title">{item.sesi?.nama_sesi || `Sesi #${item.sesi?.id_sesi ?? '-'}`}</p>
                          <p className="cell-sub">
                            {formatDate(item.sesi?.tanggal)} · {item.sesi?.ruang || 'Ruang belum ditentukan'}
                          </p>
                        </td>
                        <td className="nowrap">
                          <p>{formatDateTime(item.tanggal_ajuan)}</p>
                          {item.tanggal_putusan && (
                            <p className="cell-sub">Diputus: {formatDateTime(item.tanggal_putusan)}</p>
                          )}
                        </td>
                        <td>
                          <p className="cell-title">{item.pengaju?.nama_lengkap || '—'}</p>
                          {item.pengaju?.email && <p className="cell-sub">{item.pengaju.email}</p>}
                        </td>
                        <td className="nowrap">
                          <p>
                            <strong>{item.jumlah_terverifikasi ?? 0}</strong> / {item.kuota_min ?? item.sesi?.kuota_min ?? 0} peserta
                          </p>
                          <p className="cell-sub">Terverifikasi / Min.</p>
                        </td>
                        <td style={{ maxWidth: '280px' }}>
                          <p
                            style={{
                              margin: 0,
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                            title={item.alasan}
                          >
                            {item.alasan}
                          </p>
                          {item.status === 'ditolak' && item.catatan_putusan && (
                            <p className="cell-sub" style={{ color: 'var(--danger)', marginTop: 4 }} title={item.catatan_putusan}>
                              Alasan tolak: {item.catatan_putusan}
                            </p>
                          )}
                        </td>
                        <td className="nowrap">
                          <span className={`badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                        </td>
                        <td className="actions">
                          <div className="action-group" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-soft btn-sm"
                              onClick={() => setDetailTarget(item)}
                              disabled={submitting}
                              title="Lihat detail pengajuan"
                            >
                              <Icon name="eye" size={15} />
                              Detail
                            </button>
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => openApproveModal(item)}
                                  disabled={submitting}
                                >
                                  <Icon name="check" size={15} />
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => openRejectModal(item)}
                                  disabled={submitting}
                                >
                                  <Icon name="x" size={15} />
                                  Tolak
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* MODAL: Detail Pengajuan Override */}
      {detailTarget && (
        <Modal
          title="Detail Pengajuan Override TOEFL"
          subtitle={`Pengajuan #${detailTarget.id_override} · ${detailTarget.sesi?.nama_sesi || ''}`}
          onClose={() => !submitting && setDetailTarget(null)}
          busy={submitting}
          size="md"
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDetailTarget(null)}
                disabled={submitting}
              >
                Tutup
              </button>
              {detailTarget.status === 'diajukan' && (
                <>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => openRejectModal(detailTarget)}
                    disabled={submitting}
                  >
                    <Icon name="x" size={16} />
                    Tolak
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openApproveModal(detailTarget)}
                    disabled={submitting}
                  >
                    <Icon name="check" size={16} />
                    Setujui
                  </button>
                </>
              )}
            </>
          }
        >
          <dl className="summary-rows">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`badge ${(OVERRIDE_STATUS[detailTarget.status] || { badge: 'badge-muted' }).badge}`}>
                  {(OVERRIDE_STATUS[detailTarget.status] || { label: detailTarget.status }).label}
                </span>
              </dd>
            </div>
            <div>
              <dt>Sesi TOEFL</dt>
              <dd>{detailTarget.sesi?.nama_sesi || '—'}</dd>
            </div>
            <div>
              <dt>Jadwal & Ruang</dt>
              <dd>
                {formatDate(detailTarget.sesi?.tanggal)} · {detailTarget.sesi?.ruang || 'Ruang belum ditentukan'}
              </dd>
            </div>
            <div>
              <dt>Peserta Terverifikasi</dt>
              <dd>
                <strong>{detailTarget.jumlah_terverifikasi ?? 0}</strong> / {detailTarget.kuota_min ?? detailTarget.sesi?.kuota_min ?? 0} kuota minimum
              </dd>
            </div>
            <div>
              <dt>Pengaju</dt>
              <dd>
                {detailTarget.pengaju?.nama_lengkap || '—'}
                {detailTarget.pengaju?.email ? ` (${detailTarget.pengaju.email})` : ''}
              </dd>
            </div>
            <div>
              <dt>Tanggal Pengajuan</dt>
              <dd>{formatDateTime(detailTarget.tanggal_ajuan)}</dd>
            </div>
            {detailTarget.penyetuju && (
              <div>
                <dt>Diputuskan Oleh</dt>
                <dd>{detailTarget.penyetuju.nama_lengkap}</dd>
              </div>
            )}
            {detailTarget.tanggal_putusan && (
              <div>
                <dt>Tanggal Keputusan</dt>
                <dd>{formatDateTime(detailTarget.tanggal_putusan)}</dd>
              </div>
            )}
          </dl>

          <div className="field" style={{ marginTop: 14 }}>
            <span className="field-label">Alasan pengajuan</span>
            <div className="notice" style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {detailTarget.alasan}
            </div>
          </div>

          {detailTarget.catatan_putusan && (
            <div className="field" style={{ marginTop: 12 }}>
              <span className="field-label">
                {detailTarget.status === 'ditolak' ? 'Alasan penolakan' : 'Catatan keputusan'}
              </span>
              <div className="notice notice-warning" style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {detailTarget.catatan_putusan}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* MODAL: Konfirmasi Persetujuan Override */}
      {approveTarget && (
        <Modal
          title="Setujui Pengajuan Override?"
          subtitle="Konfirmasi persetujuan pengecualian kuota minimum sesi TOEFL."
          onClose={closeApproveModal}
          busy={submitting}
          size="md"
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeApproveModal}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmApprove}
                disabled={submitting}
              >
                <Icon name="check" size={16} />
                {submitting ? 'Memproses...' : 'Ya, Setujui'}
              </button>
            </>
          }
        >
          <dl className="summary-rows">
            <div>
              <dt>Sesi TOEFL</dt>
              <dd>{approveTarget.sesi?.nama_sesi || '—'}</dd>
            </div>
            <div>
              <dt>Pengaju</dt>
              <dd>{approveTarget.pengaju?.nama_lengkap || '—'}</dd>
            </div>
            <div>
              <dt>Peserta Terverifikasi</dt>
              <dd>
                <strong>{approveTarget.jumlah_terverifikasi ?? 0}</strong> / {approveTarget.kuota_min ?? approveTarget.sesi?.kuota_min ?? 0} kuota minimum
              </dd>
            </div>
            <div>
              <dt>Tanggal Pengajuan</dt>
              <dd>{formatDateTime(approveTarget.tanggal_ajuan)}</dd>
            </div>
          </dl>

          <div className="field" style={{ marginTop: 12 }}>
            <span className="field-label">Alasan pengajuan</span>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {approveTarget.alasan}
            </p>
          </div>

          {isSameUserId(approveTarget.pengaju?.id_pengguna, currentUserId) && (
            <div className="notice notice-warning" style={{ marginTop: 12 }}>
              <Icon name="alert" size={18} />
              <p>
                <strong>Prinsip empat mata (Four-Eyes):</strong> Pengajuan ini dibuat oleh akun Anda sendiri dan akan ditolak oleh sistem.
              </p>
            </div>
          )}

          <div className="notice" style={{ marginTop: 12 }}>
            <Icon name="shield" size={18} />
            <p>
              Persetujuan ini hanya mengizinkan sesi melewati batas minimum kuota. Jadwal ujian <strong>tidak dirilis otomatis</strong>; Staf UPT tetap wajib melengkapi jadwal dan melakukan rilis sesi.
            </p>
          </div>
        </Modal>
      )}

      {/* MODAL: Penolakan Override dengan Alasan */}
      {rejectTarget && (
        <Modal
          title="Tolak Pengajuan Override"
          subtitle={`Sesi: ${rejectTarget.sesi?.nama_sesi || ''}`}
          onClose={closeRejectModal}
          busy={submitting}
          size="md"
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeRejectModal}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="submit"
                form="reject-override-form"
                className="btn btn-danger"
                disabled={!canSubmitReject}
              >
                <Icon name="x" size={16} />
                {submitting ? 'Memproses...' : 'Tolak Pengajuan'}
              </button>
            </>
          }
        >
          <form id="reject-override-form" onSubmit={handleConfirmReject} className="form-grid">
            <div className="field field-full">
              <div className="notice" style={{ display: 'block' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{rejectTarget.sesi?.nama_sesi}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.86rem' }}>
                  Pengaju: <strong>{rejectTarget.pengaju?.nama_lengkap || '—'}</strong> · Terverifikasi:{' '}
                  <strong>{rejectTarget.jumlah_terverifikasi ?? 0}/{rejectTarget.kuota_min ?? rejectTarget.sesi?.kuota_min ?? 0}</strong> peserta
                </p>
              </div>
            </div>

            {isSameUserId(rejectTarget.pengaju?.id_pengguna, currentUserId) && (
              <div className="field field-full">
                <div className="notice notice-warning">
                  <Icon name="alert" size={18} />
                  <p>
                    <strong>Prinsip empat mata (Four-Eyes):</strong> Pengajuan ini dibuat oleh akun Anda sendiri dan akan ditolak oleh sistem.
                  </p>
                </div>
              </div>
            )}

            <div className="field field-full">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="alasan-penolakan-override" className="field-label">
                  Alasan penolakan *
                </label>
                <span
                  className="field-hint"
                  style={{ color: isRejectReasonTooLong ? 'var(--danger)' : undefined }}
                >
                  {trimmedRejectReason.length} / {MAX_ALASAN} karakter
                </span>
              </div>
              <textarea
                id="alasan-penolakan-override"
                className="input input-plain"
                rows="4"
                maxLength={MAX_ALASAN}
                placeholder="Jelaskan alasan penolakan pengajuan override kuota minimum (minimal 5 karakter)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={submitting}
                autoFocus
              />
              {isRejectReasonTooShort && (
                <p className="field-error">
                  Alasan penolakan wajib diisi minimal {MIN_ALASAN} karakter (saat ini {trimmedRejectReason.length} karakter).
                </p>
              )}
              {isRejectReasonTooLong && (
                <p className="field-error">
                  Alasan penolakan maksimal {MAX_ALASAN} karakter.
                </p>
              )}
              <p className="field-hint">
                Setelah ditolak, status sesi TOEFL akan dikembalikan menjadi <strong>Terbuka</strong>.
              </p>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default SuperAdminOverrideToeflPage;
