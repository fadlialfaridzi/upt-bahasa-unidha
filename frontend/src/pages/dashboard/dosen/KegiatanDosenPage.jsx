import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import KegiatanFormModal from './KegiatanFormModal.jsx';
import { HARI, formatTanggal, todayInput } from '../../../config/pelatihan.js';

const NAMA_HARI_PANJANG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const isoTambahHari = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** Senin dari minggu yang memuat tanggal `iso`. */
const awalMinggu = (iso) => {
  const hari = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return isoTambahHari(iso, -((hari + 6) % 7));
};

function KegiatanDosenPage() {
  const [kegiatan, setKegiatan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(null); // 'tambah' | { edit } | { hapus }
  const [deleting, setDeleting] = useState(false);
  const [terdampak, setTerdampak] = useState([]);
  const hariIni = todayInput();
  const [senin, setSenin] = useState(awalMinggu(hariIni));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get('/kegiatan-dosen');
      setKegiatan(res.data.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (list, pertemuanTerdampak) => {
    setKegiatan(list);
    setTerdampak(pertemuanTerdampak);
    setModal(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/kegiatan-dosen/${modal.hapus.id_kegiatan}`);
      toast.success(res.data.message);
      handleSaved(res.data.data, []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus kegiatan');
    } finally {
      setDeleting(false);
    }
  };

  // Kegiatan yang berlaku pada tiap hari di minggu yang ditampilkan (Senin..Minggu)
  const minggu = useMemo(
    () =>
      HARI.map((h, i) => {
        const tanggal = isoTambahHari(senin, i);
        const items = kegiatan
          .filter((g) => g.hari === h.value && g.tanggal_mulai <= tanggal && g.tanggal_selesai >= tanggal)
          .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
        return { ...h, tanggal, items };
      }),
    [kegiatan, senin]
  );

  const urut = useMemo(
    () => [...kegiatan].sort((a, b) => (a.jenis === b.jenis ? 0 : a.jenis === 'rutin' ? -1 : 1)),
    [kegiatan]
  );

  return (
    <>
      <PageHeader
        eyebrow="Dosen / Jadwal kegiatan"
        title="Jadwal kegiatan saya"
        subtitle="Catat waktu Anda tidak bisa mengajar di UPT (mengajar di prodi, rapat, dll). Di luar waktu ini Anda dianggap tersedia saat admin menyusun jadwal kelas."
        action={
          <button type="button" className="btn btn-primary" onClick={() => setModal('tambah')}>
            <Icon name="plus" size={18} /> Tambah kegiatan
          </button>
        }
      />

      {terdampak.length > 0 && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={18} />
          <div>
            <strong>Kegiatan ini bertabrakan dengan jadwal mengajar UPT Anda:</strong>
            <ul>{terdampak.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="alert-meta">Hubungi admin UPT agar pertemuan tersebut dijadwalkan ulang atau diganti pengajarnya.</p>
          </div>
          <button type="button" className="icon-btn alert-close" onClick={() => setTerdampak([])} aria-label="Tutup peringatan">
            <Icon name="x" size={18} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="table-message">Memuat jadwal kegiatan...</p>
      ) : loadError ? (
        <div className="table-message">
          <p>Gagal memuat jadwal kegiatan.</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
        </div>
      ) : (
        <>
          <section className="panel" aria-label="Kegiatan per minggu">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">
                  Minggu {formatTanggal(senin, { day: 'numeric', month: 'short' })} – {formatTanggal(isoTambahHari(senin, 6))}
                </h2>
                <p className="panel-sub">Slot kosong berarti Anda tersedia untuk mengajar di UPT.</p>
              </div>
              <div className="week-nav">
                <button type="button" className="icon-action" onClick={() => setSenin((s) => isoTambahHari(s, -7))} aria-label="Minggu sebelumnya">
                  <Icon name="arrowLeft" size={16} />
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setSenin(awalMinggu(hariIni))}>Minggu ini</button>
                <button type="button" className="icon-action" onClick={() => setSenin((s) => isoTambahHari(s, 7))} aria-label="Minggu berikutnya">
                  <Icon name="arrowRight" size={16} />
                </button>
              </div>
            </header>
            <div className="week-grid">
              {minggu.map((d) => (
                <div key={d.value} className={`week-day ${d.tanggal === hariIni ? 'is-today' : ''}`}>
                  <p className="week-day-head">
                    <strong>{d.label}</strong>
                    <span>{formatTanggal(d.tanggal, { day: 'numeric', month: 'short' })}</span>
                  </p>
                  {d.items.length === 0 ? (
                    <p className="week-free">Tersedia</p>
                  ) : (
                    d.items.map((g) => (
                      <div key={g.id_kegiatan} className="week-item">
                        <span>{g.jam_mulai}–{g.jam_selesai}</span>
                        <strong>{g.judul}</strong>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ marginTop: 20 }}>
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Semua kegiatan</h2>
                <p className="panel-sub">{kegiatan.length} kegiatan tercatat</p>
              </div>
            </header>
            {urut.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="Belum ada kegiatan"
                text="Anda dianggap tersedia di semua waktu. Tambahkan kegiatan agar admin tidak menjadwalkan Anda di jam tersebut."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Kegiatan</th>
                      <th>Waktu</th>
                      <th>Jam</th>
                      <th>Berlaku</th>
                      <th className="actions"><span className="sr-only">Aksi</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {urut.map((g) => {
                      const berakhir = g.tanggal_selesai < hariIni;
                      return (
                        <tr key={g.id_kegiatan} className={berakhir ? 'is-muted' : ''}>
                          <td>
                            <p className="cell-title">{g.judul}</p>
                            <span className={`badge ${g.jenis === 'rutin' ? 'badge-muted' : 'badge-accent'}`}>
                              {g.jenis === 'rutin' ? 'Rutin' : 'Sekali'}
                            </span>
                            {berakhir && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Berakhir</span>}
                          </td>
                          <td className="nowrap">
                            {g.jenis === 'rutin' ? `Setiap ${NAMA_HARI_PANJANG[g.hari]}` : `${NAMA_HARI_PANJANG[g.hari]}, ${formatTanggal(g.tanggal_mulai)}`}
                          </td>
                          <td className="nowrap">{g.jam_mulai}–{g.jam_selesai}</td>
                          <td className="nowrap">
                            {g.jenis === 'rutin' ? `${formatTanggal(g.tanggal_mulai)} – ${formatTanggal(g.tanggal_selesai)}` : '—'}
                          </td>
                          <td className="actions">
                            <button type="button" className="icon-action" onClick={() => setModal({ edit: g })} aria-label={`Ubah ${g.judul}`} title="Ubah">
                              <Icon name="pencil" size={17} />
                            </button>
                            <button type="button" className="icon-action danger" onClick={() => setModal({ hapus: g })} aria-label={`Hapus ${g.judul}`} title="Hapus">
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
        </>
      )}

      {(modal === 'tambah' || modal?.edit) && (
        <KegiatanFormModal kegiatan={modal?.edit ?? null} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.hapus && (
        <Modal
          title="Hapus kegiatan?"
          onClose={() => setModal(null)}
          busy={deleting}
          size="sm"
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)} disabled={deleting}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus kegiatan'}
              </button>
            </>
          }
        >
          <p>
            <strong>{modal.hapus.judul}</strong> akan dihapus. Setelah itu Anda dianggap tersedia pada waktu tersebut.
          </p>
        </Modal>
      )}
    </>
  );
}

export default KegiatanDosenPage;
