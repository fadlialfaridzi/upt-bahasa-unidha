import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import Icon from '../../components/ui/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Modal from '../../components/ui/Modal.jsx';

const STEPS = [
  'Data diri',
  'Pilih sesi',
  'Konfirmasi',
  'Pembayaran',
  'Menunggu verifikasi',
  'Kartu ujian',
];

const formatTanggal = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
  : 'Belum ditentukan';

const formatRupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatWaktu = (value) => value
  ? String(value).slice(11, 16)
  : '-';

const getBuktiUrl = (buktiPath) => {
  return buktiPath ? '' : '';
};

const getBuktiUrlByPendaftaran = (idPendaftaran) => {
  if (!idPendaftaran) return '';
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/?$/, '');
  return `${base}/toefl/pendaftaran/${idPendaftaran}/bukti`;
};

const getBuktiStaticUrl = (buktiPath) => {
  if (!buktiPath) return '';
  const normalized = String(buktiPath).replace(/\\/g, '/').replace(/^\/+/, '');
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return `${base}/${normalized}`;
};

function ToeflDaftarPage() {
  const { jadwalId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({ nama_lengkap: '', nim: '', program_studi: '', no_hp: '', email: '' });
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(jadwalId ? Number(jadwalId) : null);
  const [selected, setSelected] = useState(null);
  const [pendaftaran, setPendaftaran] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [storedProofUrl, setStoredProofUrl] = useState('');
  const [buktiPreview, setBuktiPreview] = useState(false);
  const [activeRegistration, setActiveRegistration] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/auth/profile'),
      api.get('/toefl/jadwal'),
      api.get('/toefl/my-pendaftaran').catch(() => ({ data: { data: [] } })),
    ]).then(([profileRes, sessionRes, registrationRes]) => {
      if (!active) return;
      const p = profileRes.data.data;
      setProfile({
        nama_lengkap: p.nama_lengkap || '',
        nim: p.nim || '',
        program_studi: p.program_studi || '',
        no_hp: p.no_hp || '',
        email: p.email || '',
      });
      setSessions(sessionRes.data.data || []);
      const owned = (registrationRes.data.data || []).find((item) =>
        item.status !== 'dibatalkan' &&
        (!jadwalId || item.sesi.id_sesi === Number(jadwalId))
      );
      setActiveRegistration(owned || null);

      const resumeMode = searchParams.get('mode') === 'lanjut';
      const newMode = searchParams.get('mode') === 'baru';

      if (owned && resumeMode) {
        setPendaftaran(owned);
        setSelectedId(owned.sesi.id_sesi);
        setSelected(owned.sesi);
        const buktiPath = owned.tagihan?.pembayaran?.bukti_path;
        if (buktiPath) setFilePreviewUrl(getBuktiUrlByPendaftaran(owned.id_pendaftaran));
        const paymentStatus = owned.tagihan?.pembayaran?.status;
        if (owned.status === 'terverifikasi') setStep(6);
        else if (paymentStatus === 'menunggu') setStep(5);
        else setStep(4);
      } else if (newMode) {
        setPendaftaran(null);
        setSelectedId(null);
        setSelected(null);
        setActiveRegistration(null);
        setStep(1);
      } else if (jadwalId) {
        setStep(2);
      } else {
        setPendaftaran(null);
        setSelectedId(null);
        setSelected(null);
        setStep(1);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [jadwalId, searchParams]);

  useEffect(() => {
    if (!selectedId) return;
    api.get(`/toefl/jadwal/${selectedId}`)
      .then((res) => setSelected(res.data.data))
      .catch(() => setSelected(null));
  }, [selectedId]);

  const currentSession = useMemo(
    () => selected || sessions.find((item) => item.id === selectedId) || null,
    [selected, sessions, selectedId],
  );

  const updateProfile = (event) => {
    setProfile((old) => ({ ...old, [event.target.name]: event.target.value }));
  };

  const chooseProof = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    if (filePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(filePreviewUrl);
    if (nextFile) {
      setFilePreviewUrl(nextFile.type === 'application/pdf'
        ? ''
        : URL.createObjectURL(nextFile));
    } else {
      setFilePreviewUrl('');
    }
  };

  const removeProof = () => {
    if (filePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(filePreviewUrl);
    setFile(null);
    setFilePreviewUrl('');
  };

  useEffect(() => {
    if (!filePreviewUrl) {
      setStoredProofUrl('');
      return;
    }
    if (filePreviewUrl.startsWith('blob:') || filePreviewUrl.startsWith('/')) {
      setStoredProofUrl(filePreviewUrl);
      return;
    }
    if (!filePreviewUrl.includes('/pendaftaran/') || !filePreviewUrl.includes('/bukti')) {
      setStoredProofUrl(filePreviewUrl);
      return;
    }
    let active = true;
    const relativeProofUrl = filePreviewUrl.includes('/api/')
      ? filePreviewUrl.slice(filePreviewUrl.indexOf('/api/') + 4)
      : filePreviewUrl;
    api.get(relativeProofUrl, { responseType: 'blob' })
      .then((res) => {
        if (!active) return;
        const url = URL.createObjectURL(res.data);
        setStoredProofUrl((old) => {
          if (old.startsWith('blob:')) URL.revokeObjectURL(old);
          return url;
        });
      })
      .catch(() => {
        if (active) setStoredProofUrl('');
      });
    return () => { active = false; };
  }, [filePreviewUrl]);

  const goNext = async () => {
    if (step === 1) {
      if (!profile.nama_lengkap.trim() || profile.nama_lengkap.trim().length < 3) {
        toast.error('Nama lengkap minimal 3 karakter');
        return;
      }
      if (!profile.no_hp.trim()) {
        toast.error('Nomor WhatsApp wajib diisi');
        return;
      }
      setSubmitting(true);
      try {
        await api.put('/auth/profile', profile);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Gagal menyimpan data diri');
        return;
      } finally {
        setSubmitting(false);
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!selectedId) {
        toast.error('Pilih satu sesi TOEFL terlebih dahulu');
        return;
      }
      setStep(3);
    }
  };

  const createRegistration = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await api.post('/toefl/daftar', {
        id_sesi: selectedId,
        data_peserta: profile,
      });
      setPendaftaran(res.data.data);
      setStep(4);
      toast.success(res.data.message);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.data) {
        setPendaftaran(err.response.data.data);
        setStep(4);
      }
      toast.error(err.response?.data?.message || 'Gagal membuat pendaftaran');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadProof = async (event) => {
    event.preventDefault();
    if (!file) {
      toast.error('Pilih file bukti pembayaran');
      return;
    }
    if (!pendaftaran?.id_pendaftaran) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format bukti harus JPG, PNG, WebP, atau PDF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran bukti maksimal 5 MB');
      return;
    }
    const form = new FormData();
    form.append('bukti', file);
    form.append('id_pendaftaran', pendaftaran.id_pendaftaran);
    setSubmitting(true);
    try {
      const uploadRes = await api.post('/toefl/pembayaran/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploaded = uploadRes.data.data;
      setPendaftaran((old) => ({
        ...old,
        tagihan: {
          ...old.tagihan,
          status: 'menunggu_verifikasi',
          pembayaran: {
            status: 'menunggu',
            nominal: old.tagihan.total_tagihan,
            bukti_path: uploaded?.bukti_path,
            tanggal_unggah: uploaded?.tanggal_unggah,
          },
        },
      }));
      setFilePreviewUrl(getBuktiUrlByPendaftaran(pendaftaran.id_pendaftaran));
      setStep(5);
      toast.success('Bukti pembayaran berhasil diunggah');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah bukti');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshStatus = async () => {
    setSubmitting(true);
    try {
      const res = await api.get('/toefl/my-pendaftaran');
      const owned = (res.data.data || []).find((item) => item.id_pendaftaran === pendaftaran?.id_pendaftaran);
      if (owned) {
        setPendaftaran(owned);
        const buktiPath = owned.tagihan?.pembayaran?.bukti_path;
        if (buktiPath) setFilePreviewUrl(getBuktiUrlByPendaftaran(owned.id_pendaftaran));
        if (owned.status === 'terverifikasi') setStep(6);
        else if (owned.tagihan?.pembayaran?.status === 'ditolak') toast.error(owned.tagihan.pembayaran.catatan || 'Bukti pembayaran ditolak');
        else toast.info('Pembayaran masih menunggu verifikasi admin');
      }
    } catch {
      toast.error('Gagal memeriksa status pendaftaran');
    } finally {
      setSubmitting(false);
    }
  };

  const printSlip = () => {
    document.body.classList.add('printing-slip');
    window.print();
    window.setTimeout(() => document.body.classList.remove('printing-slip'), 250);
  };

  const uniqueAmount = pendaftaran
    ? Number(pendaftaran.tagihan?.total_tagihan || currentSession?.biaya || currentSession?.tarif || 0)
    : Number(currentSession?.biaya || currentSession?.tarif || 0);
  const uniqueCode = pendaftaran?.tagihan?.kode_tagihan?.slice(-4) || '123';
  const uniquePayment = uniqueAmount + Number(uniqueCode) / 1000;

  if (loading) return <div className="toefl-register-page"><p className="table-message">Memuat pendaftaran TOEFL...</p></div>;

  return (
    <div className="toefl-register-page">
      <section className="toefl-register-hero">
        <p>LAYANAN TOEFL / PENDAFTARAN PESERTA</p>
        <h1>Pendaftaran Ujian TOEFL ITP</h1>
        <span>UPT Bahasa Universitas Dharma Andalas</span>
      </section>

      <nav className="toefl-stepper" aria-label="Tahapan pendaftaran">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const done = number < step;
          const active = number === step;
          return (
            <div key={label} className={`toefl-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              <span>{done ? <Icon name="check" size={13} /> : number}</span>
              <small>{label}</small>
            </div>
          );
        })}
      </nav>

      {step === 1 && (
        <div className="toefl-register-layout">
          <section className="panel toefl-register-main">
            <header className="panel-head"><div><h2 className="panel-title">Lengkapi data diri</h2><p className="panel-sub">Pastikan identitas sesuai kartu identitas sebelum mencetak kartu ujian.</p></div></header>
            <div className="panel-body">
              {activeRegistration && (
                <div className="toefl-active-registration">
                  <div>
                    <strong>Pendaftaran sebelumnya ditemukan</strong>
                    <p className="cell-sub">{activeRegistration.sesi?.nama_sesi || 'Sesi TOEFL'} · Status {activeRegistration.status === 'terverifikasi' ? 'Terverifikasi' : 'Dalam proses'}</p>
                  </div>
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => navigate('/dashboard/mahasiswa/toefl?mode=lanjut')}>
                    Lanjutkan pendaftaran
                  </button>
                </div>
              )}
              <div className="form-grid">
                <Field label="NIK / NIM" hint="Mahasiswa gunakan NIM">
                  <input className="input input-plain" name="nim" value={profile.nim} onChange={updateProfile} />
                </Field>
                <Field label="Nama lengkap">
                  <input className="input input-plain" name="nama_lengkap" value={profile.nama_lengkap} onChange={updateProfile} />
                </Field>
                <Field label="Email">
                  <input className="input input-plain" name="email" value={profile.email} disabled />
                </Field>
                <Field label="Nomor WhatsApp">
                  <input className="input input-plain" name="no_hp" value={profile.no_hp} onChange={updateProfile} />
                </Field>
                <Field label="Program studi" full>
                  <input className="input input-plain" name="program_studi" value={profile.program_studi} onChange={updateProfile} placeholder="Contoh: Sistem Informasi" />
                </Field>
              </div>
              <label className="toefl-consent"><input type="checkbox" defaultChecked /> Saya menyatakan data di atas benar dan dapat diverifikasi.</label>
              <div className="toefl-register-actions">
                <button type="button" className="btn btn-outline" disabled>Sebelum</button>
                <button type="button" className="btn btn-primary" onClick={goNext} disabled={submitting}>{submitting ? 'Memproses...' : 'Lanjut: Pilih Sesi'}</button>
              </div>
            </div>
          </section>
          <SideSummary session={null} user={profile} />
        </div>
      )}

      {step === 2 && (
        <div className="toefl-register-layout">
          <section className="panel toefl-register-main">
            <header className="panel-head"><div><h2 className="panel-title">Pilih jadwal yang sesuai</h2><p className="panel-sub">Data diri {profile.nama_lengkap} · NIM {profile.nim || '-'}</p></div></header>
            <div className="panel-body">
              <div className="toefl-session-list">
                {sessions.length === 0 ? <p className="table-message">Belum ada sesi TOEFL yang dibuka.</p> : sessions.map((item) => {
                  const remaining = item.kuota - item.kuotaTerisi;
                  const active = selectedId === item.id;
                  return (
                    <button type="button" key={item.id} className={`toefl-session-card ${active ? 'active' : ''}`} onClick={() => { setSelectedId(item.id); setSelected(item); }}>
                      <span className="radio-dot" />
                      <span className="session-card-main"><strong>{item.nama_sesi}</strong><small>{formatWaktu(item.waktu)}-{item.waktu_selesai ? formatWaktu(item.waktu_selesai) : '-'} WIB · {item.lokasi || 'Lokasi belum ditentukan'}</small></span>
                      <span className="session-card-amount"><small>Kuota: {remaining}/{item.kuota}</small><div className="progress"><span style={{ width: `${Math.min(100, (item.kuotaTerisi / item.kuota) * 100)}%` }} /></div></span>
                    </button>
                  );
                })}
              </div>
              <div className="toefl-register-actions">
                <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>Kembali: Data Diri</button>
                <button type="button" className="btn btn-primary" onClick={goNext}>Lanjut: Konfirmasi Pendaftaran</button>
              </div>
            </div>
          </section>
          <SideSummary session={currentSession} user={profile} />
        </div>
      )}

      {step === 3 && (
        <div className="toefl-register-layout">
          <section className="panel toefl-register-main">
            <header className="panel-head"><div><h2 className="panel-title">Periksa pendaftaran Anda</h2><p className="panel-sub">Pastikan data peserta dan jadwal ujian sudah benar.</p></div></header>
            <div className="panel-body">
              <div className="confirm-grid">
                <div><h3>Data peserta</h3><dl><ConfirmRow label="Nama lengkap" value={profile.nama_lengkap} /><ConfirmRow label="NIM" value={profile.nim || '-'} /><ConfirmRow label="Program studi" value={profile.program_studi || '-'} /><ConfirmRow label="WhatsApp" value={profile.no_hp || '-'} /><ConfirmRow label="Email" value={profile.email} /></dl></div>
                <div><h3>Jadwal ujian</h3><dl><ConfirmRow label="Jenis" value="TOEFL ITP" /><ConfirmRow label="Tanggal" value={formatTanggal(currentSession?.tanggal)} /><ConfirmRow label="Sesi" value={currentSession?.nama_sesi || '-'} /><ConfirmRow label="Waktu" value={`${formatWaktu(currentSession?.waktu)} WIB`} /><ConfirmRow label="Lokasi" value={currentSession?.lokasi || '-'} /></dl></div>
              </div>
              <label className="toefl-consent"><input type="checkbox" defaultChecked /> Saya telah memeriksa data dan jadwal ujian.</label>
              <div className="toefl-register-actions">
                <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>Kembali: Pilih Sesi</button>
                <button type="button" className="btn btn-primary" onClick={createRegistration} disabled={submitting}>{submitting ? 'Memproses...' : 'Buat Tagihan Pembayaran'}</button>
              </div>
            </div>
          </section>
          <SideSummary session={currentSession} user={profile} />
        </div>
      )}

      {step === 4 && (
        <div className="toefl-register-layout">
          <section className="panel toefl-register-main">
            <header className="panel-head"><div><h2 className="panel-title">Rincian tagihan</h2><p className="panel-sub">Selesaikan pembayaran sebelum batas yang ditentukan.</p></div></header>
            <div className="panel-body">
              <div className="payment-layout">
                <div>
                  <p className="cell-sub">Kode tagihan</p><strong>{pendaftaran?.tagihan?.kode_tagihan || '-'}</strong>
                  <h3 className="unique-amount">{formatRupiah(uniquePayment).replace(',00', '')}</h3>
                  <p className="cell-sub">Transfer sesuai nominal unik untuk mempermudah verifikasi.</p>
                  <div className="bank-box"><small>Rekening tujuan</small><strong>0000 0000 0000</strong><p>Bank Nagari Syariah · UPT Bahasa UNIDHA</p></div>
                  <button type="button" className="btn btn-outline btn-block toefl-download-slip" onClick={printSlip}>
                    <Icon name="download" size={17} /> Unduh Slip Tagihan PDF
                  </button>
                </div>
                <form className="proof-upload" onSubmit={uploadProof}>
                  <h3>Unggah bukti pembayaran</h3>
                  <label className="proof-drop">
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={chooseProof} />
                    {filePreviewUrl ? (
                      <img className="proof-image-preview" src={storedProofUrl || filePreviewUrl} alt="Preview bukti pembayaran" />
                    ) : (
                      <Icon name={file?.type === 'application/pdf' ? 'file' : 'upload'} size={22} />
                    )}
                    <strong>{file ? file.name : 'Pilih atau jatuhkan bukti transfer'}</strong>
                    {file && <span className="proof-ready"><Icon name="checkCircle" size={14} /> Siap dikirim</span>}
                    <small>{file ? `${(file.size / 1024).toFixed(0)} KB · ` : ''}JPG, PNG, WebP, atau PDF · Maks. 5 MB</small>
                    {file && (
                      <button type="button" className="proof-remove-btn" onClick={(event) => { event.preventDefault(); removeProof(); }}>
                        <Icon name="x" size={14} /> Hapus pilihan
                      </button>
                    )}
                  </label>
                  <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>{submitting ? 'Mengunggah...' : 'Kirim Bukti Pembayaran'}</button>
                </form>
              </div>
            </div>
          </section>
          <PaymentSide session={currentSession} />
        </div>
      )}

      {step === 4 && (
        <article className="toefl-slip-print">
          <header>
            <div className="toefl-slip-logo">U</div>
            <div><strong>UPT Bahasa UNIDHA</strong><small>Universitas Dharma Andalas</small></div>
            <span>SLIP TAGIHAN TOEFL</span>
          </header>
          <dl>
            <ConfirmRow label="Kode Tagihan" value={pendaftaran?.tagihan?.kode_tagihan || '-'} />
            <ConfirmRow label="Nama Peserta" value={profile.nama_lengkap || '-'} />
            <ConfirmRow label="NIM / Identitas" value={profile.nim || '-'} />
            <ConfirmRow label="Jenis Ujian" value="TOEFL ITP" />
            <ConfirmRow label="Sesi" value={currentSession?.nama_sesi || '-'} />
            <ConfirmRow label="Tanggal Ujian" value={formatTanggal(currentSession?.tanggal)} />
            <ConfirmRow label="Nominal Tagihan" value={formatRupiah(uniquePayment).replace(',00', '')} />
          </dl>
          <div className="toefl-slip-bank">
            <strong>Bank Nagari Syariah · UPT Bahasa UNIDHA</strong>
            <span>Nomor rekening: 0000 0000 0000</span>
            <small>Bayar melalui teller dan simpan bukti transaksi bank.</small>
          </div>
          <footer>Setelah pembayaran, kembali ke portal untuk mengunggah bukti pembayaran pada menu Tes TOEFL.</footer>
        </article>
      )}

      {step === 5 && (
        <div className="toefl-register-layout">
          <section className="panel toefl-register-main">
            <header className="panel-head"><div><h2 className="panel-title">Bukti pembayaran telah diunggah</h2><p className="panel-sub">Pembayaran Anda sedang diperiksa oleh Staf UPT Bahasa.</p></div></header>
            <div className="panel-body">
              <span className="badge badge-warning">Menunggu verifikasi</span>
              <div className="waiting-proof">
                <div><p className="cell-sub">Kode tagihan</p><strong>{pendaftaran?.tagihan?.kode_tagihan}</strong><p className="cell-sub">Nominal</p><strong>{formatRupiah(pendaftaran?.tagihan?.total_tagihan)}</strong></div>
                <button type="button" className="proof-preview" onClick={() => setBuktiPreview(true)}>
                  {storedProofUrl || filePreviewUrl ? <img className="proof-image-preview uploaded" src={storedProofUrl || filePreviewUrl} alt="Bukti pembayaran" /> : <Icon name="file" size={22} />}
                  <strong>Bukti pembayaran</strong>
                  <small>Klik untuk meninjau</small>
                </button>
              </div>
              <button type="button" className="btn btn-soft" onClick={refreshStatus} disabled={submitting}>{submitting ? 'Memeriksa...' : 'Periksa Status Terbaru'}</button>
            </div>
          </section>
          <PaymentSide session={currentSession} waiting />
        </div>
      )}

      {step === 6 && (
        <div className="toefl-register-layout">
          <section className="panel toefl-register-main">
            <header className="panel-head exam-screen-heading"><div><h2 className="panel-title">Pendaftaran Anda terverifikasi</h2><p className="panel-sub">Simpan kartu peserta ini dan bawa pada hari ujian.</p></div></header>
            <div className="panel-body exam-print-root">
              <div className="exam-card exam-card-print">
                <div className="exam-card-brand">
                  <div className="exam-card-logo">U</div>
                  <div><strong>UPT Bahasa UNIDHA</strong><small>Universitas Dharma Andalas</small></div>
                  <span>KARTU PESERTA TOEFL ITP</span>
                </div>
                <div className="exam-card-status">TERVERIFIKASI</div>
                <dl>
                  <ConfirmRow label="Nama Peserta" value={profile.nama_lengkap} />
                  <ConfirmRow label="NIM / Identitas" value={profile.nim || '-'} />
                  <ConfirmRow label="Program Studi" value={profile.program_studi || '-'} />
                  <ConfirmRow label="Nomor Pendaftaran" value={pendaftaran ? `TFL-${new Date().getFullYear()}-${String(pendaftaran.id_pendaftaran).padStart(4, '0')}` : '-'} />
                  <ConfirmRow label="Tanggal Ujian" value={formatTanggal(currentSession?.tanggal)} />
                  <ConfirmRow label="Waktu" value={currentSession?.waktu_selesai ? `${formatWaktu(currentSession?.waktu)} - ${formatWaktu(currentSession?.waktu_selesai)} WIB` : `${formatWaktu(currentSession?.waktu)} WIB`} />
                  <ConfirmRow label="Lokasi" value={currentSession?.lokasi || '-'} />
                  <ConfirmRow label="Sesi" value={currentSession?.nama_sesi || '-'} />
                </dl>
                <div className="exam-card-rules">
                  <strong>Hal yang wajib dibawa dan diperhatikan:</strong>
                  <ul>
                    <li>Pensil 2B, penghapus, dan kartu identitas diri.</li>
                    <li>Peserta wajib hadir 15 menit sebelum ujian dimulai.</li>
                    <li>Keterlambatan maksimal 30 menit tanpa tambahan waktu.</li>
                  </ul>
                </div>
                <footer className="exam-card-footer">
                  <span>UPT Bahasa Universitas Dharma Andalas</span>
                  <strong>Hadir tepat waktu</strong>
                </footer>
              </div>
              <button type="button" className="btn btn-primary btn-block exam-screen-actions" onClick={() => window.print()}><Icon name="download" size={17} /> Unduh / Cetak PDF Kartu Ujian</button>
              <button type="button" className="btn btn-outline btn-block exam-screen-actions" onClick={() => navigate('/dashboard/mahasiswa/toefl?mode=baru')}>
                Daftar Ujian Baru
              </button>
            </div>
          </section>
          <aside className="toefl-register-side">
            <section className="panel"><header className="panel-head"><h2 className="panel-title">Anda siap mengikuti ujian</h2></header><div className="panel-body"><p>{formatTanggal(currentSession?.tanggal)}</p><p>{formatWaktu(currentSession?.waktu)} - {formatWaktu(currentSession?.waktu_selesai)} WIB</p><p>{currentSession?.lokasi || '-'}</p></div></section>
          </aside>
        </div>
      )}

      {buktiPreview && (
        <Modal title="Bukti pembayaran" onClose={() => setBuktiPreview(false)} size="lg">
          {filePreviewUrl ? (
            <img className="proof-modal-preview" src={storedProofUrl || filePreviewUrl} alt="Preview bukti pembayaran" />
          ) : (
            <div className="proof-modal-empty"><Icon name="file" size={28} /><strong>{file?.name || 'Bukti pembayaran tersimpan'}</strong><p>Bukti sudah dikirim dan akan ditinjau oleh admin.</p></div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Field({ label, hint, full, children }) {
  return <div className={`field ${full ? 'field-full' : ''}`}><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</div>;
}

function ConfirmRow({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function SideSummary({ session, user }) {
  return (
    <aside className="toefl-register-side">
      <section className="panel"><header className="panel-head"><h2 className="panel-title">Ringkasan ujian</h2></header><div className="panel-body"><p className="cell-sub">{session?.nama_sesi || 'Pilih sesi berikutnya'}</p><strong>{session?.tanggal ? formatTanggal(session.tanggal) : 'Tanggal belum dipilih'}</strong><dl className="summary-rows"><ConfirmRow label="Biaya" value={formatRupiah(session?.biaya || session?.tarif)} /><ConfirmRow label="Status" value={session ? 'Dibuka' : 'Belum memilih'} /></dl></div></section>
      <section className="panel"><header className="panel-head"><h2 className="panel-title">Peserta</h2></header><div className="panel-body"><strong>{user?.nama_lengkap || '-'}</strong><p className="cell-sub">NIM {user?.nim || '-'}</p></div></section>
    </aside>
  );
}

function PaymentSide({ session, waiting }) {
  return (
    <aside className="toefl-register-side">
      <section className="panel"><header className="panel-head"><h2 className="panel-title">Langkah selanjutnya</h2></header><div className="panel-body"><ol className="toefl-next"><li>Transfer sesuai nominal tagihan.</li><li>Unggah bukti pembayaran.</li><li>Tunggu verifikasi Staf UPT.</li>{!waiting && <li>Kartu ujian akan tersedia setelah terverifikasi.</li>}</ol></div></section>
    </aside>
  );
}

export default ToeflDaftarPage;
