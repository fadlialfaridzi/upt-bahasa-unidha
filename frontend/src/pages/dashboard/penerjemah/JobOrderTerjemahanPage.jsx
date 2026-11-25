import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader, StatGrid } from '../../../components/dashboard/Widgets.jsx';

const STATUS = {
  baru: { label: 'Penugasan baru', badge: 'badge-warning', aksi: 'Tinjau penugasan' },
  dikerjakan: { label: 'Dalam pengerjaan', badge: 'badge-accent', aksi: 'Buka workspace' },
  revisi: { label: 'Perlu revisi', badge: 'badge-danger', aksi: 'Lihat revisi' },
  selesai: { label: 'Selesai', badge: 'badge-success', aksi: 'Lihat detail' },
};

const RIWAYAT_STATUS = {
  dialokasikan: 'Job order ditugaskan',
  dikerjakan: 'Pengerjaan berlangsung',
  revisi: 'Revisi diminta',
  selesai: 'Terjemahan selesai',
};

const formatTanggal = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';

const formatWaktu = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '—';

const formatRupiah = (value) => value == null
  ? '—'
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));

const formatUkuran = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
const BATAS_UKURAN_HASIL = 10 * 1024 * 1024;

const tenggatLabel = (value) => {
  if (!value) return 'Tenggat belum ditentukan';
  const tenggat = new Date(value);
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  tenggat.setHours(0, 0, 0, 0);
  const selisih = Math.round((tenggat - hariIni) / 86400000);
  if (selisih < 0) return `Terlambat ${Math.abs(selisih)} hari`;
  if (selisih === 0) return 'Tenggat hari ini';
  if (selisih === 1) return 'Besok';
  return `${selisih} hari lagi`;
};

