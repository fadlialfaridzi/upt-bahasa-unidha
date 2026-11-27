// Kelas saya (mahasiswa): kelas pelatihan yang sudah terverifikasi, masing-masing membuka ruang kelas.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { JENIS_PELATIHAN, TIPE_KELAS, formatTanggal, todayInput } from '../../../config/pelatihan.js';

const jam = (iso) => (iso ? String(iso).slice(11, 16) : '');

/** Pertemuan terdekat mulai hari ini (tanggal WIB). */
function pertemuanBerikutnya(pertemuan = []) {
  const hariIni = todayInput();
  return pertemuan.find((p) => String(p.tanggal).slice(0, 10) >= hariIni) ?? null;
}

function MahasiswaKelasSayaPage() {
  const [kelas, setKelas] = useState(null);
  const [gagal, setGagal] = useState(false);

  const load = useCallback(async () => {
    setGagal(false);
    try {
      const res = await api.get('/pelatihan/my-kelas-materi');
      setKelas(res.data.data || []);
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
        eyebrow="Mahasiswa / Kelas saya"
        title="Kelas saya"
        subtitle="Kelas pelatihan yang sudah aktif. Buka kelas untuk melihat pengumuman, materi, dan presensi."
        action={<Link to="/dashboard/mahasiswa/pelatihan" className="btn btn-outline btn-sm"><Icon name="plus" size={15} /> Daftar kelas lain</Link>}
      />
      {gagal ? (
        <div className="table-message">
          <p>Gagal memuat kelas.</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
        </div>
      ) : !kelas ? (
        <p className="table-message">Memuat kelas...</p>
      ) : kelas.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon="graduation"
            title="Belum ada kelas aktif"
            text="Kelas muncul di sini setelah pembayaran pendaftaran Anda diverifikasi admin. Cek status di menu Daftar pelatihan atau Tagihan."
          />
        </section>
      ) : (
        <div className="kelas-tile-grid">
          {kelas.map(({ id_pendaftaran: id, kelas: k }) => {
            const b = pertemuanBerikutnya(k.pertemuan);
            return (
              <Link key={id} to={`/dashboard/mahasiswa/kelas/${k.id_kelas}`} className="panel kelas-tile">
                <div className={`kelas-tile-band jenis-${k.jenis_pelatihan}`}>
                  <p>{JENIS_PELATIHAN[k.jenis_pelatihan]} · {TIPE_KELAS[k.tipe_kelas]}</p>
                  <h2>{k.nama_kelas}</h2>
                  <span>{k.pengajar?.length ? k.pengajar.join(', ') : 'Pengajar belum dijadwalkan'}</span>
                </div>
                <div className="kelas-tile-body">
                  <p>
                    <Icon name="calendar" size={15} />
                    {b ? `Berikutnya: ${formatTanggal(b.tanggal, { weekday: 'short', day: 'numeric', month: 'short' })}, ${jam(b.jam_mulai)}${b.ruang ? ` · ${b.ruang}` : ''}` : 'Tidak ada pertemuan mendatang'}
                  </p>
                  <p><Icon name="book" size={15} /> {k.total_materi} materi</p>
                </div>
                <span className="kelas-tile-buka">Buka kelas <Icon name="arrowRight" size={15} /></span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default MahasiswaKelasSayaPage;
