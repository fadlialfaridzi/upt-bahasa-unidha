import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';

const STATUS = {
  menunggu_pengecekan: { label: 'Menunggu pengecekan', badge: 'badge-warning' },
  menunggu_pembayaran: { label: 'Menunggu pembayaran', badge: 'badge-warning' },
  menunggu_verifikasi: { label: 'Menunggu verifikasi', badge: 'badge-accent' },
  terverifikasi: { label: 'Pembayaran terverifikasi', badge: 'badge-success' },
  dialokasikan: { label: 'Menunggu penerjemah', badge: 'badge-accent' },
  dikerjakan: { label: 'Dalam pengerjaan', badge: 'badge-accent' },
  selesai: { label: 'Selesai', badge: 'badge-success' },
  revisi: { label: 'Revisi diajukan', badge: 'badge-warning' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const MIN_ALASAN_REVISI = 10;
const MAX_ALASAN_REVISI = 1000;

const formatTanggal = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
  : '—';

const formatRupiah = (value) => value == null
  ? 'Belum ditentukan'
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));

const labelRiwayat = (event) => {
  if (event.status === 'dialokasikan') {
    return event.keterangan?.toLocaleLowerCase('id-ID').includes('menerima')
      ? 'Penugasan diterima penerjemah'
      : 'Penerjemah ditugaskan';
  }
  if (event.status === 'dikerjakan') {
    return event.keterangan?.toLocaleLowerCase('id-ID').includes('revisi')
      ? 'Revisi sedang dikerjakan'
      : 'Sedang dikerjakan';
  }
  if (event.status === 'selesai') {
    return event.keterangan?.toLocaleLowerCase('id-ID').includes('revisi')
      ? 'Hasil revisi tersedia'
      : 'Hasil terjemahan tersedia';
  }
  return STATUS[event.status]?.label || event.status;
};

const buatTimeline = (item) => {
  const timeline = [{
    id: `ajuan-${item.id_pesanan}`,
    label: 'Pesanan diajukan',
    detail: 'Pengajuan Anda telah tercatat.',
    waktu: item.tanggal_ajuan,
  }];

  if (item.job_order?.tanggal_alokasi) {
    timeline.push({
      id: `alokasi-${item.job_order.id_job}`,
      label: 'Penerjemah ditugaskan',
      detail: 'Pesanan telah dialokasikan kepada penerjemah.',
      waktu: item.job_order.tanggal_alokasi,
    });
  }

  for (const event of item.riwayat_status_terjemahan || []) {
    timeline.push({
      id: `riwayat-${event.id_riwayat}`,
      label: labelRiwayat(event),
      detail: event.keterangan,
      waktu: event.waktu,
    });
  }

  return timeline.sort((a, b) => new Date(a.waktu) - new Date(b.waktu));
};

