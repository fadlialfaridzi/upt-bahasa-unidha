import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { OVERRIDE_STATUS_META, evaluasiRilisSesi, getOverrideSesi } from '../../../utils/toeflOverride.js';

const STATUS = {
  terbuka: { label: 'Pendaftaran dibuka', badge: 'badge-success' },
  menunggu_override: { label: 'Menunggu persetujuan', badge: 'badge-warning' },
  ujian_dibuka: { label: 'Ujian dibuka', badge: 'badge-accent' },
  dijadwalkan: { label: 'Terjadwal', badge: 'badge-success' },
  selesai: { label: 'Selesai', badge: 'badge-muted' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const tanggal = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
};

const waktu = (value) => {
  if (!value) return '-';
  const raw = new Date(value);
  if (Number.isNaN(raw.getTime())) return String(value).slice(0, 5);
  return raw.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
};

function ToeflSesiPage() {
  const [sesi, setSesi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState({ q: '', status: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [releasing, setReleasing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get('/toefl/sesi');
      setSesi(res.data.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return sesi.filter((item) =>
      (!q || item.nama_sesi.toLowerCase().includes(q)) &&
      (!filter.status || item.status === filter.status)
    );
  }, [sesi, filter]);

  const summary = useMemo(() => ({
    total: sesi.length,
    dibuka: sesi.filter((item) => item.status === 'terbuka' || item.status === 'ujian_dibuka').length,
    menunggu: sesi.filter((item) => item.status === 'menunggu_override').length,
    terjadwal: sesi.filter((item) => item.status === 'dijadwalkan').length,
  }), [sesi]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/toefl/sesi/${deleteTarget.id_sesi}`);
      toast.success(res.data.message);
      setSesi((list) => list.filter((item) => item.id_sesi !== deleteTarget.id_sesi));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus sesi');
    } finally {
      setDeleting(false);
    }
  };

  const handleRilis = async (item) => {
    if (releasing !== null) return;
    const evalRilis = evaluasiRilisSesi(item, item.jumlah_lunas || 0);
    if (!evalRilis.canRelease) {
      toast.error(evalRilis.reason || 'Sesi belum memenuhi syarat untuk dirilis');
      return;
    }
    setReleasing(item.id_sesi);
    try {
      const res = await api.post(`/toefl/sesi/${item.id_sesi}/rilis`);
      toast.success(res.data.message);
      setSesi((list) => list.map((row) => row.id_sesi === item.id_sesi ? res.data.data : row));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal merilis jadwal');
    } finally {
      setReleasing(null);
    }
  };

  const hasFilter = filter.q || filter.status;

  return (
    <>
      <PageHeader
        eyebrow="TOEFL / Administrasi ujian"
        title="Kelola Sesi TOEFL"
        subtitle="Buat sesi ujian, pantau kuota, dan rilis jadwal saat peserta telah memenuhi persyaratan."
        action={
          <Link to="/dashboard/admin/toefl/sesi/tambah" className="btn btn-primary">
            <Icon name="plus" size={18} /> Tambah sesi
          </Link>
        }
      />

      <div className="summary-row toefl-summary">
        <div className="summary-item"><strong>{summary.total}</strong><span>Total sesi</span></div>
        <div className="summary-item"><strong>{summary.dibuka}</strong><span>Pendaftaran dibuka</span></div>
        <div className="summary-item"><strong>{summary.menunggu}</strong><span>Menunggu persetujuan</span></div>
        <div className="summary-item"><strong>{summary.terjadwal}</strong><span>Sudah terjadwal</span></div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div className="panel-title-wrap">
            <div>
              <h2 className="panel-title">Daftar sesi ujian</h2>
              <p className="panel-sub">Pantau pendaftaran dan jadwal sesi TOEFL UPT Bahasa.</p>
            </div>
          </div>
          <span className="cell-sub">{tanggal(new Date())}</span>
        </div>

        <div className="panel-body">
          <div className="toolbar">
            <div className="input-wrap toolbar-search">
              <Icon name="search" size={18} className="input-icon" />
              <input
                className="input"
                placeholder="Cari nama atau kode sesi"
                value={filter.q}
                onChange={(e) => setFilter((value) => ({ ...value, q: e.target.value }))}
                aria-label="Cari sesi TOEFL"
              />
            </div>
            <select
              className="input input-plain select"
              value={filter.status}
              onChange={(e) => setFilter((value) => ({ ...value, status: e.target.value }))}
              aria-label="Filter status"
            >
              <option value="">Semua status</option>
              {Object.entries(STATUS).map(([value, status]) => (
                <option key={value} value={value}>{status.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-soft btn-sm" onClick={load} disabled={loading || releasing !== null}>
              <Icon name="refresh" size={15} />
              Muat ulang
            </button>
          </div>

          {loading ? (
            <p className="table-message">Memuat data sesi TOEFL...</p>
          ) : loadError ? (
            <div className="table-message">
              <p>Gagal memuat data sesi TOEFL.</p>
              <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={hasFilter ? 'search' : 'graduation'}
              title={hasFilter ? 'Tidak ada sesi yang cocok' : 'Belum ada sesi ujian'}
              text={hasFilter ? 'Ubah kata kunci atau filter pencarian.' : 'Tambahkan sesi TOEFL pertama untuk membuka pendaftaran.'}
            />
          ) : (
            <div className="table-wrap">
              <table className="table toefl-table">
                <thead>
                  <tr>
                    <th>Sesi / tanggal ujian</th>
                    <th>Waktu / lokasi</th>
                    <th>Kuota peserta</th>
                    <th>Biaya ujian</th>
                    <th>Status pendaftaran</th>
                    <th className="actions"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const status = STATUS[item.status] || STATUS.terbuka;
                    const terverifikasi = item.jumlah_lunas || 0;
                    const persen = Math.min(100, Math.round((terverifikasi / item.kuota_maks) * 100));
                    const itemOverride = getOverrideSesi(item);
                    const overrideMeta = itemOverride ? OVERRIDE_STATUS_META[itemOverride.status] : null;
                    const showOverrideBadge = Boolean(overrideMeta) && item.status !== 'selesai' && item.status !== 'dibatalkan';
                    const replacePrimaryWithOverride = item.status === 'menunggu_override' && showOverrideBadge;
                    const rilisEval = evaluasiRilisSesi(item, terverifikasi);
                    return (
                      <tr key={item.id_sesi}>
                        <td>
                          <p className="cell-title">{item.nama_sesi}</p>
                          <p className="cell-sub">{item.batas_pendaftaran ? `Batas: ${tanggal(item.batas_pendaftaran)}` : 'Belum ada batas pendaftaran'}</p>
                        </td>
                        <td>
                          <p className="nowrap">{item.tanggal ? `${tanggal(item.tanggal)}` : 'Belum dijadwalkan'}</p>
                          <p className="cell-sub">{waktu(item.jam_mulai)}-{waktu(item.jam_selesai)} · {item.ruang || 'Ruangan belum ditentukan'}</p>
                        </td>
                        <td>
                          <p className="nowrap"><strong>{terverifikasi}</strong> / {item.kuota_maks} peserta</p>
                          <div className="progress" aria-hidden="true"><span style={{ width: `${persen}%` }} /></div>
                          <p className="cell-sub">Min. {item.kuota_min} untuk rilis</p>
                        </td>
                        <td className="nowrap"><strong>{rupiah(item.tarif)}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                            {!replacePrimaryWithOverride && (
                              <span className={`badge ${status.badge}`}>{status.label}</span>
                            )}
                            {showOverrideBadge && (
                              <span className={`badge ${overrideMeta.badge}`}>{overrideMeta.label}</span>
                            )}
                            {itemOverride?.status === 'ditolak' && itemOverride.catatan_putusan && item.status !== 'dijadwalkan' && (
                              <p className="cell-sub" style={{ color: 'var(--danger)' }} title={itemOverride.catatan_putusan}>
                                Alasan tolak: {itemOverride.catatan_putusan}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="actions">
                          {rilisEval.showReleaseButton && (
                            <button
                              type="button"
                              className="icon-action"
                              onClick={() => handleRilis(item)}
                              disabled={releasing !== null || !rilisEval.canRelease}
                              aria-label={`Rilis jadwal ${item.nama_sesi}`}
                              title={rilisEval.reason || (rilisEval.viaOverride ? 'Rilis jadwal (Override disetujui)' : 'Rilis jadwal')}
                            >
                              <Icon name="calendar" size={17} />
                            </button>
                          )}
                          {item.status !== 'dibatalkan' && (
                            <Link
                              to={`/dashboard/admin/toefl/sesi/${item.id_sesi}/absensi`}
                              className="icon-action"
                              aria-label={`QR Absensi ${item.nama_sesi}`}
                              title="Kelola QR Absensi TOEFL"
                            >
                              <Icon name="qr" size={17} />
                            </Link>
                          )}
                          <Link
                            to={`/dashboard/admin/toefl/sesi/${item.id_sesi}/edit`}
                            className="icon-action"
                            aria-label={`Ubah ${item.nama_sesi}`}
                            title="Ubah"
                          >
                            <Icon name="pencil" size={17} />
                          </Link>
                          <button
                            type="button"
                            className="icon-action danger"
                            onClick={() => setDeleteTarget(item)}
                            aria-label={`Hapus ${item.nama_sesi}`}
                            title="Hapus"
                          >
                            <Icon name="trash" size={17} />
                          </button>
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

      {deleteTarget && (
        <Modal
          title="Hapus sesi TOEFL?"
          onClose={() => setDeleteTarget(null)}
          busy={deleting}
          size="sm"
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus sesi'}
              </button>
            </>
          }
        >
          <p>
            Sesi <strong>{deleteTarget.nama_sesi}</strong> akan dihapus permanen. Sesi yang sudah memiliki pendaftar tidak dapat dihapus; ubah menjadi <em>Dibatalkan</em>.
          </p>
        </Modal>
      )}
    </>
  );
}

export default ToeflSesiPage;
