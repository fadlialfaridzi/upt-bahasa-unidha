// Pencatatan presensi satu pertemuan (Dosen): QR per pertemuan + input manual.
// Scan QR oleh peserta dibuat di modul lain; halaman ini memantau hasil scan secara berkala.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { Meter } from '../../../components/dashboard/Pelatihan.jsx';
import { STATUS_KEHADIRAN, STATUS_WAKTU, formatTanggal, urlPresensiQr } from '../../../config/pelatihan.js';

const INTERVAL_PANTAU = 5000; // muat ulang hasil scan tiap 5 detik selama presensi dibuka
const PILIHAN = ['hadir', 'izin', 'alpha'];
const BELUM = ''; // nilai dropdown untuk "belum tercatat"

const jam = (iso) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '');
const waktuLengkap = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '';

function useQrDataUrl(token) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let batal = false;
    if (!token) {
      setUrl(null);
      return undefined;
    }
    QRCode.toDataURL(urlPresensiQr(token), { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      .then((u) => !batal && setUrl(u))
      .catch(() => !batal && setUrl(null));
    return () => {
      batal = true;
    };
  }, [token]);
  return url;
}

function Ringkasan({ r }) {
  const isi = [
    ['hadir', 'Hadir', r.hadir],
    ['izin', 'Izin', r.izin],
    ['alpha', 'Alpha', r.alpha],
    ['belum', 'Belum tercatat', r.belum],
  ];
  return (
    <div className="presensi-ringkas">
      {isi.map(([k, label, n]) => (
        <div key={k} className={`presensi-ringkas-item is-${k}`}>
          <strong>{n}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

const PRESET_BERLAKU = [5, 10, 15, 30, 60];

/** Sisa detik sampai `batas`, diperbarui tiap detik; memanggil onHabis sekali saat mencapai 0. */
function useSisaDetik(batas, onHabis) {
  const hitung = useCallback(() => (batas ? Math.max(0, Math.ceil((new Date(batas) - Date.now()) / 1000)) : 0), [batas]);
  const [sisa, setSisa] = useState(hitung);
  const habisRef = useRef(onHabis);
  habisRef.current = onHabis;
  useEffect(() => {
    if (!batas) return undefined;
    setSisa(hitung());
    let sudah = false;
    const t = setInterval(() => {
      const s = hitung();
      setSisa(s);
      if (s === 0 && !sudah) {
        sudah = true;
        habisRef.current?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [batas, hitung]);
  return sisa;
}

const formatSisa = (detik) => {
  const j = Math.floor(detik / 3600);
  const m = Math.floor((detik % 3600) / 60);
  const d = detik % 60;
  const dd = String(d).padStart(2, '0');
  return j ? `${j}:${String(m).padStart(2, '0')}:${dd}` : `${String(m).padStart(2, '0')}:${dd}`;
};

function LayarQr({ data, qrUrl, sisa, onClose }) {
  const { pertemuan: p, ringkasan: r } = data;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="qr-layar" role="dialog" aria-modal="true" aria-label="QR presensi layar penuh">
      <button type="button" className="icon-btn qr-layar-tutup" onClick={onClose} aria-label="Tutup layar penuh">
        <Icon name="x" />
      </button>
      <p className="eyebrow">Presensi · Pertemuan ke-{p.pertemuan_ke}</p>
      <h2>{p.kelas.nama_kelas}</h2>
      {qrUrl && <img src={qrUrl} alt="QR presensi" />}
      <p className="qr-token-besar" aria-label="Token presensi">{p.token_qr}</p>
      <p className="qr-layar-info">
        Pindai QR atau ketik token di menu <strong>Presensi &amp; EWS</strong> · sisa waktu <strong className="qr-sisa">{formatSisa(sisa)}</strong> (sampai {jam(p.waktu_tutup_presensi)} WIB)
      </p>
      <p className="qr-layar-hitung"><strong>{r.hadir}</strong> / {r.total} peserta hadir</p>
    </div>
  );
}

/** Formulir masa berlaku sebelum QR dibuat (QR hanya bisa dibuat sekali). */
function FormBukaQr({ p, busy, onBuka }) {
  const [menitBerlaku, setMenitBerlaku] = useState(15);
  const [sekarang, setSekarang] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setSekarang(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const valid = Number.isInteger(menitBerlaku) && menitBerlaku >= p.berlaku.min && menitBerlaku <= p.berlaku.maks;
  const sampai = new Date(sekarang + (valid ? menitBerlaku : 0) * 60000);
  const lewatHari = valid && sampai > new Date(p.berlaku.akhir_hari);
  const kirim = (e) => {
    e.preventDefault();
    if (valid && !lewatHari) onBuka(menitBerlaku);
  };
  return (
    <form className="qr-form" onSubmit={kirim}>
      <p className="field-label">Masa berlaku QR</p>
      <div className="preset-group" role="group" aria-label="Pilihan cepat masa berlaku">
        {PRESET_BERLAKU.map((m) => (
          <button key={m} type="button" className={`preset-btn${menitBerlaku === m ? ' active' : ''}`} onClick={() => setMenitBerlaku(m)} disabled={busy}>
            {m} mnt
          </button>
        ))}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="berlaku-menit">Atau isi sendiri (menit)</label>
        <input
          id="berlaku-menit"
          type="number"
          className="input"
          min={p.berlaku.min}
          max={p.berlaku.maks}
          value={Number.isNaN(menitBerlaku) ? '' : menitBerlaku}
          onChange={(e) => setMenitBerlaku(e.target.value === '' ? NaN : Number(e.target.value))}
          disabled={busy}
        />
      </div>
      {!valid ? (
        <p className="field-error">Isi {p.berlaku.min}–{p.berlaku.maks} menit</p>
      ) : lewatHari ? (
        <p className="field-error">Melewati pukul 23.59 WIB, perpendek masa berlaku</p>
      ) : (
        <p className="qr-sampai">QR berlaku sampai <strong>{jam(sampai.toISOString())} WIB</strong></p>
      )}
      <p className="qr-peringatan">
        <Icon name="alert" size={15} />
        <span>QR hanya bisa dibuat <strong>satu kali</strong> untuk pertemuan ini. Setelah masa berlaku habis, peserta tidak bisa absen lewat QR.</span>
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !valid || lewatHari}>
        <Icon name="qr" size={16} /> {busy ? 'Membuat QR...' : 'Buat QR & tampilkan'}
      </button>
    </form>
  );
}

function PanelQr({ data, busy, aksi, onLayarPenuh, qrUrl, sisa }) {
  const p = data.pertemuan;
  const [formBuka, setFormBuka] = useState(false);

  if (p.status_presensi === 'dibuka') {
    const total = (new Date(p.waktu_tutup_presensi) - new Date(p.waktu_buka_presensi)) / 1000;
    return (
      <section className="panel qr-panel is-dibuka">
        <header className="panel-head">
          <div>
            <h2 className="panel-title">QR presensi</h2>
            <p className="panel-sub">Berlaku sampai {jam(p.waktu_tutup_presensi)} WIB</p>
          </div>
          <span className="badge badge-success"><span className="live-dot" aria-hidden="true" /> Berlaku</span>
        </header>
        <div className="qr-box">{qrUrl ? <img src={qrUrl} alt="QR presensi pertemuan ini" /> : <p className="table-message">Membuat QR...</p>}</div>
        <div className="qr-hitung-mundur" role="timer" aria-live="off">
          <span>Sisa waktu</span>
          <strong className={sisa <= 60 ? 'is-hampir' : ''}>{formatSisa(sisa)}</strong>
        </div>
        <Meter value={sisa} max={total > 0 ? total : 1} tone={sisa <= 60 ? 'danger' : 'brand'} label="Sisa masa berlaku QR" />
        <div className="qr-token">
          <span>Token manual</span>
          <strong>{p.token_qr}</strong>
          <button
            type="button"
            className="icon-btn"
            aria-label="Salin token"
            onClick={() => navigator.clipboard?.writeText(p.token_qr).then(() => toast.success('Token disalin'), () => {})}
          >
            <Icon name="clipboard" size={16} />
          </button>
        </div>
        <p className="qr-hitung" aria-live="polite"><strong>{data.ringkasan.hadir}</strong> dari {data.ringkasan.total} peserta sudah hadir</p>
        <div className="qr-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onLayarPenuh}>
            <Icon name="eye" size={16} /> Tampilkan layar penuh
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => aksi('tutup')} disabled={busy}>
            <Icon name="lock" size={15} /> Akhiri sekarang
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel qr-panel">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">QR presensi</h2>
          <p className="panel-sub">1 pertemuan = 1 QR</p>
        </div>
        {p.qr_pernah_dibuat && <span className="badge badge-muted">Berakhir</span>}
      </header>
      {p.qr_pernah_dibuat ? (
        <>
          <div className="qr-box qr-box-kosong"><Icon name="lock" size={44} /></div>
          <p className="qr-hitung">Masa berlaku QR berakhir {waktuLengkap(p.waktu_tutup_presensi)} WIB</p>
          <p className="field-hint">QR tidak dapat dibuat ulang. Ubah kehadiran peserta secara manual pada daftar.</p>
        </>
      ) : p.bisa_buka ? (
        <>
          <div className="qr-box qr-box-kosong"><Icon name="qr" size={44} /></div>
          <p className="qr-hitung">Belum ada QR presensi untuk pertemuan ini.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setFormBuka(true)} disabled={busy}>
            <Icon name="plus" size={16} /> Buat QR presensi
          </button>
          {formBuka && (
            <Modal title="Buat QR presensi" subtitle={`Pertemuan ke-${p.pertemuan_ke} · ${p.kelas.nama_kelas}`} size="sm" busy={busy} onClose={() => setFormBuka(false)}>
              <FormBukaQr p={p} busy={busy} onBuka={(menitBerlaku) => aksi('buka', { berlaku_menit: menitBerlaku })} />
            </Modal>
          )}
        </>
      ) : (
        <>
          <div className="qr-box qr-box-kosong"><Icon name="qr" size={44} /></div>
          <p className="qr-hitung">{p.alasan_buka}</p>
        </>
      )}
      {!p.qr_pernah_dibuat && (
        <p className="field-hint">
          {p.bisa_manual
            ? 'Kehadiran bisa dicatat atau diubah manual kapan saja pada daftar peserta.'
            : 'Pencatatan manual tersedia mulai hari pertemuan.'}
        </p>
      )}
    </section>
  );
}

function PresensiPertemuanPage() {
  const { idKelas, idPertemuan } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState(null);
  const [draf, setDraf] = useState({}); // id_pendaftaran -> status | null (perubahan belum disimpan)
  const [busy, setBusy] = useState(false);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const [konfirmasiTutup, setKonfirmasiTutup] = useState(false);
  const [terpilih, setTerpilih] = useState(() => new Set()); // id_pendaftaran yang dicentang
  const [statusMassal, setStatusMassal] = useState('hadir');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/presensi/pertemuan/${idPertemuan}`);
      setData(res.data.data);
      setGagal(null);
    } catch (err) {
      setGagal(err.response?.data?.message || 'Gagal memuat presensi');
    }
  }, [idPertemuan]);

  useEffect(() => {
    setData(null);
    setDraf({});
    setTerpilih(new Set());
    load();
  }, [load]);

  // Pantau hasil scan selama presensi dibuka (hanya saat tab terlihat)
  const dibuka = data?.pertemuan.status_presensi === 'dibuka';
  useEffect(() => {
    if (!dibuka) return undefined;
    const t = setInterval(() => document.visibilityState === 'visible' && load(), INTERVAL_PANTAU);
    return () => clearInterval(t);
  }, [dibuka, load]);

  const qrUrl = useQrDataUrl(dibuka ? data.pertemuan.token_qr : null);
  // Hitung mundur masa berlaku; saat habis, muat ulang (server menutup sesi & mengisi alpha)
  const sisa = useSisaDetik(dibuka ? data.pertemuan.waktu_tutup_presensi : null, () => { setLayarPenuh(false); load(); });

  const jumlahUbah = Object.keys(draf).length;
  const statusTampil = useCallback(
    (d) => (Object.prototype.hasOwnProperty.call(draf, d.id_pendaftaran) ? draf[d.id_pendaftaran] : d.status),
    [draf],
  );
  const ringkasTampil = useMemo(() => {
    if (!data) return null;
    const r = { total: data.peserta.length, hadir: 0, izin: 0, alpha: 0, belum: 0 };
    for (const d of data.peserta) r[statusTampil(d) ?? 'belum'] += 1;
    return r;
  }, [data, statusTampil]);

  /** Ubah status (draf) untuk satu atau beberapa peserta; status null = belum tercatat. */
  const ubahStatus = (ids, status) => {
    const asal = new Map(data.peserta.map((d) => [d.id_pendaftaran, d.status]));
    setDraf((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (asal.get(id) === status) delete next[id];
        else next[id] = status;
      }
      return next;
    });
  };

  const centang = (id) => setTerpilih((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const centangSemua = () => setTerpilih((prev) => (
    prev.size === data.peserta.length ? new Set() : new Set(data.peserta.map((d) => d.id_pendaftaran))
  ));
  const terapkanMassal = () => {
    ubahStatus([...terpilih], statusMassal === BELUM ? null : statusMassal);
    setTerpilih(new Set());
  };

  const simpan = async () => {
    setBusy(true);
    try {
      const daftar = Object.entries(draf).map(([id, status]) => ({ id_pendaftaran: Number(id), status }));
      const res = await api.put(`/presensi/pertemuan/${idPertemuan}`, { daftar });
      setData(res.data.data);
      setDraf({});
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kehadiran');
    } finally {
      setBusy(false);
    }
  };

  const aksi = async (jenis, body) => {
    if (jenis === 'tutup' && !konfirmasiTutup) {
      setKonfirmasiTutup(true);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/presensi/pertemuan/${idPertemuan}/${jenis}`, body);
      setData(res.data.data);
      toast.success(res.data.message);
      if (jenis === 'buka') setLayarPenuh(true);
      if (jenis === 'tutup') setLayarPenuh(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses presensi');
      load();
    } finally {
      setBusy(false);
      setKonfirmasiTutup(false);
    }
  };

  const pindah = (id) => {
    if (jumlahUbah && !window.confirm('Ada perubahan kehadiran yang belum disimpan. Tetap pindah pertemuan?')) return;
    navigate(`/dashboard/dosen/kelas/${idKelas}/presensi/${id}`);
  };

  if (gagal && !data) {
    return (
      <>
        <PageHeader eyebrow="Dosen / Kelas saya / Presensi" title="Presensi pertemuan" />
        <div className="table-message">
          <p>{gagal}</p>
          <Link to="/dashboard/dosen/kelas" className="btn btn-soft btn-sm">Kembali ke Kelas saya</Link>
        </div>
      </>
    );
  }
  if (!data) return <p className="table-message">Memuat presensi...</p>;

  const p = data.pertemuan;
  const nav = data.navigasi;
  const waktu = STATUS_WAKTU[p.status];

  return (
    <>
      <Link to="/dashboard/dosen/kelas" className="back-link dash-back"><Icon name="arrowLeft" size={16} /> Kelas saya</Link>
      <PageHeader
        eyebrow={`Presensi · Pertemuan ke-${p.pertemuan_ke}`}
        title={p.kelas.nama_kelas}
        subtitle={[
          `${p.hari}, ${formatTanggal(p.tanggal, { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `${p.jam_mulai}–${p.jam_selesai}`,
          p.ruang && (/^ruang/i.test(p.ruang) ? p.ruang : `Ruang ${p.ruang}`),
          p.topik,
        ].filter(Boolean).join(' · ')}
        action={
          <div className="presensi-nav">
            <button type="button" className="btn btn-outline btn-sm" disabled={!nav.sebelumnya} onClick={() => pindah(nav.sebelumnya)} aria-label="Pertemuan sebelumnya">
              <Icon name="arrowLeft" size={15} />
            </button>
            <span>{nav.urutan} / {nav.jumlah}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={!nav.berikutnya} onClick={() => pindah(nav.berikutnya)} aria-label="Pertemuan berikutnya">
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
        }
      />

      <div className="presensi-layout">
        <section className="panel">
          <header className="panel-head">
            <div>
              <h2 className="panel-title">Daftar kehadiran</h2>
              <p className="panel-sub">
                <span className={`badge ${waktu.badge}`}>{waktu.label}</span>{' '}
                {data.peserta.length} peserta terverifikasi
              </p>
            </div>
          </header>

          <Ringkasan r={ringkasTampil} />

          {data.peserta.length === 0 ? (
            <EmptyState icon="users" title="Belum ada peserta" text="Peserta muncul setelah pembayarannya diverifikasi admin." />
          ) : (
            <>
              {p.bisa_manual && terpilih.size > 0 && (
                <div className="bulk-bar presensi-massal">
                  <span><strong>{terpilih.size}</strong> peserta dipilih</span>
                  <div className="bulk-bar-actions">
                    <label className="sr-only" htmlFor="status-massal">Ubah kehadiran terpilih menjadi</label>
                    <select id="status-massal" className="input select-sm" value={statusMassal} onChange={(e) => setStatusMassal(e.target.value)} disabled={busy}>
                      {PILIHAN.map((o) => <option key={o} value={o}>Tandai {STATUS_KEHADIRAN[o].label}</option>)}
                      <option value={BELUM}>Kosongkan (belum tercatat)</option>
                    </select>
                    <button type="button" className="btn btn-primary btn-sm" onClick={terapkanMassal} disabled={busy}>Terapkan</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setTerpilih(new Set())} disabled={busy}>Batal pilih</button>
                  </div>
                </div>
              )}
              <div className="table-wrap">
                <table className="table presensi-table">
                  <thead>
                    <tr>
                      <th className="col-pilih">
                        <input
                          type="checkbox"
                          aria-label="Pilih semua peserta"
                          checked={terpilih.size === data.peserta.length}
                          ref={(el) => { if (el) el.indeterminate = terpilih.size > 0 && terpilih.size < data.peserta.length; }}
                          onChange={centangSemua}
                          disabled={!p.bisa_manual || busy}
                        />
                      </th>
                      <th>Peserta</th>
                      <th>Kehadiran</th>
                      <th className="nowrap col-tercatat">Tercatat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.peserta.map((d) => {
                      const s = statusTampil(d);
                      const berubah = Object.prototype.hasOwnProperty.call(draf, d.id_pendaftaran);
                      const dipilih = terpilih.has(d.id_pendaftaran);
                      return (
                        <tr key={d.id_pendaftaran} className={`${berubah ? 'is-berubah' : ''}${dipilih ? ' is-dipilih' : ''}`}>
                          <td className="col-pilih">
                            <input
                              type="checkbox"
                              aria-label={`Pilih ${d.nama_lengkap}`}
                              checked={dipilih}
                              onChange={() => centang(d.id_pendaftaran)}
                              disabled={!p.bisa_manual || busy}
                            />
                          </td>
                          <td>
                            <p className="cell-title">{d.nama_lengkap}</p>
                            <p className="cell-sub">{d.nim || '—'}</p>
                          </td>
                          <td>
                            <select
                              className={`input select-sm status-select is-${s ?? 'belum'}`}
                              aria-label={`Kehadiran ${d.nama_lengkap}`}
                              value={s ?? BELUM}
                              onChange={(e) => ubahStatus([d.id_pendaftaran], e.target.value === BELUM ? null : e.target.value)}
                              disabled={!p.bisa_manual || busy}
                            >
                              <option value={BELUM}>— Belum tercatat —</option>
                              {PILIHAN.map((o) => <option key={o} value={o}>{STATUS_KEHADIRAN[o].label}</option>)}
                            </select>
                          </td>
                          <td className="nowrap cell-sub col-tercatat">
                            {berubah ? 'Belum disimpan' : d.waktu ? `${waktuLengkap(d.waktu)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {p.bisa_manual && (
                <footer className="presensi-simpan">
                  <span>{jumlahUbah ? `${jumlahUbah} perubahan belum disimpan` : 'Belum ada perubahan'}</span>
                  <div className="action-group">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraf({})} disabled={busy || !jumlahUbah}>Batalkan</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={simpan} disabled={busy || !jumlahUbah}>
                      <Icon name="check" size={15} /> {busy ? 'Menyimpan...' : 'Simpan perubahan'}
                    </button>
                  </div>
                </footer>
              )}
            </>
          )}
        </section>

        <PanelQr data={data} busy={busy} aksi={aksi} qrUrl={qrUrl} sisa={sisa} onLayarPenuh={() => setLayarPenuh(true)} />
      </div>

      {layarPenuh && dibuka && <LayarQr data={data} qrUrl={qrUrl} sisa={sisa} onClose={() => setLayarPenuh(false)} />}

      {konfirmasiTutup && (
        <Modal
          title="Akhiri masa berlaku QR?"
          subtitle={`${p.kelas.nama_kelas} · Pertemuan ke-${p.pertemuan_ke}`}
          size="sm"
          onClose={() => setKonfirmasiTutup(false)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setKonfirmasiTutup(false)} disabled={busy}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={() => aksi('tutup')} disabled={busy}>
                {busy ? 'Mengakhiri...' : 'Akhiri sekarang'}
              </button>
            </>
          }
        >
          <p>
            QR tidak bisa dipindai lagi dan <strong>tidak dapat dibuat ulang</strong>. {data.ringkasan.belum > 0
              ? `${data.ringkasan.belum} peserta yang belum tercatat akan ditandai alpha.`
              : 'Semua peserta sudah tercatat.'}{' '}
            Anda tetap bisa mengubah kehadiran secara manual setelahnya.
          </p>
        </Modal>
      )}
    </>
  );
}

export default PresensiPertemuanPage;
