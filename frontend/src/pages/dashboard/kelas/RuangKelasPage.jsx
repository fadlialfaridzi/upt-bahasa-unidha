// Ruang kelas ala Google Classroom (dosen & mahasiswa): Forum (pengumuman + materi), Materi, Presensi, Peserta.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState } from '../../../components/dashboard/Widgets.jsx';
import { Meter } from '../../../components/dashboard/Pelatihan.jsx';
import { BerkasMateri, FormUnggahMateri } from '../../../components/kelas/MateriKelas.jsx';
import KuesionerKelas from '../../../components/kelas/KuesionerKelas.jsx';
import NilaiKelas from '../../../components/kelas/NilaiKelas.jsx';
import {
  JENIS_PELATIHAN, STATUS_KELAS, STATUS_KEHADIRAN, STATUS_WAKTU, TIPE_KELAS, formatTanggal, statusEvaluasi,
} from '../../../config/pelatihan.js';

const MAKS_ISI = 2000;

const inisial = (nama = '') => nama.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
const waktuLengkap = (iso) =>
  new Date(iso).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
function waktuRelatif(iso) {
  const detik = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  if (detik < 7 * 86400) return `${Math.floor(detik / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

/** Penanda "Baru": item yang muncul sejak kunjungan terakhir pengguna ke kelas ini (disimpan di browser). */
function useTerakhirDilihat(kunci, siap) {
  const [batas, setBatas] = useState(null);
  useEffect(() => {
    if (!siap || !kunci) return;
    let sebelumnya = null;
    try {
      sebelumnya = localStorage.getItem(kunci);
      localStorage.setItem(kunci, new Date().toISOString());
    } catch {
      // penyimpanan browser tidak tersedia: tanpa penanda "Baru"
    }
    setBatas(sebelumnya ? new Date(sebelumnya) : null);
  }, [kunci, siap]);
  return batas;
}

function Komposer({ idKelas, nama, onTerkirim }) {
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const kirim = async (e) => {
    e.preventDefault();
    if (!isi.trim()) return;
    setSibuk(true);
    try {
      const res = await api.post(`/ruang-kelas/${idKelas}/pengumuman`, { isi });
      toast.success(res.data.message);
      setIsi('');
      setBuka(false);
      onTerkirim();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memposting pengumuman');
    } finally {
      setSibuk(false);
    }
  };

  if (!buka) {
    return (
      <button type="button" className="panel komposer-tutup" onClick={() => setBuka(true)}>
        <span className="avatar">{inisial(nama)}</span>
        <span>Umumkan sesuatu kepada kelas Anda…</span>
        <Icon name="megaphone" size={18} />
      </button>
    );
  }
  return (
    <form className="panel komposer" onSubmit={kirim}>
      <label className="sr-only" htmlFor="isi-pengumuman">Isi pengumuman</label>
      <textarea
        id="isi-pengumuman"
        className="input textarea"
        rows={4}
        maxLength={MAKS_ISI}
        value={isi}
        onChange={(e) => setIsi(e.target.value)}
        placeholder="Contoh: Pertemuan besok pindah ke Lab Bahasa 2. Jangan lupa bawa headset untuk latihan listening."
        autoFocus
        disabled={sibuk}
      />
      <div className="komposer-aksi">
        <span className="field-hint">{isi.length}/{MAKS_ISI} · peserta kelas mendapat notifikasi</span>
        <div className="action-group">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setBuka(false); setIsi(''); }} disabled={sibuk}>Batal</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={sibuk || !isi.trim()}>
            {sibuk ? 'Memposting...' : 'Posting'}
          </button>
        </div>
      </div>
    </form>
  );
}

function KartuPengumuman({ item, baru, onUbah, onHapus }) {
  const [edit, setEdit] = useState(false);
  const [isi, setIsi] = useState(item.isi);
  const [sibuk, setSibuk] = useState(false);

  const simpan = async () => {
    setSibuk(true);
    try {
      await onUbah(item, isi);
      setEdit(false);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <article className={`panel stream-item${baru ? ' is-baru' : ''}`}>
      <header className="stream-head">
        <span className="avatar">{inisial(item.penulis.nama)}</span>
        <div>
          <strong>{item.penulis.nama}</strong>
          <span title={waktuLengkap(item.waktu)}>
            {waktuRelatif(item.waktu)}{item.diubah ? ' · diedit' : ''}
          </span>
        </div>
        {baru && <span className="badge badge-accent">Baru</span>}
        {item.bisa_kelola && !edit && (
          <div className="stream-menu">
            <button type="button" className="icon-btn" onClick={() => setEdit(true)} aria-label="Edit pengumuman"><Icon name="pencil" size={15} /></button>
            <button type="button" className="icon-btn" onClick={() => onHapus(item)} aria-label="Hapus pengumuman"><Icon name="trash" size={15} /></button>
          </div>
        )}
      </header>
      {edit ? (
        <div className="komposer-edit">
          <textarea className="input textarea" rows={4} maxLength={MAKS_ISI} value={isi} onChange={(e) => setIsi(e.target.value)} disabled={sibuk} aria-label="Ubah pengumuman" />
          <div className="action-group">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEdit(false); setIsi(item.isi); }} disabled={sibuk}>Batal</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={simpan} disabled={sibuk || !isi.trim()}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </div>
      ) : (
        <p className="stream-isi">{item.isi}</p>
      )}
    </article>
  );
}

function KartuMateri({ item, baru, onHapus }) {
  return (
    <article className={`panel stream-item stream-materi${baru ? ' is-baru' : ''}`}>
      <header className="stream-head">
        <span className="icon-tile icon-tile-sm"><Icon name="book" size={16} /></span>
        <div>
          <strong>Materi baru: {item.materi.judul}</strong>
          <span title={waktuLengkap(item.waktu)}>{waktuRelatif(item.waktu)}</span>
        </div>
        {baru && <span className="badge badge-accent">Baru</span>}
      </header>
      <BerkasMateri m={item.materi} onHapus={onHapus} />
    </article>
  );
}

function TabPresensi({ data, idKelas }) {
  const dosen = data.akses === 'kelola';
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">Pertemuan & presensi</h2>
          <p className="panel-sub">{data.ringkasan.pertemuan_selesai} dari {data.pertemuan.length} pertemuan terjadwal sudah berlangsung</p>
        </div>
        {!dosen && data.akses === 'lihat' && data.kehadiran_saya && (
          <Link to="/dashboard/mahasiswa/presensi-ews" className="btn btn-soft btn-sm"><Icon name="qr" size={15} /> Scan presensi</Link>
        )}
      </header>
      {data.pertemuan.length === 0 ? (
        <EmptyState icon="calendar" title="Belum ada jadwal" text="Jadwal pertemuan akan muncul setelah admin menyusunnya." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="col-ke">Ke</th>
                <th>Tanggal</th>
                <th>Jam</th>
                <th>Topik / ruang</th>
                <th>Status</th>
                <th className="num">{dosen ? 'Presensi' : 'Kehadiran saya'}</th>
              </tr>
            </thead>
            <tbody>
              {data.pertemuan.map((p) => (
                <tr key={p.id_pertemuan} className={p.status === 'selesai' ? 'is-muted' : ''}>
                  <td className="col-ke"><span className="ke-badge">{p.pertemuan_ke}</span></td>
                  <td className="nowrap"><p className="cell-title">{p.hari}</p><p className="cell-sub">{formatTanggal(p.tanggal)}</p></td>
                  <td className="nowrap">{p.jam_mulai}–{p.jam_selesai}</td>
                  <td><p className="cell-title">{p.topik || '—'}</p><p className="cell-sub">{p.ruang || ''}{dosen && !p.milik_saya ? ` · ${p.pengajar}` : ''}</p></td>
                  <td className="nowrap"><span className={`badge ${STATUS_WAKTU[p.status].badge}`}>{STATUS_WAKTU[p.status].label}</span></td>
                  <td className="num nowrap">
                    {dosen ? (
                      p.milik_saya ? (
                        <Link to={`/dashboard/dosen/kelas/${idKelas}/presensi/${p.id_pertemuan}`} className={`btn btn-sm ${p.status_presensi === 'dibuka' ? 'btn-primary' : 'btn-outline'}`}>
                          {p.status_presensi === 'dibuka' ? 'Lihat QR' : p.status_presensi ? `Rekap (${p.hadir} hadir)` : p.status === 'akan_datang' ? 'Detail' : 'Catat presensi'}
                        </Link>
                      ) : <span className="cell-sub">Dosen lain</span>
                    ) : p.kehadiran_saya ? (
                      <span className={`badge ${STATUS_KEHADIRAN[p.kehadiran_saya].badge}`}>{STATUS_KEHADIRAN[p.kehadiran_saya].label}</span>
                    ) : p.status_presensi === 'dibuka' ? (
                      <Link to="/dashboard/mahasiswa/presensi-ews" className="btn btn-primary btn-sm">Scan sekarang</Link>
                    ) : (
                      <span className="cell-sub">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RuangKelasPage({ tabAwal = 'forum' }) {
  const { idKelas } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || tabAwal;
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState(null);
  const [hapus, setHapus] = useState(null); // { tipe, item }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/ruang-kelas/${idKelas}`);
      setData(res.data.data);
      setGagal(null);
    } catch (err) {
      setGagal(err.response?.data?.message || 'Gagal memuat kelas');
    }
  }, [idKelas]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const batasBaru = useTerakhirDilihat(user ? `ruang-kelas:${user.id_pengguna ?? user.email}:${idKelas}` : null, !!data);
  const isBaru = useCallback(
    (item) => batasBaru !== null && new Date(item.waktu) > batasBaru && !(item.tipe === 'pengumuman' && item.penulis.id === user?.id_pengguna),
    [batasBaru, user],
  );
  const jumlahBaru = useMemo(() => (data ? data.stream.filter(isBaru).length : 0), [data, isBaru]);

  const pilihTab = (t) => setSearchParams(t === 'forum' ? {} : { tab: t }, { replace: true });

  const ubahPengumuman = async (item, isi) => {
    try {
      const res = await api.put(`/ruang-kelas/pengumuman/${item.id}`, { isi });
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah pengumuman');
      throw err;
    }
  };

  const konfirmasiHapus = async () => {
    setBusy(true);
    try {
      const url = hapus.tipe === 'pengumuman' ? `/ruang-kelas/pengumuman/${hapus.item.id}` : `/materi/${hapus.item.id_materi}`;
      const res = await api.delete(url);
      toast.success(res.data.message);
      setHapus(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    } finally {
      setBusy(false);
    }
  };

  const kembali = user?.role === 'peserta'
    ? { to: '/dashboard/mahasiswa/kelas', label: 'Kelas saya' }
    : { to: '/dashboard/dosen/kelas', label: 'Kelas saya' };

  if (gagal && !data) {
    return (
      <div className="table-message">
        <p>{gagal}</p>
        <Link to={kembali.to} className="btn btn-soft btn-sm">Kembali ke {kembali.label}</Link>
      </div>
    );
  }
  if (!data) return <p className="table-message">Memuat kelas...</p>;

  const { kelas, akses } = data;
  const kelola = akses === 'kelola';
  const status = STATUS_KELAS[kelas.status];
  const materiList = data.stream.filter((s) => s.tipe === 'materi');
  const b = data.berikutnya;

  const tabs = [
    { id: 'forum', label: 'Forum', icon: 'megaphone', count: jumlahBaru || null },
    { id: 'materi', label: 'Materi', icon: 'book', count: data.ringkasan.materi },
    { id: 'presensi', label: 'Presensi', icon: 'qr' },
    ...(kelola ? [{ id: 'nilai', label: 'Nilai', icon: 'clipboard' }] : []),
    { id: 'kuesioner', label: 'Kuesioner', icon: 'award' },
    ...(data.peserta ? [{ id: 'peserta', label: 'Peserta', icon: 'users', count: data.ringkasan.peserta }] : []),
  ];

  return (
    <>
      <Link to={kembali.to} className="back-link dash-back"><Icon name="arrowLeft" size={16} /> {kembali.label}</Link>

      <header className={`kelas-banner jenis-${kelas.jenis_pelatihan}`}>
        <div>
          <p className="kelas-banner-eyebrow">{JENIS_PELATIHAN[kelas.jenis_pelatihan]} · {TIPE_KELAS[kelas.tipe_kelas]}</p>
          <h1>{kelas.nama_kelas}</h1>
          <p className="kelas-banner-sub">
            {data.pengajar.length ? data.pengajar.map((p) => p.nama).join(', ') : 'Pengajar belum dijadwalkan'}
            {' · '}{data.ringkasan.peserta} peserta
          </p>
        </div>
        <span className={`badge ${status.badge}`}>{status.label}</span>
      </header>

      <nav className="tabs kelas-tabs" aria-label="Bagian kelas">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => pilihTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <Icon name={t.icon} size={16} /> {t.label}
            {t.count ? <span className="tab-count">{t.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === 'forum' && (
        <div className="forum-layout">
          <aside className="forum-aside">
            <section className="panel forum-card">
              <p className="forum-card-label">Pertemuan berikutnya</p>
              {b ? (
                <>
                  <strong>{b.hari}, {formatTanggal(b.tanggal, { day: 'numeric', month: 'short' })}</strong>
                  <span>{b.jam_mulai}–{b.jam_selesai}{b.ruang ? ` · ${b.ruang}` : ''}</span>
                  <span>Pertemuan ke-{b.pertemuan_ke}{b.topik ? ` · ${b.topik}` : ''}</span>
                  {kelola && b.milik_saya && (
                    <Link to={`/dashboard/dosen/kelas/${kelas.id_kelas}/presensi/${b.id_pertemuan}`} className="link-btn">
                      {b.status_presensi === 'dibuka' ? 'Lihat QR presensi' : 'Buka halaman presensi'}
                    </Link>
                  )}
                  {!kelola && b.status_presensi === 'dibuka' && !b.kehadiran_saya && (
                    <Link to="/dashboard/mahasiswa/presensi-ews" className="btn btn-primary btn-sm">Presensi dibuka · scan sekarang</Link>
                  )}
                </>
              ) : (
                <span>Tidak ada pertemuan mendatang</span>
              )}
            </section>
            {data.kehadiran_saya && (
              <section className="panel forum-card">
                <p className="forum-card-label">Kehadiran saya</p>
                <strong className="forum-angka">{data.kehadiran_saya.persen === null ? '—' : `${data.kehadiran_saya.persen}%`}</strong>
                <Meter value={data.kehadiran_saya.hadir} max={data.kehadiran_saya.sesi || 1} label="Kehadiran saya" />
                <span>{data.kehadiran_saya.hadir} hadir dari {data.kehadiran_saya.sesi} sesi presensi</span>
              </section>
            )}
            {data.nilai_saya && (
              <section className="panel forum-card">
                <p className="forum-card-label">Hasil evaluasi pelatihan</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <strong className="forum-angka">
                    {data.nilai_saya.nilai_akhir === null ? '—' : String(data.nilai_saya.nilai_akhir).replace('.', ',')}
                  </strong>
                  <span className={`badge ${statusEvaluasi(data.nilai_saya.nilai_pretest, data.nilai_saya.nilai_akhir).badge}`}>
                    {statusEvaluasi(data.nilai_saya.nilai_pretest, data.nilai_saya.nilai_akhir).label}
                  </span>
                </div>
                <dl className="forum-ringkas">
                  <div>
                    <dt>Nilai pre-test</dt>
                    <dd>{data.nilai_saya.nilai_pretest === null ? '—' : String(data.nilai_saya.nilai_pretest).replace('.', ',')}</dd>
                  </div>
                  <div>
                    <dt>Nilai akhir</dt>
                    <dd>{data.nilai_saya.nilai_akhir === null ? '—' : String(data.nilai_saya.nilai_akhir).replace('.', ',')}</dd>
                  </div>
                  {data.nilai_saya.nilai_pretest !== null && data.nilai_saya.nilai_akhir !== null && (
                    <div>
                      <dt>Perkembangan (Δ)</dt>
                      <dd>
                        {data.nilai_saya.nilai_akhir - data.nilai_saya.nilai_pretest > 0 ? '+' : ''}
                        {String(Math.round((data.nilai_saya.nilai_akhir - data.nilai_saya.nilai_pretest) * 100) / 100).replace('.', ',')}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
            <section className="panel forum-card">
              <p className="forum-card-label">Kelas ini</p>
              <dl className="forum-ringkas">
                <div><dt>Pengumuman</dt><dd>{data.ringkasan.pengumuman}</dd></div>
                <div><dt>Materi</dt><dd>{data.ringkasan.materi}</dd></div>
                <div><dt>Pertemuan</dt><dd>{data.ringkasan.pertemuan_selesai}/{kelas.jumlah_pertemuan}</dd></div>
              </dl>
            </section>
          </aside>

          <div className="forum-stream">
            {kelola && (
              <>
                <Komposer idKelas={kelas.id_kelas} nama={user?.nama_lengkap} onTerkirim={load} />
                <button type="button" className="link-btn forum-unggah" onClick={() => pilihTab('materi')}>
                  <Icon name="upload" size={15} /> Unggah materi untuk kelas ini
                </button>
              </>
            )}
            {data.stream.length === 0 ? (
              <section className="panel">
                <EmptyState
                  icon="megaphone"
                  title="Belum ada aktivitas"
                  text={kelola ? 'Posting pengumuman atau unggah materi pertama untuk peserta kelas ini.' : 'Pengumuman dan materi dari dosen akan muncul di sini.'}
                />
              </section>
            ) : (
              data.stream.map((item) => (item.tipe === 'pengumuman' ? (
                <KartuPengumuman key={`p${item.id}`} item={item} baru={isBaru(item)} onUbah={ubahPengumuman} onHapus={(it) => setHapus({ tipe: 'pengumuman', item: it })} />
              ) : (
                <KartuMateri key={`m${item.id}`} item={item} baru={isBaru(item)} onHapus={kelola ? (m) => setHapus({ tipe: 'materi', item: m }) : undefined} />
              )))
            )}
          </div>
        </div>
      )}

      {tab === 'materi' && (
        <div className={kelola ? 'materi-layout' : ''}>
          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Materi kelas</h2>
                <p className="panel-sub">{materiList.length ? `${materiList.length} materi, terbaru di atas` : 'Belum ada materi'}</p>
              </div>
            </header>
            {materiList.length === 0 ? (
              <EmptyState icon="book" title="Belum ada materi" text={kelola ? 'Unggah materi pertama melalui formulir di samping.' : 'Materi dari dosen akan muncul di sini.'} />
            ) : (
              <div className="materi-list">
                {materiList.map((item) => (
                  <BerkasMateri key={item.id} m={item.materi} onHapus={kelola ? (m) => setHapus({ tipe: 'materi', item: m }) : undefined} />
                ))}
              </div>
            )}
          </section>
          {kelola && (
            <section className="panel materi-form">
              <header className="panel-head">
                <div>
                  <h2 className="panel-title">Unggah materi</h2>
                  <p className="panel-sub">Muncul di Forum & tab Materi peserta</p>
                </div>
              </header>
              <FormUnggahMateri idKelas={kelas.id_kelas} batas={data.batas_materi} onSelesai={load} />
            </section>
          )}
        </div>
      )}

      {tab === 'presensi' && <TabPresensi data={data} idKelas={kelas.id_kelas} />}

      {tab === 'nilai' && kelola && <NilaiKelas idKelas={kelas.id_kelas} onTersimpan={load} />}

      {tab === 'kuesioner' && <KuesionerKelas idKelas={kelas.id_kelas} isDosen={kelola} />}

      {tab === 'peserta' && data.peserta && (
        <div className="peserta-layout">
          <section className="panel">
            <header className="panel-head"><h2 className="panel-title">Pengajar</h2></header>
            <ul className="orang-list">
              {data.pengajar.map((p) => (
                <li key={p.id}><span className="avatar">{inisial(p.nama)}</span><strong>{p.nama}</strong></li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Peserta</h2>
                <span className="panel-sub">{data.peserta.length} terverifikasi</span>
              </div>
              {kelola && data.peserta.length > 0 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => pilihTab('nilai')}>
                  <Icon name="clipboard" size={15} /> Input nilai peserta
                </button>
              )}
            </header>
            {data.peserta.length === 0 ? (
              <EmptyState icon="users" title="Belum ada peserta" text="Peserta muncul setelah pembayarannya diverifikasi admin." />
            ) : (
              <ul className="orang-list">
                {data.peserta.map((p) => {
                  const st = statusEvaluasi(p.nilai_pretest, p.nilai_akhir);
                  return (
                    <li key={p.id_pendaftaran}>
                      <span className="avatar">{inisial(p.nama_lengkap)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block' }}>{p.nama_lengkap}</strong>
                        <span>{[p.nim, p.program_studi].filter(Boolean).join(' · ') || 'Peserta umum'}</span>
                      </div>
                      <div className="orang-nilai">
                        {(p.nilai_pretest !== null || p.nilai_akhir !== null) && (
                          <span title="Nilai Pre-test → Nilai Akhir">
                            Pre: <strong>{p.nilai_pretest ?? '—'}</strong> · Akhir: <strong>{p.nilai_akhir ?? '—'}</strong>
                          </span>
                        )}
                        <span className={`badge ${st.badge}`}>{st.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {hapus && (
        <Modal
          title={hapus.tipe === 'pengumuman' ? 'Hapus pengumuman?' : 'Hapus materi?'}
          size="sm"
          onClose={() => setHapus(null)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setHapus(null)} disabled={busy}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={konfirmasiHapus} disabled={busy}>{busy ? 'Menghapus...' : 'Hapus'}</button>
            </>
          }
        >
          <p>
            {hapus.tipe === 'pengumuman'
              ? 'Pengumuman ini akan hilang dari forum kelas.'
              : <>Berkas <strong>{hapus.item.nama_file}</strong> akan dihapus permanen dan tidak bisa diunduh peserta lagi.</>}
          </p>
        </Modal>
      )}
    </>
  );
}

export default RuangKelasPage;
