// Kelas saya (Dosen): daftar kelas yang diampu sebagai kartu. Detail pertemuan, presensi, materi,
// dan pengumuman ada di ruang kelas masing-masing (dosen/kelas/:idKelas).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { Meter } from '../../../components/dashboard/Pelatihan.jsx';
import { JENIS_PELATIHAN, STATUS_KELAS, TIPE_KELAS, formatTanggal } from '../../../config/pelatihan.js';

function KelasTile({ k }) {
  const status = STATUS_KELAS[k.status];
  const ruang = `/dashboard/dosen/kelas/${k.id_kelas}`;
  // Pertemuan hari ini (WIB) yang belum selesai atau presensinya masih dibuka -> tombol pintas presensi
  const tanggalHariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const hariIni = k.pertemuan.find((p) => p.tanggal === tanggalHariIni && (p.status !== 'selesai' || p.status_presensi === 'dibuka'));
  const berikutnya = k.pertemuan.find((p) => p.status !== 'selesai');
  const belumDicatat = k.pertemuan.filter((p) => p.status === 'selesai' && !p.status_presensi).length;

  return (
    <article className="panel kelas-tile">
      <Link to={ruang} className={`kelas-tile-band jenis-${k.jenis_pelatihan}`}>
        <div className="kelas-tile-band-atas">
          <p>{JENIS_PELATIHAN[k.jenis_pelatihan]} · {TIPE_KELAS[k.tipe_kelas]}</p>
          <span className={`badge ${status.badge}`}>{status.label}</span>
        </div>
        <h2>{k.nama_kelas}</h2>
        <span>{k.peserta}/{k.kuota_maks} peserta terverifikasi</span>
      </Link>

      <div className="kelas-tile-body">
        <div className="kelas-tile-progres">
          <span>Pertemuan selesai <strong>{k.pertemuan_selesai}/{k.jumlah_pertemuan}</strong></span>
          <span>Kehadiran <strong>{k.kehadiran === null ? '—' : `${k.kehadiran}%`}</strong></span>
        </div>
        <Meter value={k.pertemuan_selesai} max={k.jumlah_pertemuan} label={`Progres ${k.nama_kelas}`} />
        <p>
          <Icon name="calendar" size={15} />
          {berikutnya
            ? `${berikutnya.status === 'berlangsung' ? 'Sedang berlangsung' : 'Berikutnya'}: ${formatTanggal(berikutnya.tanggal, { weekday: 'short', day: 'numeric', month: 'short' })}, ${berikutnya.jam_mulai}${berikutnya.ruang ? ` · ${berikutnya.ruang}` : ''}`
            : 'Semua pertemuan Anda sudah selesai'}
        </p>
        {belumDicatat > 0 && (
          <Link to={`${ruang}?tab=presensi`} className="kelas-tile-peringatan">
            <Icon name="alert" size={15} /> {belumDicatat} pertemuan belum dicatat presensinya
          </Link>
        )}
        {k.nilai_belum > 0 && (
          <Link to={`${ruang}?tab=nilai`} className="kelas-tile-peringatan">
            <Icon name="clipboard" size={15} /> {k.nilai_belum} peserta belum diinput nilai akhirnya
          </Link>
        )}
      </div>

      <footer className="kelas-tile-aksi">
        {hariIni && (
          <Link to={`${ruang}/presensi/${hariIni.id_pertemuan}`} className="btn btn-primary btn-sm">
            <Icon name="qr" size={15} /> {hariIni.status_presensi === 'dibuka' ? 'Lihat QR presensi' : 'Presensi hari ini'}
          </Link>
        )}
        <Link to={`/dashboard/dosen/kuesioner/${k.id_kelas}`} className="btn btn-outline btn-sm">
          <Icon name="award" size={15} /> Kuesioner
        </Link>
        <Link to={`${ruang}?tab=nilai`} className="btn btn-outline btn-sm">
          <Icon name="clipboard" size={15} /> Input nilai
        </Link>
        <Link to={ruang} className={`btn btn-sm ${hariIni ? 'btn-outline' : 'btn-primary'}`}>
          Buka kelas <Icon name="arrowRight" size={15} />
        </Link>
      </footer>
    </article>
  );
}

function KelasSayaPage() {
  const [kelas, setKelas] = useState(null);
  const [gagal, setGagal] = useState(false);

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
        subtitle="Pilih kelas untuk mengelola pengumuman, materi, presensi, dan peserta."
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
        <div className="kelas-tile-grid">{kelas.map((k) => <KelasTile key={k.id_kelas} k={k} />)}</div>
      )}
    </>
  );
}

export default KelasSayaPage;
