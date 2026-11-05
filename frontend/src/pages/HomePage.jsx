import { Link } from 'react-router-dom';

function HomePage() {
  const services = [
    {
      title: 'Tes TOEFL',
      description: 'Daftarkan diri untuk mengikuti tes TOEFL resmi yang diselenggarakan oleh UPT Bahasa Unidha.',
      link: '/toefl',
      icon: '📝',
    },
    {
      title: 'Pelatihan TOEFL',
      description: 'Ikuti program pelatihan intensif untuk mempersiapkan diri menghadapi tes TOEFL.',
      link: '/pelatihan',
      icon: '📚',
    },
    {
      title: 'Jasa Terjemahan',
      description: 'Layanan terjemahan dokumen resmi oleh penerjemah tersertifikasi.',
      link: '/terjemahan',
      icon: '📄',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
        color: 'white',
        padding: '5rem 2rem',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 'bold' }}>
          Selamat Datang di UPT Bahasa
        </h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto 2rem' }}>
          Universitas Dharma Andalas — Layanan tes TOEFL, pelatihan, dan penerjemahan dokumen resmi.
        </p>
        <Link
          to="/toefl"
          style={{
            background: '#e8b84b',
            color: '#1e3a5f',
            padding: '0.8rem 2rem',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '1rem',
          }}
        >
          Lihat Jadwal Tes
        </Link>
      </section>

      {/* Services Section */}
      <section style={{ padding: '4rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '3rem', color: '#1e3a5f' }}>
          Layanan Kami
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          {services.map((service) => (
            <div
              key={service.title}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{service.icon}</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#1e3a5f' }}>{service.title}</h3>
              <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.6 }}>{service.description}</p>
              <Link
                to={service.link}
                style={{
                  display: 'inline-block',
                  background: '#1e3a5f',
                  color: 'white',
                  padding: '0.6rem 1.5rem',
                  borderRadius: '6px',
                  fontWeight: '500',
                }}
              >
                Selengkapnya
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default HomePage;
