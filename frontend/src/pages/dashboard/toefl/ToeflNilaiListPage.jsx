import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';

const STATUS_SESI = {
  dijadwalkan: { label: 'Terjadwal', badge: 'badge-success' },
  selesai: { label: 'Selesai', badge: 'badge-muted' },
};

const formatTanggal = (value) => {
  if (!value) return 'Belum ditentukan';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Belum ditentukan';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
};

const formatJam = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 5);
  return d.toISOString().slice(11, 16);
};

const formatAngka = (val) => (val === null || val === undefined ? '—' : String(val).replace('.', ','));

function ToeflNilaiListPage() {
  const { user } = useAuth();
  const isDosen = user?.role === 'pengajar';
  const basePath = isDosen ? '/dashboard/dosen/toefl' : '/dashboard/admin/toefl';

  const [sesiList, setSesiList] = useState([]);
  const [ringkasan, setRingkasan] = useState({
    total_sesi: 0,
    total_peserta: 0,
    total_hadir: 0,
    sudah_dinilai: 0,
    belum_dinilai: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState({ q: '', status: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/toefl/nilai/sesi');
      setSesiList(Array.isArray(res.data?.data) ? res.data.data : []);
      if (res.data?.ringkasan) {
        setRingkasan(res.data.ringkasan);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal memuat daftar sesi penilaian TOEFL.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return sesiList.filter((item) => (
      (!q || item.nama_sesi?.toLowerCase().includes(q) || (item.ruang || '').toLowerCase().includes(q))
      && (!filter.status || item.status === filter.status)
    ));
  }, [sesiList, filter]);

  const hasFilter = Boolean(filter.q.trim() || filter.status);

  return (
    <>
      <PageHeader
        eyebrow={isDosen ? 'Dosen / Pengelolaan Nilai TOEFL' : 'TOEFL / Administrasi ujian / Nilai'}
        title="Pengelolaan Nilai TOEFL"
        subtitle="Pilih sesi ujian TOEFL untuk menginput Raw Score (jumlah jawaban benar) peserta yang hadir; Converted Score dan Final Score dihitung otomatis dari tabel resmi UPT Bahasa."
        action={
          <button type="button" className="btn btn-soft btn-sm" onClick={load} disabled={loading}>
            <Icon name="refresh" size={15} /> Muat ulang
          </button>
        }
      />

      <div
        className="summary-row"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}
      >
        <div className="summary-item"><strong>{ringkasan.total_sesi}</strong><span>Sesi siap dinilai</span></div>
        <div className="summary-item"><strong>{ringkasan.total_hadir}</strong><span>Peserta hadir</span></div>
        <div className="summary-item"><strong>{ringkasan.sudah_dinilai}</strong><span>Sudah dinilai</span></div>
        <div className="summary-item"><strong>{ringkasan.belum_dinilai}</strong><span>Belum dinilai</span></div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div className="panel-title-wrap">
            <div>
              <h2 className="panel-title">Daftar sesi ujian TOEFL</h2>
              <p className="panel-sub">Menampilkan sesi berstatus Terjadwal dan Selesai beserta progres input nilai peserta hadir.</p>
            </div>
          </div>
          <span className="badge badge-muted">{filtered.length} sesi</span>
        </div>

        <div className="panel-body">
          <div className="toolbar">
            <div className="input-wrap toolbar-search">
              <Icon name="search" size={18} className="input-icon" />
              <input
                className="input"
                placeholder="Cari nama sesi atau ruangan..."
                value={filter.q}
                onChange={(e) => setFilter((prev) => ({ ...prev, q: e.target.value }))}
                aria-label="Cari sesi nilai TOEFL"
              />
            </div>

            <select
              className="input input-plain select"
              value={filter.status}
              onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
              aria-label="Filter status sesi"
            >
              <option value="">Semua status</option>
              <option value="dijadwalkan">Terjadwal</option>
              <option value="selesai">Selesai</option>
            </select>

            {hasFilter && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setFilter({ q: '', status: '' })}
              >
                <Icon name="x" size={14} /> Reset
              </button>
            )}
          </div>

          {loading ? (
            <p className="table-message">Memuat daftar sesi penilaian TOEFL...</p>
          ) : errorMsg ? (
            <div className="table-message" role="alert">
              <p>{errorMsg}</p>
              <button type="button" className="btn btn-soft btn-sm" onClick={load}>
                <Icon name="refresh" size={15} /> Coba lagi
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={hasFilter ? 'search' : 'clipboard'}
              title={hasFilter ? 'Tidak ada sesi yang cocok' : 'Belum ada sesi TOEFL yang dapat dinilai'}
              text={
                hasFilter
                  ? 'Ubah kata kunci pencarian atau filter status sesi.'
                  : 'Sesi TOEFL akan muncul di sini setelah jadwal dirilis (status Terjadwal atau Selesai).'
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sesi TOEFL</th>
                    <th>Jadwal &amp; Ruangan</th>
                    <th>Status Sesi</th>
                    <th className="nowrap">Peserta Hadir</th>
                    <th>Progres Penilaian</th>
                    <th className="nowrap">Rata-rata Final Score</th>
                    <th className="nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const statusMeta = STATUS_SESI[item.status] || { label: item.status, badge: 'badge-muted' };
                    const persen = item.total_hadir > 0
                      ? Math.min(100, Math.round((item.sudah_dinilai / item.total_hadir) * 100))
                      : 0;

                    return (
                      <tr key={item.id_sesi}>
                        <td>
                          <p className="cell-title">{item.nama_sesi}</p>
                          <p className="cell-sub">{item.total_peserta} peserta terverifikasi</p>
                        </td>
                        <td className="nowrap">
                          <p>{formatTanggal(item.tanggal)}</p>
                          <p className="cell-sub">
                            {formatJam(item.jam_mulai)}–{formatJam(item.jam_selesai)} WIB · {item.ruang || 'Ruang belum ditentukan'}
                          </p>
                        </td>
                        <td className="nowrap">
                          <span className={`badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                        </td>
                        <td className="nowrap">
                          <strong>{item.total_hadir}</strong>
                          <span className="cell-sub"> / {item.total_peserta}</span>
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <p className="nowrap" style={{ marginBottom: 4 }}>
                            <strong>{item.sudah_dinilai}</strong> / {item.total_hadir} dinilai
                          </p>
                          <div className="progress" aria-hidden="true">
                            <span style={{ width: `${persen}%` }} />
                          </div>
                          <p className="cell-sub" style={{ marginTop: 2 }}>
                            {item.total_hadir === 0
                              ? 'Belum ada peserta hadir'
                              : item.belum_dinilai === 0
                                ? 'Semua peserta hadir telah dinilai'
                                : `${item.belum_dinilai} peserta belum dinilai`}
                          </p>
                        </td>
                        <td className="nowrap">
                          <strong>{formatAngka(item.rerata_total)}</strong>
                        </td>
                        <td className="nowrap">
                          <Link
                            to={`${basePath}/sesi/${item.id_sesi}/nilai`}
                            className="btn btn-primary btn-sm"
                            style={{ textDecoration: 'none' }}
                          >
                            <Icon name="clipboard" size={14} /> Kelola Nilai
                          </Link>
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
    </>
  );
}

export default ToeflNilaiListPage;
