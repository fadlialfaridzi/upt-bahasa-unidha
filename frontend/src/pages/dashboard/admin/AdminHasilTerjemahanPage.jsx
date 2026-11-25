import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader, StatGrid } from '../../../components/dashboard/Widgets.jsx';

const STATUS = {
  selesai: { label: 'Selesai', badge: 'badge-success' },
  revisi: { label: 'Revisi diajukan', badge: 'badge-warning' },
  dikerjakan: { label: 'Revisi dikerjakan', badge: 'badge-accent' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const formatTanggal = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';

function AdminHasilTerjemahanPage() {
  const [hasil, setHasil] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadHasil = useCallback(async () => {
    setGagal(false);
    try {
      const response = await api.get('/terjemahan/admin/orders');
      setHasil(response.data.data || []);
    } catch (error) {
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHasil();
  }, [loadHasil]);

  const visibleHasil = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    if (!needle) return hasil;
    return hasil.filter((item) => [
      item.id_pesanan,
      item.pemohon?.nama_lengkap,
      item.pemohon?.nim,
      item.pemohon?.email,
      item.tarif_penerjemahan?.jenis_dokumen,
      item.tarif_penerjemahan?.bahasa_asal,
      item.tarif_penerjemahan?.bahasa_tujuan,
      item.job_order?.penerjemah?.nama_lengkap,
    ].some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(needle)));
  }, [hasil, query]);

  const unduhHasil = async (item) => {
    setDownloadingId(item.id_pesanan);
    try {
      const response = await api.get(`/terjemahan/admin/orders/${item.id_pesanan}/hasil`, {
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'] || '';
      const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        || `hasil-terjemahan-${item.id_pesanan}`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal mengunduh dokumen hasil terjemahan.');
    } finally {
      setDownloadingId(null);
    }
  };

  const statistik = [
    { label: 'Dokumen tersedia', value: hasil.length, icon: 'file', hint: 'Hasil sudah diunggah penerjemah' },
    { label: 'Revisi berjalan', value: hasil.filter((item) => item.status === 'revisi' || item.status === 'dikerjakan').length, icon: 'edit', hint: 'Sedang ditindaklanjuti' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Admin UPT / Penerjemahan"
        title="Dokumen hasil terjemahan"
        subtitle="Lihat daftar hasil yang sudah diunggah dan unduh dokumen untuk keperluan layanan."
        action={<span className="badge badge-muted">Admin UPT</span>}
      />

      <StatGrid items={statistik} />

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2 className="panel-title">Hasil terjemahan</h2>
            <p className="panel-sub">{hasil.length} dokumen tersedia</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={loadHasil} disabled={loading}>
            <Icon name="refresh" size={15} /> Perbarui
          </button>
        </header>

        <div className="toolbar toolbar-single">
          <label className="input-wrap">
            <Icon name="search" size={18} className="input-icon" />
            <input
              className="input"
              placeholder="Cari nomor pesanan, peserta, penerjemah, atau bahasa..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Cari hasil terjemahan"
            />
          </label>
        </div>

        {loading && hasil.length === 0 ? (
          <p className="table-message">Memuat dokumen hasil terjemahan...</p>
        ) : gagal ? (
          <div className="table-message">
            <p>Daftar hasil terjemahan gagal dimuat.</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={loadHasil}>Coba lagi</button>
          </div>
        ) : visibleHasil.length === 0 ? (
          <EmptyState
            icon={query ? 'search' : 'file'}
            title={query ? 'Dokumen tidak ditemukan' : 'Belum ada hasil terjemahan'}
            text={query ? 'Coba kata kunci lain.' : 'Hasil akan muncul di sini setelah penerjemah mengunggah dokumen.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pesanan / dokumen</th>
                  <th>Peserta</th>
                  <th>Penerjemah</th>
                  <th>Bahasa</th>
                  <th>Hasil terakhir</th>
                  <th>Status</th>
                  <th className="actions"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleHasil.map((item) => {
                  const status = STATUS[item.status] || { label: item.status, badge: 'badge-muted' };
                  const job = item.job_order;
                  return (
                    <tr key={item.id_pesanan}>
                      <td>
                        <p className="cell-title">Pesanan #{item.id_pesanan} · {item.tarif_penerjemahan.jenis_dokumen}</p>
                        <p className="cell-sub">{item.jumlah_halaman ?? '—'} halaman · diajukan {formatTanggal(item.tanggal_ajuan)}</p>
                      </td>
                      <td>
                        <p className="cell-title">{item.pemohon.nama_lengkap}</p>
                        <p className="cell-sub">{item.pemohon.nim || item.pemohon.email}</p>
                      </td>
                      <td>
                        <p className="cell-title">{job.penerjemah.nama_lengkap}</p>
                        <p className="cell-sub">{job.penerjemah.email}</p>
                      </td>
                      <td className="nowrap">{item.tarif_penerjemahan.bahasa_asal} → {item.tarif_penerjemahan.bahasa_tujuan}</td>
                      <td className="nowrap">
                        <p>Versi {job.versi_hasil}</p>
                        <p className="cell-sub">{formatTanggal(job.tanggal_unggah_hasil)}</p>
                      </td>
                      <td><span className={`badge ${status.badge}`}>{status.label}</span></td>
                      <td className="actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => unduhHasil(item)}
                          disabled={downloadingId === item.id_pesanan}
                        >
                          <Icon name="download" size={15} />
                          {downloadingId === item.id_pesanan ? 'Menyiapkan...' : 'Unduh'}
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
  );
}

export default AdminHasilTerjemahanPage;
