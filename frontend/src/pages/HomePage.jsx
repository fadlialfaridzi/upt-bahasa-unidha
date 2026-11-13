import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPathFor } from '../config/roles.js';
import Icon from '../components/ui/Icon.jsx';

const HIGHLIGHTS = [
  { value: 'TOEFL', label: 'ITP', note: 'Tes resmi per sesi, kuota terbatas' },
  { value: '4', label: 'Jenis pelatihan', note: 'TOEFL Prep, TOEFL, IELTS, Conversation' },
  { value: 'ID ⇄ EN', label: 'Penerjemahan', note: 'Ijazah, transkrip, jurnal, abstrak' },
  { value: 'QR', label: 'Presensi kelas', note: 'Dengan peringatan dini kehadiran' },
];

const SERVICES = [
  {
    icon: 'graduation',
    title: 'Tes TOEFL ITP',
    desc: 'Pilih sesi ujian yang tersedia, bayar tagihan, dan pantau hasil tes langsung dari akun Anda.',
    features: ['Jadwal & sisa kuota per sesi', 'Tagihan dan unggah bukti bayar', 'Skor dan sertifikat digital'],
  },
  {
    icon: 'book',
    title: 'Kelas Pelatihan',
    desc: 'Ikuti kelas persiapan TOEFL, IELTS, maupun percakapan bersama pengajar UPT Bahasa.',
    features: ['Kelas reguler atau intensif', 'Presensi QR & materi per pertemuan', 'Opsi pembayaran angsuran'],
  },
  {
    icon: 'languages',
    title: 'Jasa Penerjemahan',
    desc: 'Ajukan dokumen akademik untuk diterjemahkan dengan estimasi biaya dan waktu yang transparan.',
    features: ['Estimasi biaya per halaman', 'Lacak status pengerjaan', 'Revisi hasil terjemahan'],
  },
];

const STEPS = [
  { title: 'Buat akun', text: 'Daftar sekali dengan email kampus atau email pribadi.' },
  { title: 'Pilih layanan', text: 'Daftar sesi TOEFL, kelas pelatihan, atau ajukan dokumen.' },
  { title: 'Bayar tagihan', text: 'Transfer ke rekening resmi kampus, lalu unggah bukti bayar.' },
  { title: 'Ikuti & terima hasil', text: 'Ikuti layanan, lalu unduh nilai dan sertifikat digital.' },
];

function HomePage() {
  const { user } = useAuth();
  const [kode, setKode] = useState('');
  const portalPath = user ? dashboardPathFor(user.role) : '/login';

  const handleVerify = (e) => {
    e.preventDefault();
    if (!kode.trim()) {
      toast.warn('Masukkan nomor sertifikat atau kode verifikasi terlebih dahulu.');
      return;
    }
    toast.info('Fitur validasi sertifikat sedang dikembangkan.');
  };

  return (
    <>
      {/* Hero */}
      <div className="container hero-wrap">
        <section className="hero">
          <div className="hero-inner">
            <div>
              <p className="hero-eyebrow">UPT Bahasa · Universitas Dharma Andalas</p>
              <h1>Layanan bahasa terpadu, dari pendaftaran hingga sertifikat.</h1>
              <p className="hero-lead">
                Daftar tes TOEFL, ikuti kelas pelatihan, dan ajukan penerjemahan dokumen dalam satu portal yang
                rapi dan mudah dipantau.
              </p>
              <div className="hero-actions">
                <Link to={portalPath} className="btn btn-primary">
                  {user ? 'Buka dashboard' : 'Masuk ke portal'}
                  <Icon name="arrowRight" size={18} />
                </Link>
                <a href="#layanan" className="btn btn-ghost-light">
                  Lihat layanan
                </a>
              </div>
            </div>

            <aside className="hero-card" aria-label="Ringkasan portal">
              <div className="hero-card-head">
                <strong>Satu akun, semua layanan</strong>
                <span className="dot-label">Dibuka</span>
              </div>
              <ul className="check-list">
                <li><Icon name="checkCircle" size={18} />Daftar tes TOEFL ITP per sesi</li>
                <li><Icon name="checkCircle" size={18} />Ikut kelas pelatihan & presensi QR</li>
                <li><Icon name="checkCircle" size={18} />Ajukan penerjemahan dokumen</li>
                <li><Icon name="checkCircle" size={18} />Validasi keaslian sertifikat</li>
              </ul>
            </aside>
          </div>
        </section>

        <div className="announce" role="note">
          <Icon name="megaphone" size={18} />
          <span>Jadwal sesi Tes TOEFL ITP terbaru dapat dilihat setelah masuk ke portal.</span>
          <Link to={portalPath} aria-label="Masuk ke portal">
            <span>Lihat jadwal</span>
            <Icon name="arrowRight" size={18} />
          </Link>
        </div>

        <div className="stats-row">
          {HIGHLIGHTS.map((h) => (
            <div className="stat-item" key={h.label}>
              <strong>{h.value}</strong>
              <span>{h.label}</span>
              <p>{h.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Layanan */}
      <section className="section" id="layanan">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Layanan utama</p>
              <h2 className="section-title">Apa yang bisa Anda lakukan di sini</h2>
              <p className="section-sub">Tiga layanan inti UPT Bahasa, dikelola dalam satu sistem.</p>
            </div>
          </div>
          <div className="service-grid">
            {SERVICES.map((s) => (
              <article className="card service-card" key={s.title}>
                <div className="service-card-head">
                  <span className="icon-tile"><Icon name={s.icon} /></span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <ul className="feature-list">
                  {s.features.map((f) => (
                    <li key={f}><Icon name="check" size={16} />{f}</li>
                  ))}
                </ul>
                <Link to={portalPath} className="btn btn-soft btn-block">
                  Mulai <Icon name="arrowRight" size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Alur */}
      <section className="section" id="alur">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Alur layanan</p>
              <h2 className="section-title">Empat langkah sederhana</h2>
              <p className="section-sub">Berlaku untuk tes TOEFL, pelatihan, maupun penerjemahan.</p>
            </div>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li className="card step" key={s.title}>
                <span className="step-num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Validasi sertifikat */}
      <section className="section" id="validasi">
        <div className="container">
          <div className="card verify">
            <div>
              <p className="eyebrow">Validasi sertifikat</p>
              <h2>Periksa keaslian sertifikat UPT Bahasa</h2>
              <p>Masukkan nomor sertifikat atau kode verifikasi yang tercantum pada sertifikat.</p>
            </div>
            <form onSubmit={handleVerify}>
              <div className="verify-form">
                <div className="input-wrap">
                  <Icon name="search" size={18} className="input-icon" />
                  <input
                    className="input"
                    value={kode}
                    onChange={(e) => setKode(e.target.value)}
                    placeholder="Contoh: UPT/TOEFL/2026/0001"
                    aria-label="Nomor sertifikat atau kode verifikasi"
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  <Icon name="shield" size={18} /> Periksa
                </button>
              </div>
              <p className="verify-hint">Validasi dapat dilakukan tanpa login.</p>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
