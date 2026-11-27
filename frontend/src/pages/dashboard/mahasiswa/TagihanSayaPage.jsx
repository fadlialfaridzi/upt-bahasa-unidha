// Tagihan saya (mahasiswa): semua tagihan TOEFL, pelatihan, dan penerjemahan dalam satu halaman.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { Meter } from '../../../components/dashboard/Pelatihan.jsx';
import { formatRupiah, formatTanggal } from '../../../config/pelatihan.js';

const LAYANAN = {
  toefl: { label: 'TOEFL', icon: 'graduation' },
  pelatihan: { label: 'Pelatihan', icon: 'book' },
  penerjemahan: { label: 'Penerjemahan', icon: 'languages' },
};

const STATUS_TAGIHAN = {
  menunggu_pembayaran: { label: 'Belum dibayar', badge: 'badge-warning' },
  menunggu_verifikasi: { label: 'Menunggu verifikasi', badge: 'badge-accent' },
  menunggu_persetujuan_angsuran: { label: 'Menunggu persetujuan cicilan', badge: 'badge-muted' },
  sebagian: { label: 'Cicilan berjalan', badge: 'badge-accent' },
  lunas: { label: 'Lunas', badge: 'badge-success' },
  kedaluwarsa: { label: 'Kedaluwarsa', badge: 'badge-danger' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const STATUS_CICILAN = {
  belum_terbit: { label: 'Belum terbit', badge: 'badge-muted' },
  menunggu_pembayaran: { label: 'Belum dibayar', badge: 'badge-warning' },
  menunggu_verifikasi: { label: 'Menunggu verifikasi', badge: 'badge-accent' },
  lunas: { label: 'Lunas', badge: 'badge-success' },
};

const STATUS_BUKTI = {
  menunggu: 'Bukti dikirim, menunggu verifikasi admin',
  terverifikasi: 'Bukti diterima admin',
  ditolak: 'Bukti ditolak admin',
};

const FILTER_STATUS = {
  semua: { label: 'Semua status', cocok: () => true },
  bayar: { label: 'Perlu dibayar', cocok: (t) => t.harus_dibayar > 0 },
  verifikasi: { label: 'Menunggu verifikasi', cocok: (t) => t.status === 'menunggu_verifikasi' || t.cicilan?.some((c) => c.status === 'menunggu_verifikasi') },
  lunas: { label: 'Lunas', cocok: (t) => t.status === 'lunas' },
};

const TIPE_BUKTI = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAKS_BUKTI = 5 * 1024 * 1024;

const lewatBatas = (t) => t.batas_bayar && t.harus_dibayar > 0 && new Date(t.batas_bayar) < new Date();

/** Kirim bukti ke endpoint layanan yang sesuai (alur verifikasi tiap layanan berbeda). */
async function kirimBukti(tagihan, cicilan, file) {
  const form = new FormData();
  form.append('bukti', file);
  if (tagihan.jenis_layanan === 'toefl') {
    form.append('id_pendaftaran', tagihan.layanan.id_pendaftaran);
    return api.post('/toefl/pembayaran/upload', form, { timeout: 0 });
  }
  form.append('id_tagihan', tagihan.id_tagihan);
  if (cicilan) form.append('id_cicilan', cicilan.id_cicilan);
  return api.post('/pelatihan/pembayaran/upload', form, { timeout: 0 });
}

function UnggahBuktiModal({ target, onClose, onSelesai }) {
  const { tagihan, cicilan } = target;
  const [file, setFile] = useState(null);
  const [pratinjau, setPratinjau] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nominal = cicilan ? cicilan.nominal : tagihan.harus_dibayar || tagihan.sisa;

  useEffect(() => () => pratinjau && URL.revokeObjectURL(pratinjau), [pratinjau]);

  const pilih = (f) => {
    setError('');
    if (pratinjau) URL.revokeObjectURL(pratinjau);
    setPratinjau(null);
    setFile(null);
    if (!f) return;
    if (!TIPE_BUKTI.includes(f.type)) return setError('Format bukti harus JPG, PNG, WebP, atau PDF');
    if (f.size > MAKS_BUKTI) return setError('Ukuran bukti maksimal 5 MB');
    setFile(f);
    if (f.type !== 'application/pdf') setPratinjau(URL.createObjectURL(f));
  };

  const kirim = async (e) => {
    e.preventDefault();
    if (!file) return setError('Pilih foto atau berkas bukti pembayaran');
    setBusy(true);
    try {
      const res = await kirimBukti(tagihan, cicilan, file);
      toast.success(res.data?.message || 'Bukti pembayaran terkirim. Menunggu verifikasi admin.');
      onSelesai();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengunggah bukti pembayaran');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Unggah bukti pembayaran"
      subtitle={`${cicilan ? `${cicilan.kode_termin} · cicilan ke-${cicilan.cicilan_ke}` : tagihan.kode_tagihan} · ${tagihan.layanan.nama}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button>
          <button type="submit" form="form-bukti" className="btn btn-primary" disabled={busy || !file}>
            <Icon name="upload" size={16} /> {busy ? 'Mengunggah...' : 'Kirim bukti'}
          </button>
        </>
      }
    >
      <form id="form-bukti" className="materi-form-isi" onSubmit={kirim}>
        <div className="bayar-nominal">
          <span>Jumlah yang dibayar</span>
          <strong>{formatRupiah(nominal)}</strong>
        </div>
        <label className={`dropzone${file ? ' is-terisi' : ''}`}>
          <input type="file" accept={TIPE_BUKTI.join(',')} onChange={(e) => pilih(e.target.files?.[0])} disabled={busy} />
          <Icon name={file ? 'file' : 'camera'} size={26} />
          {file ? (
            <span><strong>{file.name}</strong><em>Klik untuk mengganti</em></span>
          ) : (
            <span><strong>Pilih foto slip setoran</strong> atau berkas PDF<em>JPG, PNG, WebP, atau PDF · maks. 5 MB</em></span>
          )}
        </label>
        {pratinjau && <img src={pratinjau} alt="Pratinjau bukti" className="bukti-pratinjau" />}
        {error && <p className="field-error">{error}</p>}
        <p className="field-hint">Pastikan nominal, tanggal, dan kode tagihan pada slip terlihat jelas agar cepat diverifikasi.</p>
      </form>
    </Modal>
  );
}

function LihatBuktiModal({ target, onClose }) {
  const [url, setUrl] = useState(null);
  const [jenis, setJenis] = useState(null);
  const [gagal, setGagal] = useState(false);
  useEffect(() => {
    let batal = false;
    let objUrl = null;
    const q = target.cicilan ? `?cicilan=${target.cicilan.id_cicilan}` : '';
    api.get(`/tagihan/${target.tagihan.id_tagihan}/bukti${q}`, { responseType: 'blob' })
      .then((res) => {
        if (batal) return;
        objUrl = URL.createObjectURL(res.data);
        setJenis(res.data.type === 'application/pdf' ? 'pdf' : 'gambar');
        setUrl(objUrl);
      })
      .catch(() => !batal && setGagal(true));
    return () => {
      batal = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [target]);
  return (
    <Modal title="Bukti pembayaran saya" subtitle={target.cicilan?.kode_termin || target.tagihan.kode_tagihan} onClose={onClose} size="lg">
      <div className="bukti-frame">
        {gagal ? <p className="table-message">Bukti belum tersedia atau tidak dapat dibuka.</p>
          : !url ? <p className="table-message">Memuat bukti...</p>
            : jenis === 'pdf' ? <iframe src={url} title="Bukti pembayaran (PDF)" />
              : <img src={url} alt="Bukti pembayaran" />}
      </div>
    </Modal>
  );
}

function CatatanBayar({ p }) {
  if (!p) return null;
  return (
    <p className={`bayar-catatan is-${p.status}`}>
      <Icon name={p.status === 'ditolak' ? 'alert' : p.status === 'terverifikasi' ? 'checkCircle' : 'clock'} size={14} />
      <span>
        {STATUS_BUKTI[p.status]}
        {p.status === 'ditolak' && p.catatan ? `: ${p.catatan}` : ''}
      </span>
    </p>
  );
}

function KartuTagihan({ t, sorot, onUnggah, onLihat, onCetak }) {
  const st = STATUS_TAGIHAN[t.status] ?? { label: t.status, badge: 'badge-muted' };
  const lay = LAYANAN[t.jenis_layanan];
  const telat = lewatBatas(t);
  return (
    <article id={`tagihan-${t.kode_tagihan}`} className={`panel tagihan-card layanan-${t.jenis_layanan}${sorot ? ' is-sorot' : ''}`}>
      <header className="tagihan-head">
        <span className="tagihan-ikon"><Icon name={lay.icon} size={20} /></span>
        <div className="tagihan-judul">
          <p className="tagihan-layanan">{lay.label}</p>
          <h2>{t.layanan.nama}</h2>
          <p className="cell-sub">{t.layanan.detail}</p>
          <p className="tagihan-kode">{t.kode_tagihan}</p>
        </div>
        <div className="tagihan-angka">
          <span className={`badge ${st.badge}`}>{st.label}</span>
          <strong>{formatRupiah(t.total_tagihan)}</strong>
          {t.skema && <span className="cell-sub">Cicilan {t.skema.jumlah_cicilan}x · terbayar {formatRupiah(t.terbayar)}</span>}
          {t.batas_bayar && t.status !== 'lunas' && (
            <span className={telat ? 'tagihan-telat' : 'cell-sub'}>
              {telat ? 'Lewat batas bayar ' : 'Batas bayar '}{formatTanggal(t.batas_bayar)}
            </span>
          )}
        </div>
      </header>

      {t.skema && <Meter value={t.terbayar} max={t.total_tagihan} label={`Progres pembayaran ${t.kode_tagihan}`} />}

      {t.cicilan ? (
        <ul className="termin-list">
          {t.cicilan.map((c) => {
            const cs = STATUS_CICILAN[c.status] ?? { label: c.status, badge: 'badge-muted' };
            return (
              <li key={c.id_cicilan} className={`is-${c.status}`}>
                <div>
                  <strong>Cicilan ke-{c.cicilan_ke}</strong> <span className={`badge ${cs.badge}`}>{cs.label}</span>
                  <p className="cell-sub">{c.kode_termin} · jatuh tempo {formatTanggal(c.jatuh_tempo)}</p>
                  <CatatanBayar p={c.pembayaran} />
                </div>
                <div className="termin-aksi">
                  <strong>{formatRupiah(c.nominal)}</strong>
                  <div className="action-group">
                    {c.pembayaran && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => onLihat({ tagihan: t, cicilan: c })}>
                        <Icon name="eye" size={14} /> Bukti
                      </button>
                    )}
                    {c.bisa_unggah && (
                      <button type="button" className={`btn btn-sm ${c.status === 'menunggu_pembayaran' ? 'btn-primary' : 'btn-outline'}`} onClick={() => onUnggah({ tagihan: t, cicilan: c })}>
                        <Icon name="upload" size={14} /> {c.label_unggah}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <CatatanBayar p={t.pembayaran} />
      )}

      <footer className="tagihan-foot">
        <div className="action-group">
          {t.layanan.id_kelas && t.layanan.status_pendaftaran === 'terverifikasi' && (
            <Link to={`/dashboard/mahasiswa/kelas/${t.layanan.id_kelas}`} className="link-btn">Buka kelas</Link>
          )}
          {t.jenis_layanan === 'toefl' && <Link to="/dashboard/mahasiswa/toefl" className="link-btn">Lihat pendaftaran TOEFL</Link>}
          {t.jenis_layanan === 'penerjemahan' && <Link to="/dashboard/mahasiswa/terjemahan" className="link-btn">Lihat pesanan</Link>}
        </div>
        <div className="action-group">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onCetak(t)}>
            <Icon name="download" size={14} /> Slip tagihan
          </button>
          {!t.cicilan && t.pembayaran && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onLihat({ tagihan: t })}>
              <Icon name="eye" size={14} /> Bukti
            </button>
          )}
          {!t.cicilan && t.unggah.bisa && (
            <button type="button" className={`btn btn-sm ${t.harus_dibayar > 0 ? 'btn-primary' : 'btn-outline'}`} onClick={() => onUnggah({ tagihan: t })}>
              <Icon name="upload" size={14} /> {t.unggah.label}
            </button>
          )}
          {!t.cicilan && !t.unggah.bisa && !t.pembayaran && t.unggah.alasan && t.status !== 'lunas' && <span className="cell-sub">{t.unggah.alasan}</span>}
        </div>
      </footer>
    </article>
  );
}

function SlipCetak({ t, rekening, user }) {
  return (
    <article className="slip-cetak" aria-hidden="true">
      <header>
        <div className="slip-logo">U</div>
        <div><strong>UPT Bahasa UNIDHA</strong><small>Universitas Dharma Andalas</small></div>
        <span>SLIP TAGIHAN {LAYANAN[t.jenis_layanan].label.toUpperCase()}</span>
      </header>
      <dl>
        <div><dt>Kode tagihan</dt><dd>{t.kode_tagihan}</dd></div>
        <div><dt>Nama</dt><dd>{user?.nama_lengkap}</dd></div>
        <div><dt>NIM / identitas</dt><dd>{user?.nim || '-'}</dd></div>
        <div><dt>Layanan</dt><dd>{t.layanan.nama}</dd></div>
        <div><dt>Keterangan</dt><dd>{t.layanan.detail}</dd></div>
        {t.cicilan ? t.cicilan.map((c) => (
          <div key={c.id_cicilan}><dt>Cicilan ke-{c.cicilan_ke} ({c.kode_termin})</dt><dd>{formatRupiah(c.nominal)} · jatuh tempo {formatTanggal(c.jatuh_tempo)}</dd></div>
        )) : <div><dt>Jumlah bayar</dt><dd>{formatRupiah(t.sisa || t.total_tagihan)}</dd></div>}
        {t.batas_bayar && <div><dt>Batas bayar</dt><dd>{formatTanggal(t.batas_bayar)}</dd></div>}
      </dl>
      <section>
        <strong>{rekening.bank}</strong>
        {rekening.nomor ? <span>Nomor rekening: {rekening.nomor}</span> : <span>Bayar langsung di teller Bank Nagari kampus UNIDHA</span>}
        {rekening.atas_nama && <small>Atas nama: {rekening.atas_nama}</small>}
      </section>
      <footer>Tunjukkan slip ini ke teller, simpan slip setoran, lalu unggah fotonya di menu Tagihan.</footer>
    </article>
  );
}

function TagihanSayaPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState(false);
  const [layanan, setLayanan] = useState(() => (LAYANAN[searchParams.get('layanan')] ? searchParams.get('layanan') : 'semua'));
  const [status, setStatus] = useState('semua');
  const [unggah, setUnggah] = useState(null);
  const [lihat, setLihat] = useState(null);
  const [cetak, setCetak] = useState(null);
  const sorot = searchParams.get('kode');

  const load = useCallback(async () => {
    setGagal(false);
    try {
      const res = await api.get('/tagihan/saya');
      setData(res.data);
    } catch {
      setGagal(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tagihan yang dituju dari tautan (?kode=...) digulir ke tengah layar
  useEffect(() => {
    if (data && sorot) document.getElementById(`tagihan-${sorot}`)?.scrollIntoView({ block: 'center' });
  }, [data, sorot]);

  const cetakSlip = (t) => {
    setCetak(t);
    document.body.classList.add('mencetak-slip');
    window.setTimeout(() => window.print(), 80);
    window.setTimeout(() => document.body.classList.remove('mencetak-slip'), 600);
  };

  const jumlahPerLayanan = useMemo(() => {
    const n = { semua: data?.data.length ?? 0, toefl: 0, pelatihan: 0, penerjemahan: 0 };
    data?.data.forEach((t) => { n[t.jenis_layanan] += 1; });
    return n;
  }, [data]);

  const tampil = useMemo(() => (data?.data ?? [])
    .filter((t) => layanan === 'semua' || t.jenis_layanan === layanan)
    .filter((t) => FILTER_STATUS[status].cocok(t)), [data, layanan, status]);

  if (gagal && !data) {
    return (
      <>
        <PageHeader eyebrow="Mahasiswa / Tagihan" title="Tagihan & pembayaran" />
        <div className="table-message">
          <p>Gagal memuat tagihan.</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button>
        </div>
      </>
    );
  }
  if (!data) return <p className="table-message">Memuat tagihan...</p>;

  const r = data.ringkasan;
  const rek = data.rekening;

  return (
    <>
      <PageHeader
        eyebrow="Mahasiswa / Tagihan"
        title="Tagihan & pembayaran"
        subtitle="Semua tagihan TOEFL, pelatihan, dan penerjemahan Anda di satu tempat."
      />

      <div className="tagihan-atas">
        <section className="kpi-grid tagihan-kpi">
          <article className="kpi">
            <p className="kpi-label">Harus dibayar sekarang</p>
            <strong className="kpi-value">{formatRupiah(r.harus_dibayar)}</strong>
            <p className="kpi-sub">{r.perlu_dibayar ? `${r.perlu_dibayar} tagihan` : 'Tidak ada tagihan tertunggak'}</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Menunggu verifikasi</p>
            <strong className="kpi-value">{r.menunggu_verifikasi}</strong>
            <p className="kpi-sub">Bukti sudah dikirim</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Lunas</p>
            <strong className="kpi-value">{r.lunas}</strong>
            <p className="kpi-sub">Tagihan selesai</p>
          </article>
        </section>
        <section className="panel rekening-card">
          <p className="forum-card-label">Cara bayar</p>
          <strong>{rek.bank}</strong>
          {rek.nomor ? (
            <span>No. rekening <b>{rek.nomor}</b>{rek.atas_nama ? ` a.n. ${rek.atas_nama}` : ''}</span>
          ) : (
            <span>Bayar langsung di teller Bank Nagari kampus UNIDHA dengan menunjukkan slip tagihan.</span>
          )}
          <span className="cell-sub">Setelah bayar, foto slip setoran lalu unggah di tagihan yang sesuai.</span>
        </section>
      </div>

      <div className="tagihan-filter">
        <div className="tabs" role="tablist" aria-label="Jenis layanan">
          {['semua', 'toefl', 'pelatihan', 'penerjemahan'].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={layanan === k} className={`tab${layanan === k ? ' active' : ''}`} onClick={() => setLayanan(k)}>
              {k === 'semua' ? 'Semua' : LAYANAN[k].label}
              <span className="tab-count">{jumlahPerLayanan[k]}</span>
            </button>
          ))}
        </div>
        <select className="input select-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
          {Object.entries(FILTER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {tampil.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon="wallet"
            title={data.data.length ? 'Tidak ada tagihan yang cocok' : 'Belum ada tagihan'}
            text={data.data.length ? 'Ubah filter layanan atau status.' : 'Tagihan muncul setelah Anda mendaftar Tes TOEFL, kelas pelatihan, atau mengajukan penerjemahan.'}
          />
        </section>
      ) : (
        <div className="stack tagihan-list">
          {tampil.map((t) => (
            <KartuTagihan key={t.id_tagihan} t={t} sorot={sorot === t.kode_tagihan} onUnggah={setUnggah} onLihat={setLihat} onCetak={cetakSlip} />
          ))}
        </div>
      )}

      {cetak && <SlipCetak t={cetak} rekening={rek} user={user} />}
      {unggah && <UnggahBuktiModal target={unggah} onClose={() => setUnggah(null)} onSelesai={() => { setUnggah(null); load(); }} />}
      {lihat && <LihatBuktiModal target={lihat} onClose={() => setLihat(null)} />}
    </>
  );
}

export default TagihanSayaPage;
