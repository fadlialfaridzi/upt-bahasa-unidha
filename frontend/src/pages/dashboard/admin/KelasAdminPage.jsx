import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import KelasFormModal from './KelasFormModal.jsx';
import {
  JENIS_PELATIHAN, STATUS_KELAS, TIPE_KELAS, formatRupiah, formatTanggal, toOptions,
} from '../../../config/pelatihan.js';

function KelasAdminPage() {
  const [kelas, setKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState({ q: '', jenis: '', status: '' });
  const [formTarget, setFormTarget] = useState(null); // null = tertutup, 'new' = buat, objek = ubah
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get('/kelas');
      setKelas(res.data.data);
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
    return kelas.filter(
      (k) =>
        (!q || k.nama_kelas.toLowerCase().includes(q)) &&
        (!filter.jenis || k.jenis_pelatihan === filter.jenis) &&
        (!filter.status || k.status === filter.status)
    );
  }, [kelas, filter]);

  const summary = useMemo(
    () => ({
      total: kelas.length,
      dibuka: kelas.filter((k) => k.status === 'dibuka').length,
      berjalan: kelas.filter((k) => k.status === 'berjalan').length,
      peserta: kelas
        .filter((k) => k.status === 'dibuka' || k.status === 'berjalan')
        .reduce((n, k) => n + k.jumlah_peserta, 0),
    }),
    [kelas]
  );

  const handleSaved = (saved) => {
    setKelas((list) => {
      const exists = list.some((k) => k.id_kelas === saved.id_kelas);
      return exists ? list.map((k) => (k.id_kelas === saved.id_kelas ? saved : k)) : [saved, ...list];
    });
    setFormTarget(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/kelas/${deleteTarget.id_kelas}`);
      toast.success(res.data.message);
      setKelas((list) => list.filter((k) => k.id_kelas !== deleteTarget.id_kelas));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus kelas');
    } finally {
      setDeleting(false);
    }
  };

  const hasFilter = filter.q || filter.jenis || filter.status;
  const setF = (name) => (e) => setFilter((f) => ({ ...f, [name]: e.target.value }));

  return (
    <>
      <PageHeader
        eyebrow="Pelatihan / Manajemen kelas"
        title="Kelas pelatihan"
        subtitle="Buat dan kelola kelas, kuota, tarif, serta periode kuesioner."
        action={
          <button type="button" className="btn btn-primary" onClick={() => setFormTarget('new')}>
            <Icon name="plus" size={18} /> Buat kelas
          </button>
        }
      />

      <div className="summary-row">
        <div className="summary-item"><strong>{summary.total}</strong><span>Total kelas</span></div>
        <div className="summary-item"><strong>{summary.dibuka}</strong><span>Dibuka</span></div>
        <div className="summary-item"><strong>{summary.berjalan}</strong><span>Berjalan</span></div>
        <div className="summary-item"><strong>{summary.peserta}</strong><span>Peserta aktif</span></div>
      </div>

      <section className="panel">
        <div className="toolbar">
          <div className="input-wrap toolbar-search">
            <Icon name="search" size={18} className="input-icon" />
            <input className="input" placeholder="Cari nama kelas" value={filter.q} onChange={setF('q')} aria-label="Cari nama kelas" />
          </div>
          <select className="input input-plain select" value={filter.jenis} onChange={setF('jenis')} aria-label="Filter jenis pelatihan">
            <option value="">Semua jenis</option>
            {toOptions(JENIS_PELATIHAN).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="input input-plain select" value={filter.status} onChange={setF('status')} aria-label="Filter status">
            <option value="">Semua status</option>
            {toOptions(STATUS_KELAS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="table-message">Memuat data kelas...</p>
        ) : loadError ? (
          <div className="table-message">
            <p>Gagal memuat data kelas. Pastikan backend berjalan.</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
          </div>
        ) : filtered.length === 0 ? (
          hasFilter ? (
            <EmptyState icon="search" title="Tidak ada kelas yang cocok" text="Ubah kata kunci atau filter pencarian." />
          ) : (
            <EmptyState icon="book" title="Belum ada kelas" text='Klik "Buat kelas" untuk menambahkan kelas pelatihan pertama.' />
          )
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Mulai</th>
                  <th>Peserta</th>
                  <th>Pertemuan</th>
                  <th className="num">Tarif</th>
                  <th>Status</th>
                  <th className="actions"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => {
                  const persen = Math.min(100, Math.round((k.jumlah_peserta / k.kuota_maks) * 100));
                  const status = STATUS_KELAS[k.status];
                  return (
                    <tr key={k.id_kelas}>
                      <td>
                        <p className="cell-title">{k.nama_kelas}</p>
                        <p className="cell-sub">
                          {JENIS_PELATIHAN[k.jenis_pelatihan]} · {TIPE_KELAS[k.tipe_kelas]}
                        </p>
                      </td>
                      <td className="nowrap">{formatTanggal(k.tanggal_mulai)}</td>
                      <td>
                        <p className="nowrap">{k.jumlah_peserta} / {k.kuota_maks}</p>
                        <div className="progress" aria-hidden="true"><span style={{ width: `${persen}%` }} /></div>
                      </td>
                      <td className="nowrap">{k.pertemuan_terjadwal} / {k.jumlah_pertemuan} <span className="cell-sub">terjadwal</span></td>
                      <td className="num nowrap">{formatRupiah(k.tarif)}</td>
                      <td><span className={`badge ${status.badge}`}>{status.label}</span></td>
                      <td className="actions">
                        <Link to={`/dashboard/admin/kelas/${k.id_kelas}/jadwal`} className="icon-action" aria-label={`Atur jadwal ${k.nama_kelas}`} title="Atur jadwal & pengajar">
                          <Icon name="calendar" size={17} />
                        </Link>
                        <button type="button" className="icon-action" onClick={() => setFormTarget(k)} aria-label={`Ubah ${k.nama_kelas}`} title="Ubah">
                          <Icon name="pencil" size={17} />
                        </button>
                        <button type="button" className="icon-action danger" onClick={() => setDeleteTarget(k)} aria-label={`Hapus ${k.nama_kelas}`} title="Hapus">
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
      </section>

      {formTarget && (
        <KelasFormModal
          kelas={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <Modal
          title="Hapus kelas?"
          onClose={() => setDeleteTarget(null)}
          busy={deleting}
          size="sm"
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus kelas'}
              </button>
            </>
          }
        >
          <p>
            Kelas <strong>{deleteTarget.nama_kelas}</strong> akan dihapus permanen. Kelas yang sudah memiliki pendaftar,
            jadwal, atau materi tidak bisa dihapus. Ubah statusnya menjadi <em>Dibatalkan</em> sebagai gantinya.
          </p>
        </Modal>
      )}
    </>
  );
}

export default KelasAdminPage;