function JobOrderTerjemahanPage() {
  const [jobs, setJobs] = useState(null);
  const [ringkasan, setRingkasan] = useState({ baru: 0, dikerjakan: 0, revisi: 0, selesai: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('aktif');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [urutan, setUrutan] = useState('tenggat');
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [aksiBerjalan, setAksiBerjalan] = useState(false);
  const [unduhBerjalan, setUnduhBerjalan] = useState(false);
  const [fileHasil, setFileHasil] = useState(null);
  const [unggahBerjalan, setUnggahBerjalan] = useState(false);
  const [unduhHasilBerjalan, setUnduhHasilBerjalan] = useState(false);
  const [pratinjauBerjalan, setPratinjauBerjalan] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const inputHasilRef = useRef(null);

  const load = useCallback(async () => {
    setGagal(false);
    try {
      const res = await api.get('/terjemahan/job-orders');
      const nextJobs = res.data.data || [];
      setJobs(nextJobs);
      setRingkasan(res.data.ringkasan || { baru: 0, dikerjakan: 0, revisi: 0, selesai: 0 });
      setSelectedId((current) => (
        nextJobs.some((job) => job.id_job === current) ? current : nextJobs[0]?.id_job ?? null
      ));
    } catch (error) {
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleJobs = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    return (jobs || [])
      .filter((job) => (tab === 'selesai' ? job.kategori === 'selesai' : job.kategori !== 'selesai'))
      .filter((job) => statusFilter === 'semua' || job.kategori === statusFilter)
      .filter((job) => !needle || [
        job.kode_job,
        job.nama_file,
        job.jenis_dokumen,
        job.pemohon?.nama_lengkap,
        job.bahasa_asal,
        job.bahasa_tujuan,
      ].some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(needle)))
      .sort((a, b) => urutan === 'terbaru'
        ? new Date(b.tanggal_alokasi) - new Date(a.tanggal_alokasi)
        : new Date(a.tenggat) - new Date(b.tenggat));
  }, [jobs, query, statusFilter, tab, urutan]);

  useEffect(() => {
    if (!visibleJobs.some((job) => job.id_job === selectedId)) {
      setSelectedId(visibleJobs[0]?.id_job ?? null);
    }
  }, [selectedId, visibleJobs]);

  const selectedJob = (jobs || []).find((job) => job.id_job === selectedId) || null;

  useEffect(() => {
    setFileHasil(null);
    setPreviewUrl(null);
    if (inputHasilRef.current) inputHasilRef.current.value = '';
  }, [selectedId]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const jalankanAksi = async (action) => {
    if (!selectedJob) return;
    setAksiBerjalan(true);
    try {
      const res = await api.patch(`/terjemahan/job-orders/${selectedJob.id_job}/status`, { action });
      toast.success(res.data.message);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal memperbarui job order.');
    } finally {
      setAksiBerjalan(false);
    }
  };

  const unduhDokumen = async () => {
    if (!selectedJob) return;
    setUnduhBerjalan(true);
    try {
      const res = await api.get(`/terjemahan/job-orders/${selectedJob.id_job}/dokumen-asli`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = selectedJob.nama_file || `dokumen-${selectedJob.kode_job}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal mengunduh dokumen sumber.');
    } finally {
      setUnduhBerjalan(false);
    }
  };

  const pilihFileHasil = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size === 0) {
      toast.error('File hasil tidak boleh kosong.');
      event.target.value = '';
      setFileHasil(null);
      return;
    }
    if (file && file.size > BATAS_UKURAN_HASIL) {
      toast.error('Ukuran file hasil maksimal 10 MB.');
      event.target.value = '';
      setFileHasil(null);
      return;
    }
    setFileHasil(file);
  };

  const unggahHasil = async (event) => {
    event.preventDefault();
    if (!selectedJob || !fileHasil) return;

    const formData = new FormData();
    formData.append('hasil', fileHasil);
    setUnggahBerjalan(true);
    try {
      const res = await api.post(`/terjemahan/job-orders/${selectedJob.id_job}/hasil`, formData);
      toast.success(res.data.message);
      setFileHasil(null);
      if (inputHasilRef.current) inputHasilRef.current.value = '';
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal mengunggah hasil terjemahan.');
    } finally {
      setUnggahBerjalan(false);
    }
  };

  const unduhHasil = async () => {
    if (!selectedJob) return;
    setUnduhHasilBerjalan(true);
    try {
      const res = await api.get(`/terjemahan/job-orders/${selectedJob.id_job}/hasil`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = selectedJob.nama_file_hasil || `hasil-${selectedJob.kode_job}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal mengunduh hasil terjemahan.');
    } finally {
      setUnduhHasilBerjalan(false);
    }
  };

  const lihatHasil = async () => {
    if (!selectedJob || !selectedJob.nama_file_hasil?.toLowerCase().endsWith('.pdf')) return;
    setPratinjauBerjalan(true);
    try {
      const res = await api.get(`/terjemahan/job-orders/${selectedJob.id_job}/hasil`, { responseType: 'blob' });
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal membuka pratinjau hasil terjemahan.');
    } finally {
      setPratinjauBerjalan(false);
    }
  };

  const statistik = [
    { label: 'Penugasan baru', value: ringkasan.baru, icon: 'inbox', hint: 'Menunggu konfirmasi Anda' },
    { label: 'Dalam pengerjaan', value: ringkasan.dikerjakan, icon: 'clock', hint: 'Job order aktif' },
    { label: 'Perlu revisi', value: ringkasan.revisi, icon: 'edit', hint: 'Tinjau catatan revisi' },
    { label: 'Selesai', value: ringkasan.selesai, icon: 'checkCircle', hint: 'Terjemahan yang telah selesai' },
  ];

  const aksiWorkspace = selectedJob?.kategori === 'baru'
    ? { action: 'terima', label: 'Terima penugasan' }
    : selectedJob?.kategori === 'revisi' && selectedJob.status_job === 'selesai'
      ? { action: 'mulai', label: 'Mulai revisi' }
      : selectedJob?.status_job === 'diterima'
        ? { action: 'mulai', label: 'Mulai pengerjaan' }
        : null;

  return (
    <>
      <PageHeader
        eyebrow="Penerjemahan / Penerjemah"
        title="Kelola job order penerjemahan"
        subtitle="Pantau penugasan, tenggat, dan progres pekerjaan terjemahan yang dialokasikan kepada Anda."
        action={<span className="badge badge-muted">Penerjemah</span>}
      />

      <StatGrid items={statistik} />

      <section className="panel job-order-list-panel">
        <header className="panel-head job-order-panel-head">
          <div>
            <h2 className="panel-title">Job order saya</h2>
            <p className="panel-sub">{jobs?.length ?? '—'} penugasan yang dialokasikan kepada Anda</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            <Icon name="refresh" size={15} /> Perbarui
          </button>
        </header>

        <div className="tabs" role="tablist" aria-label="Filter job order">
          <button type="button" role="tab" aria-selected={tab === 'aktif'} className={`tab ${tab === 'aktif' ? 'active' : ''}`} onClick={() => { setTab('aktif'); setStatusFilter('semua'); }}>
            Aktif <span className="tab-count">{(jobs || []).filter((job) => job.kategori !== 'selesai').length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'selesai'} className={`tab ${tab === 'selesai' ? 'active' : ''}`} onClick={() => { setTab('selesai'); setStatusFilter('semua'); }}>
            Selesai <span className="tab-count">{ringkasan.selesai}</span>
          </button>
        </div>

        <div className="job-order-toolbar">
          <label className="input-wrap">
            <Icon name="search" size={18} className="input-icon" />
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nomor job order, dokumen, atau pemohon..."
              aria-label="Cari job order"
            />
          </label>
          <select className="input select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status">
            <option value="semua">Semua status</option>
            {tab === 'aktif' ? (
              <>
                <option value="baru">Penugasan baru</option>
                <option value="dikerjakan">Dalam pengerjaan</option>
                <option value="revisi">Perlu revisi</option>
              </>
            ) : <option value="selesai">Selesai</option>}
          </select>
          <select className="input select" value={urutan} onChange={(event) => setUrutan(event.target.value)} aria-label="Urutkan job order">
            <option value="tenggat">Tenggat terdekat</option>
            <option value="terbaru">Penugasan terbaru</option>
          </select>
        </div>

        {loading && !jobs ? (
          <p className="table-message">Memuat job order...</p>
        ) : gagal ? (
          <div className="table-message">
            <p>Job order gagal dimuat.</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
          </div>
        ) : visibleJobs.length === 0 ? (
          <EmptyState
            icon={query || statusFilter !== 'semua' ? 'search' : 'languages'}
            title={query || statusFilter !== 'semua'
              ? 'Job order tidak ditemukan'
              : tab === 'selesai'
                ? 'Belum ada job order selesai'
                : 'Belum ada job order aktif'}
            text={query || statusFilter !== 'semua'
              ? 'Coba ubah kata kunci atau filter status.'
              : 'Job order akan tampil di sini setelah dialokasikan kepada akun Penerjemah ini oleh Staf UPT.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="table job-order-table">
              <thead>
                <tr>
                  <th>Job order / dokumen</th>
                  <th>Pemohon</th>
                  <th>Bahasa</th>
                  <th>Tenggat</th>
                  <th>Status</th>
                  <th className="actions"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => {
                  const status = STATUS[job.kategori];
                  const overdue = job.kategori !== 'selesai' && new Date(job.tenggat) < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <tr key={job.id_job} className={selectedId === job.id_job ? 'job-order-selected' : ''}>
                      <td>
                        <p className="cell-title">{job.kode_job} · {job.jenis_dokumen}</p>
                        <p className="cell-sub">{job.nama_file}</p>
                      </td>
                      <td>
                        <p className="cell-title">{job.pemohon?.nama_lengkap || 'Pemohon'}</p>
                        <p className="cell-sub">{job.pemohon?.nim || job.pemohon?.email || '—'}</p>
                      </td>
                      <td className="nowrap">{job.bahasa_asal} → {job.bahasa_tujuan}</td>
                      <td className={overdue ? 'job-order-overdue' : ''}>
                        <p>{formatTanggal(job.tenggat)}</p>
                        <p className="cell-sub">{tenggatLabel(job.tenggat)}</p>
                      </td>
                      <td><span className={`badge ${status.badge}`}>{status.label}</span></td>
                      <td className="actions">
                        <button type="button" className={`btn btn-sm ${selectedId === job.id_job ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSelectedId(job.id_job)}>
                          {status.aksi}
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

      {selectedJob && (
        <section className="job-order-workspace">
          <div className="panel">
            <header className="panel-head job-order-panel-head">
              <div>
                <p className="eyebrow">Workspace job order</p>
                <h2 className="panel-title">{selectedJob.kode_job}</h2>
                <p className="panel-sub">{selectedJob.nama_file}</p>
              </div>
              <span className={`badge ${STATUS[selectedJob.kategori].badge}`}>{STATUS[selectedJob.kategori].label}</span>
            </header>
            <div className="job-order-detail-grid">
              <div><small>Pemohon</small><strong>{selectedJob.pemohon?.nama_lengkap || '—'}</strong></div>
              <div><small>Bahasa</small><strong>{selectedJob.bahasa_asal} → {selectedJob.bahasa_tujuan}</strong></div>
              <div><small>Tenggat</small><strong>{formatTanggal(selectedJob.tenggat)} · {tenggatLabel(selectedJob.tenggat)}</strong></div>
              <div><small>Jenis dokumen</small><strong>{selectedJob.jenis_dokumen}</strong></div>
              <div><small>Jumlah halaman</small><strong>{selectedJob.jumlah_halaman ?? 'Belum ditentukan'}</strong></div>
              <div><small>Estimasi biaya</small><strong>{formatRupiah(selectedJob.estimasi_biaya)}</strong></div>
            </div>
            <div className="job-order-source">
              <span className="icon-tile icon-tile-accent"><Icon name="file" size={17} /></span>
              <div><strong>Dokumen sumber</strong><small>{selectedJob.nama_file}</small></div>
              <button type="button" className="btn btn-outline btn-sm" onClick={unduhDokumen} disabled={unduhBerjalan}>
                <Icon name="download" size={15} /> {unduhBerjalan ? 'Menyiapkan...' : 'Unduh'}
              </button>
            </div>
            {selectedJob.versi_hasil > 0 && (
              <div className="job-order-source job-order-result">
                <span className="icon-tile icon-tile-accent"><Icon name="file" size={17} /></span>
                <div>
                  <strong>Hasil terakhir · versi {selectedJob.versi_hasil}</strong>
                  <small>
                    {selectedJob.nama_file_hasil}
                    {selectedJob.tanggal_unggah_hasil ? ` · ${formatWaktu(selectedJob.tanggal_unggah_hasil)}` : ''}
                  </small>
                </div>
                {selectedJob.nama_file_hasil?.toLowerCase().endsWith('.pdf') && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={lihatHasil} disabled={pratinjauBerjalan}>
                    <Icon name="eye" size={15} /> {pratinjauBerjalan ? 'Membuka...' : 'Lihat PDF'}
                  </button>
                )}
                <button type="button" className="btn btn-outline btn-sm" onClick={unduhHasil} disabled={unduhHasilBerjalan}>
                  <Icon name="download" size={15} /> {unduhHasilBerjalan ? 'Menyiapkan...' : 'Unduh'}
                </button>
              </div>
            )}
            {previewUrl && (
              <div className="job-order-preview">
                <div className="job-order-preview-head">
                  <div>
                    <strong>Pratinjau hasil PDF</strong>
                    <small>{selectedJob.nama_file_hasil}</small>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreviewUrl(null)}>
                    <Icon name="x" size={15} /> Tutup pratinjau
                  </button>
                </div>
                <iframe src={previewUrl} title={`Pratinjau ${selectedJob.nama_file_hasil}`} />
              </div>
            )}
            {selectedJob.catatan_revisi && (
              <div className="job-order-revision" role="note">
                <strong>Catatan revisi</strong>
                <p>{selectedJob.catatan_revisi}</p>
              </div>
            )}
            <div className="job-order-history">
              <h3>Aktivitas terakhir</h3>
              {selectedJob.aktivitas.length ? (
                <ol>
                  {selectedJob.aktivitas.slice(-5).reverse().map((event, index) => (
                    <li key={`${event.status}-${event.waktu}-${index}`}>
                      <span className="job-order-history-dot" />
                      <div>
                        <strong>{event.keterangan || RIWAYAT_STATUS[event.status] || event.status}</strong>
                        <small>{formatWaktu(event.waktu)}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : <p className="cell-sub">Belum ada aktivitas.</p>}
            </div>
          </div>

          <aside className="panel job-order-action-panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Status pekerjaan</h2>
                <p className="panel-sub">Kelola progres job order ini.</p>
              </div>
            </header>
            <div className="job-order-status-summary">
              <span className={`badge ${STATUS[selectedJob.kategori].badge}`}>{STATUS[selectedJob.kategori].label}</span>
              <p>{selectedJob.kategori === 'baru'
                ? 'Tinjau detail penugasan, lalu konfirmasi jika Anda siap mengerjakannya.'
                : selectedJob.kategori === 'revisi'
                  ? 'Periksa catatan revisi sebelum melanjutkan pekerjaan.'
                  : selectedJob.kategori === 'selesai'
                    ? 'Job order ini sudah selesai.'
                    : 'Pantau tenggat dan progres pekerjaan Anda di sini.'}
              </p>
            </div>
            {aksiWorkspace && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => jalankanAksi(aksiWorkspace.action)} disabled={aksiBerjalan}>
                {aksiBerjalan ? 'Memproses...' : aksiWorkspace.label}
              </button>
            )}
            {selectedJob.status_job === 'dikerjakan' && selectedJob.status_pesanan === 'dikerjakan' ? (
              <form className="job-order-upload" onSubmit={unggahHasil}>
                <div>
                  <h3>{selectedJob.versi_hasil > 0 ? 'Unggah hasil revisi' : 'Unggah hasil terjemahan'}</h3>
                  <p>
                    {selectedJob.versi_hasil > 0
                      ? 'Unggah dokumen revisi setelah catatan pemohon ditindaklanjuti.'
                      : 'Unggah dokumen final untuk menyelesaikan job order ini.'}
                  </p>
                </div>
                <label className="field">
                  <span className="field-label">File hasil (PDF atau Word, maks. 10 MB)</span>
                  <input
                    ref={inputHasilRef}
                    className="input job-order-file-input"
                    type="file"
                    name="hasil"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={pilihFileHasil}
                    required
                  />
                </label>
                {fileHasil && (
                  <div className="job-order-file-selected">
                    <Icon name="file" size={16} />
                    <span>{fileHasil.name} · {formatUkuran(fileHasil.size)}</span>
                  </div>
                )}
                <button type="submit" className="btn btn-primary btn-block" disabled={unggahBerjalan || !fileHasil}>
                  {unggahBerjalan
                    ? 'Mengunggah...'
                    : selectedJob.versi_hasil > 0
                      ? 'Kirim hasil revisi'
                      : 'Kirim hasil terjemahan'}
                </button>
              </form>
            ) : (
              <div className="job-order-workflow-note">
                <Icon name="alert" size={16} />
                <span>Unggah hasil tersedia setelah Anda memulai pengerjaan. Pengiriman hasil menandai job order sebagai selesai.</span>
              </div>
            )}
          </aside>
        </section>
      )}
    </>
  );
}

export default JobOrderTerjemahanPage;