function MahasiswaTerjemahanPage() {
  const [pesanan, setPesanan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [revisionId, setRevisionId] = useState(null);
  const [alasan, setAlasan] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadPesanan = useCallback(async () => {
    setGagal(false);
    try {
      const response = await api.get('/terjemahan/my-orders');
      setPesanan(response.data.data || []);
    } catch (error) {
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPesanan();
  }, [loadPesanan]);

  const bukaFormRevisi = (idPesanan) => {
    setRevisionId(idPesanan);
    setAlasan('');
  };

  const unduhHasil = async (item) => {
    setDownloadingId(item.id_pesanan);
    try {
      const response = await api.get(`/terjemahan/my-orders/${item.id_pesanan}/hasil`, {
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

  const kirimPengajuanRevisi = async (event, item) => {
    event.preventDefault();
    const alasanBersih = alasan.trim();
    if (alasanBersih.length < MIN_ALASAN_REVISI) {
      toast.error(`Jelaskan bagian yang perlu direvisi (minimal ${MIN_ALASAN_REVISI} karakter).`);
      return;
    }

    setSubmittingId(item.id_pesanan);
    try {
      const response = await api.post(`/terjemahan/my-orders/${item.id_pesanan}/revisi`, {
        alasan: alasanBersih,
      });
      toast.success(response.data.message);
      setRevisionId(null);
      setAlasan('');
      await loadPesanan();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal mengirim pengajuan revisi.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Portal Peserta / Penerjemahan"
        title="Pesanan penerjemahan saya"
        subtitle="Pantau status pesanan dan sampaikan bagian yang perlu diperbaiki setelah hasil terjemahan tersedia."
        action={(
          <Link to="/terjemahan" className="btn btn-primary">
            <Icon name="plus" size={16} /> Ajukan penerjemahan
          </Link>
        )}
      />

      <section className="panel student-translation-panel">
        <header className="panel-head student-translation-panel-head">
          <div>
            <h2 className="panel-title">Riwayat pesanan</h2>
            <p className="panel-sub">Pengajuan revisi hanya tersedia untuk pesanan yang hasilnya sudah selesai diunggah.</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={loadPesanan} disabled={loading}>
            <Icon name="refresh" size={15} /> Perbarui
          </button>
        </header>

        {loading ? (
          <p className="table-message">Memuat pesanan penerjemahan...</p>
        ) : gagal ? (
          <div className="table-message">
            <p>Pesanan penerjemahan gagal dimuat.</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={loadPesanan}>Coba lagi</button>
          </div>
        ) : pesanan.length === 0 ? (
          <EmptyState
            icon="languages"
            title="Belum ada pesanan penerjemahan"
            text="Pesanan yang Anda ajukan akan tampil di sini setelah tercatat oleh UPT Bahasa."
          />
        ) : (
          <div className="student-translation-list">
            {pesanan.map((item) => {
              const status = STATUS[item.status] || { label: item.status, badge: 'badge-muted' };
              const job = item.job_order;
              const canRequestRevision = item.status === 'selesai' && job?.status === 'selesai' && job.ada_hasil;
              const formId = `revision-form-${item.id_pesanan}`;
              const timeline = buatTimeline(item);

              return (
                <article className="student-translation-card" key={item.id_pesanan}>
                  <header className="student-translation-card-head">
                    <div>
                      <p className="eyebrow">Pesanan #{item.id_pesanan}</p>
                      <h3>{item.tarif_penerjemahan.jenis_dokumen}</h3>
                    </div>
                    <span className={`badge ${status.badge}`}>{status.label}</span>
                  </header>

                  <div className="student-translation-meta">
                    <span><strong>Bahasa</strong>{item.tarif_penerjemahan.bahasa_asal} → {item.tarif_penerjemahan.bahasa_tujuan}</span>
                    <span><strong>Diajukan</strong>{formatTanggal(item.tanggal_ajuan)}</span>
                    <span><strong>Halaman</strong>{item.jumlah_halaman ?? 'Belum ditentukan'}</span>
                    <span><strong>Estimasi biaya</strong>{formatRupiah(item.estimasi_biaya)}</span>
                  </div>

                  <details className="student-translation-timeline">
                    <summary>
                      <span>
                        <strong>Progres pesanan</strong>
                        <small>{status.label}</small>
                      </span>
                      <span className="student-translation-timeline-count">{timeline.length} tahap</span>
                    </summary>
                    <ol>
                      {timeline.map((event) => (
                        <li key={event.id}>
                          <span className="student-translation-timeline-dot" />
                          <div>
                            <strong>{event.label}</strong>
                            {event.detail && <p>{event.detail}</p>}
                            <small>{formatTanggal(event.waktu)}</small>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>

                  {job?.versi_hasil > 0 && (
                    <div className="student-translation-result">
                      <Icon name="file" size={17} />
                      <span>
                        Hasil versi {job.versi_hasil} tersedia
                        {job.tanggal_unggah_hasil ? ` · diunggah ${formatTanggal(job.tanggal_unggah_hasil)}` : ''}
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => unduhHasil(item)}
                        disabled={downloadingId === item.id_pesanan}
                      >
                        <Icon name="download" size={15} />
                        {downloadingId === item.id_pesanan ? 'Menyiapkan...' : 'Unduh hasil'}
                      </button>
                    </div>
                  )}

                  {item.status === 'revisi' && (
                    <div className="student-translation-revision-note" role="status">
                      <strong>Catatan revisi Anda</strong>
                      <p>{job?.catatan_revisi || 'Pengajuan revisi sudah diterima dan menunggu tindak lanjut penerjemah.'}</p>
                      <small>Penerjemah akan melihat catatan ini sebelum mengunggah hasil revisi.</small>
                    </div>
                  )}

                  {canRequestRevision ? (
                    revisionId === item.id_pesanan ? (
                      <form id={formId} className="student-translation-revision-form" onSubmit={(event) => kirimPengajuanRevisi(event, item)}>
                        <label className="field" htmlFor={`revision-reason-${item.id_pesanan}`}>
                          <span className="field-label">Bagian yang perlu direvisi</span>
                          <textarea
                            id={`revision-reason-${item.id_pesanan}`}
                            className="input"
                            value={alasan}
                            onChange={(event) => setAlasan(event.target.value)}
                            minLength={MIN_ALASAN_REVISI}
                            maxLength={MAX_ALASAN_REVISI}
                            rows={4}
                            placeholder="Contoh: Mohon perbaiki penulisan nama pada halaman pertama dan cek kembali paragraf kedua."
                            required
                          />
                          <small className="student-translation-help">
                            Jelaskan secara spesifik agar penerjemah tahu bagian yang perlu diperbaiki. {alasan.trim().length}/{MAX_ALASAN_REVISI} karakter.
                          </small>
                        </label>
                        <div className="student-translation-form-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => { setRevisionId(null); setAlasan(''); }}
                            disabled={submittingId === item.id_pesanan}
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={submittingId === item.id_pesanan || alasan.trim().length < MIN_ALASAN_REVISI}
                          >
                            <Icon name="edit" size={15} />
                            {submittingId === item.id_pesanan ? 'Mengirim...' : 'Kirim pengajuan revisi'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" className="btn btn-outline" onClick={() => bukaFormRevisi(item.id_pesanan)}>
                        <Icon name="edit" size={16} /> Ajukan revisi
                      </button>
                    )
                  ) : item.status === 'selesai' ? (
                    <p className="student-translation-hint">Tombol revisi akan tersedia setelah penerjemah mengunggah hasil.</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default MahasiswaTerjemahanPage;
