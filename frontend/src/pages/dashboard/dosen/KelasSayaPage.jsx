// Kelas saya (Dosen): semua kelas yang diampu beserta pertemuannya - bagian #70
import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { Meter } from '../../../components/dashboard/Pelatihan.jsx';
import {
  JENIS_PELATIHAN, STATUS_KELAS, STATUS_PRESENSI, STATUS_WAKTU, TIPE_KELAS, formatTanggal,
} from '../../../config/pelatihan.js';
import KelolaPertemuanModal from './KelolaPertemuanModal.jsx';

const TAMPIL_AWAL = 5;

function KelasCard({ k, onKelolaPertemuan }) {
  const [semua, setSemua] = useState(false);
  // Default: tampilkan mulai dari pertemuan yang belum selesai
  const idxBerikut = Math.max(0, k.pertemuan.findIndex((p) => p.status !== 'selesai'));
  const daftar = semua ? k.pertemuan : k.pertemuan.slice(idxBerikut, idxBerikut + TAMPIL_AWAL);
  const status = STATUS_KELAS[k.status];

  return (
    <section className="panel kelas-card">
      <header className="kelas-card-head">
        <div>
          <h2 className="panel-title">{k.nama_kelas}</h2>
          <p className="panel-sub">{JENIS_PELATIHAN[k.jenis_pelatihan]} · {TIPE_KELAS[k.tipe_kelas]}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className={`badge ${status.badge}`}>{status.label}</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={() => onKelolaPertemuan(k)}
          >
            <Icon name="qr" size={15} /> Kelola Pertemuan & Presensi QR
          </button>
        </div>
      </header>

      <div className="kelas-card-stats">
        <div><strong>{k.peserta}/{k.kuota_maks}</strong><span>Peserta terverifikasi</span></div>
        <div><strong>{k.pertemuan.length}</strong><span>Pertemuan Anda</span></div>
        <div><strong>{k.pertemuan_selesai}/{k.jumlah_pertemuan}</strong><span>Selesai</span></div>
        <div><strong>{k.kehadiran === null ? '—' : `${k.kehadiran}%`}</strong><span>Kehadiran</span></div>
      </div>
      <Meter value={k.pertemuan_selesai} max={k.jumlah_pertemuan} label={`Progres ${k.nama_kelas}`} />

      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th className="col-ke">Ke</th>
              <th>Tanggal</th>
              <th>Jam</th>
              <th>Ruang</th>
              <th>Topik</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((p) => (
              <tr key={p.id_pertemuan} className={p.status === 'selesai' ? 'is-muted' : ''}>
                <td className="col-ke"><span className="ke-badge">{p.pertemuan_ke}</span></td>
                <td className="nowrap">
                  <p className="cell-title">{p.hari}</p>
                  <p className="cell-sub">{formatTanggal(p.tanggal)}</p>
                </td>
                <td className="nowrap">{p.jam_mulai}–{p.jam_selesai}</td>
                <td>{p.ruang || <span className="cell-sub">—</span>}</td>
                <td>{p.topik || <span className="cell-sub">—</span>}</td>
                <td className="nowrap">
                  <span className={`badge ${STATUS_WAKTU[p.status].badge}`}>{STATUS_WAKTU[p.status].label}</span>
                  {p.status_presensi && <span className={`badge ${STATUS_PRESENSI[p.status_presensi].badge}`} style={{ marginLeft: 6 }}>{p.hadir} hadir</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {k.pertemuan.length > TAMPIL_AWAL && (
        <button type="button" className="link-btn kelas-card-toggle" onClick={() => setSemua((v) => !v)}>
          {semua ? 'Tampilkan lebih sedikit' : `Tampilkan semua ${k.pertemuan.length} pertemuan`}
        </button>
      )}
    </section>
  );
}

function KelasSayaPage() {
  const [kelas, setKelas] = useState(null);
  const [gagal, setGagal] = useState(false);
  const [modalKelas, setModalKelas] = useState(null);

  const load = useCallback(async () => {
    setGagal(false);
    try {
      const res = await api.get('/dosen/ringkasan');
      setKelas(res.data.data.kelas);
    } catch {
      setGagal(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="Dosen / Kelas saya"
        title="Kelas yang saya ampu"
        subtitle="Daftar kelas dan pertemuan yang dijadwalkan admin untuk Anda."
      />
      {gagal ? (
        <div className="table-message">
          <p>Gagal memuat data kelas.</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
        </div>
      ) : !kelas ? (
        <p className="table-message">Memuat kelas...</p>
      ) : kelas.length === 0 ? (
        <section className="panel">
          <EmptyState icon="graduation" title="Belum ada kelas" text="Kelas akan muncul setelah admin menjadwalkan Anda sebagai pengajar." />
        </section>
      ) : (
        <div className="stack">
          {kelas.map((k) => (
            <KelasCard key={k.id_kelas} k={k} onKelolaPertemuan={(item) => setModalKelas(item)} />
          ))}
        </div>
      )}

      {modalKelas && (
        <KelolaPertemuanModal
          kelas={modalKelas}
          onClose={() => setModalKelas(null)}
          onUpdated={load}
        />
      )}
    </>
  );
}

export default KelasSayaPage;
