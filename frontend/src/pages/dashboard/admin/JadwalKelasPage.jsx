import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import GenerateJadwalModal from './GenerateJadwalModal.jsx';
import PertemuanFormModal from './PertemuanFormModal.jsx';
import {
  JENIS_PELATIHAN, STATUS_KELAS, STATUS_PRESENSI, TIPE_KELAS, formatTanggal,
} from '../../../config/pelatihan.js';

// Pertemuan yang presensinya sudah dibuka tidak boleh dihapus.
const bisaDihapus = (p) => !p.status_presensi && !p.jumlah_presensi;

function JadwalKelasPage() {
  const { id } = useParams();
  const [dipilih, setDipilih] = useState([]); // id_pertemuan untuk hapus massal
  const pilihSemuaRef = useRef(null);
  const [kelas, setKelas] = useState(null);
  const [pertemuan, setPertemuan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null); // 'generate' | 'tambah' | { edit } | { hapus }
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [k, p] = await Promise.all([api.get(`/kelas/${id}`), api.get(`/kelas/${id}/pertemuan`)]);
      setKelas(k.data.data);
      setPertemuan(p.data.data);
    } catch (err) {
      setLoadError(err.response?.status === 404 ? 'Kelas tidak ditemukan.' : 'Gagal memuat jadwal. Pastikan backend berjalan.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (list) => {
    setPertemuan(list);
    setKelas((k) => ({ ...k, pertemuan_terjadwal: list.length }));
    // Buang pilihan yang sudah tidak ada / tidak bisa dihapus lagi
    setDipilih((d) => d.filter((pid) => list.some((p) => p.id_pertemuan === pid && bisaDihapus(p))));
    setModal(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/kelas/${id}/pertemuan/${modal.hapus.id_pertemuan}`);
      toast.success(res.data.message);
      handleSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus pertemuan');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteMassal = async () => {
    setDeleting(true);
    try {
      const res = await api.post(`/kelas/${id}/pertemuan/hapus`, { ids: dipilih });
      toast.success(res.data.message);
      setDipilih([]);
      handleSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus pertemuan');
    } finally {
      setDeleting(false);
    }
  };

  const bisaDihapusIds = useMemo(() => pertemuan.filter(bisaDihapus).map((p) => p.id_pertemuan), [pertemuan]);
  const semuaDipilih = bisaDihapusIds.length > 0 && dipilih.length === bisaDihapusIds.length;
  const sebagianDipilih = dipilih.length > 0 && !semuaDipilih;

  useEffect(() => {
    if (pilihSemuaRef.current) pilihSemuaRef.current.indeterminate = sebagianDipilih;
  }, [sebagianDipilih]);

  const togglePilih = (pid) =>
    setDipilih((d) => (d.includes(pid) ? d.filter((x) => x !== pid) : [...d, pid]));
  const togglePilihSemua = () => setDipilih(semuaDipilih ? [] : bisaDihapusIds);

  const pertemuanDipilih = pertemuan.filter((p) => dipilih.includes(p.id_pertemuan));

  const ringkasan = useMemo(() => {
    const namaPengajar = [...new Set(pertemuan.map((p) => p.pengajar.nama_lengkap))];
    return {
      pengajar: namaPengajar,
      awal: pertemuan[0]?.tanggal,
      akhir: pertemuan[pertemuan.length - 1]?.tanggal,
    };
  }, [pertemuan]);

  const backLink = (
    <Link to="/dashboard/admin/kelas" className="back-link">
      <Icon name="arrowLeft" size={16} /> Kembali ke daftar kelas
    </Link>
  );

  if (loading) return <>{backLink}<p className="table-message">Memuat jadwal...</p></>;
  if (loadError) {
    return (
      <>
        {backLink}
        <div className="table-message">
          <p>{loadError}</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
        </div>
      </>
    );
  }

  const sisa = kelas.jumlah_pertemuan - pertemuan.length;
  const terkunci = ['selesai', 'dibatalkan'].includes(kelas.status);
  const status = STATUS_KELAS[kelas.status];

  return (
    <>
      {backLink}
      <PageHeader
        eyebrow="Pelatihan / Plotting jadwal"
        title={kelas.nama_kelas}
        subtitle={`${JENIS_PELATIHAN[kelas.jenis_pelatihan]} · ${TIPE_KELAS[kelas.tipe_kelas]} · kuota ${kelas.kuota_maks} peserta`}
        action={
          !terkunci && (
            <div className="page-actions">
              <button type="button" className="btn btn-outline" onClick={() => setModal('tambah')} disabled={sisa <= 0}>
                <Icon name="plus" size={18} /> Tambah pertemuan
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setModal('generate')} disabled={sisa <= 0}>
                <Icon name="calendar" size={18} /> Buat jadwal otomatis
              </button>
            </div>
          )
        }
      />

      {terkunci && (
        <div className="notice" role="note">
          <Icon name="alert" size={18} />
          <p>Kelas berstatus <strong>{status.label}</strong>, jadwal tidak dapat diubah.</p>
        </div>
      )}

      <div className="summary-row">
        <div className="summary-item">
          <strong>{pertemuan.length} / {kelas.jumlah_pertemuan}</strong>
          <span>Pertemuan terjadwal</span>
        </div>
        <div className="summary-item">
          <strong>{Math.max(sisa, 0)}</strong>
          <span>Belum dijadwalkan</span>
        </div>
        <div className="summary-item">
          <strong>{ringkasan.pengajar.length}</strong>
          <span title={ringkasan.pengajar.join(', ')}>Pengajar terlibat</span>
        </div>
        <div className="summary-item">
          <strong className="summary-text">
            {ringkasan.awal ? `${formatTanggal(ringkasan.awal, { day: 'numeric', month: 'short' })} – ${formatTanggal(ringkasan.akhir)}` : '—'}
          </strong>
          <span>Rentang jadwal</span>
        </div>
      </div>

      {dipilih.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Aksi massal">
          <span><strong>{dipilih.length}</strong> pertemuan dipilih</span>
          <div className="bulk-bar-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDipilih([])}>Batal pilih</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setModal('hapusMassal')}>
              <Icon name="trash" size={16} /> Hapus terpilih
            </button>
          </div>
        </div>
      )}

      <section className="panel">
        {pertemuan.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Belum ada jadwal"
            text={terkunci ? 'Kelas ini tidak memiliki jadwal.' : 'Klik "Buat jadwal otomatis" untuk menyusun pertemuan sekaligus beserta pengajarnya.'}
          />
        ) : (
          <div className="table-wrap table-wrap-flush">
            <table className="table">
              <thead>
                <tr>
                  {!terkunci && (
                    <th className="col-check">
                      <input
                        ref={pilihSemuaRef}
                        type="checkbox"
                        className="check"
                        checked={semuaDipilih}
                        onChange={togglePilihSemua}
                        disabled={!bisaDihapusIds.length}
                        aria-label="Pilih semua pertemuan"
                      />
                    </th>
                  )}
                  <th className="col-ke">Ke</th>
                  <th>Tanggal</th>
                  <th>Jam</th>
                  <th>Ruang</th>
                  <th>Pengajar</th>
                  <th>Topik</th>
                  <th className="actions"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {pertemuan.map((p) => {
                  const presensi = STATUS_PRESENSI[p.status_presensi];
                  const bisaHapus = bisaDihapus(p);
                  const terpilih = dipilih.includes(p.id_pertemuan);
                  return (
                    <tr key={p.id_pertemuan} className={terpilih ? 'is-selected' : ''}>
                      {!terkunci && (
                        <td className="col-check">
                          <input
                            type="checkbox"
                            className="check"
                            checked={terpilih}
                            onChange={() => togglePilih(p.id_pertemuan)}
                            disabled={!bisaHapus}
                            aria-label={`Pilih pertemuan ${p.pertemuan_ke}`}
                            title={bisaHapus ? undefined : 'Presensi sudah dibuka'}
                          />
                        </td>
                      )}
                      <td className="col-ke"><span className="ke-badge">{p.pertemuan_ke}</span></td>
                      <td className="nowrap">
                        <p className="cell-title">{p.hari}</p>
                        <p className="cell-sub">{formatTanggal(p.tanggal)}</p>
                      </td>
                      <td className="nowrap">{p.jam_mulai}–{p.jam_selesai}</td>
                      <td>{p.ruang || <span className="cell-sub">—</span>}</td>
                      <td className="nowrap">{p.pengajar.nama_lengkap}</td>
                      <td>
                        {p.topik || <span className="cell-sub">—</span>}
                        {presensi && <p><span className={`badge ${presensi.badge}`}>{presensi.label}</span></p>}
                      </td>
                      <td className="actions">
                        {!terkunci && (
                          <>
                            <button type="button" className="icon-action" onClick={() => setModal({ edit: p })} aria-label={`Ubah pertemuan ${p.pertemuan_ke}`} title="Ubah">
                              <Icon name="pencil" size={17} />
                            </button>
                            <button
                              type="button"
                              className="icon-action danger"
                              onClick={() => setModal({ hapus: p })}
                              disabled={!bisaHapus}
                              aria-label={`Hapus pertemuan ${p.pertemuan_ke}`}
                              title={bisaHapus ? 'Hapus' : 'Presensi sudah dibuka'}
                            >
                              <Icon name="trash" size={17} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal === 'generate' && (
        <GenerateJadwalModal kelas={kelas} sisa={sisa} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {(modal === 'tambah' || modal?.edit) && (
        <PertemuanFormModal
          kelas={kelas}
          pertemuan={modal?.edit ?? null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal === 'hapusMassal' && (
        <Modal
          title={`Hapus ${pertemuanDipilih.length} pertemuan?`}
          onClose={() => setModal(null)}
          busy={deleting}
          size="sm"
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)} disabled={deleting}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteMassal} disabled={deleting}>
                {deleting ? 'Menghapus...' : `Hapus ${pertemuanDipilih.length} pertemuan`}
              </button>
            </>
          }
        >
          <p>Pertemuan berikut akan dihapus, lalu nomor pertemuan yang tersisa diurutkan ulang:</p>
          <ul className="hapus-list">
            {pertemuanDipilih.map((p) => (
              <li key={p.id_pertemuan}>
                <span className="ke-badge">{p.pertemuan_ke}</span>
                {p.hari}, {formatTanggal(p.tanggal)} · {p.jam_mulai}–{p.jam_selesai}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {modal?.hapus && (
        <Modal
          title={`Hapus pertemuan ${modal.hapus.pertemuan_ke}?`}
          onClose={() => setModal(null)}
          busy={deleting}
          size="sm"
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)} disabled={deleting}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus pertemuan'}
              </button>
            </>
          }
        >
          <p>
            Pertemuan <strong>{modal.hapus.hari}, {formatTanggal(modal.hapus.tanggal)}</strong> ({modal.hapus.jam_mulai}–{modal.hapus.jam_selesai})
            akan dihapus. Nomor pertemuan lain akan diurutkan ulang.
          </p>
        </Modal>
      )}
    </>
  );
}

export default JadwalKelasPage;
