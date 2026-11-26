import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Icon from './Icon.jsx';

export default function QRCodeView({ token, text, title = 'Presensi Perkuliahan', size = 180 }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const tokenData = token || text || '';

  // Generate QR Code secara lokal (offline-ready, tajam, instan)
  useEffect(() => {
    let active = true;
    if (!tokenData) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(tokenData, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Gagal membuat QR Code:', err);
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [tokenData]);

  // Handle ESC key untuk keluar dari mode fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen]);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (navigator.clipboard && tokenData) {
      navigator.clipboard.writeText(tokenData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Tampilan Standar (Di dalam modal / kartu) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
        }}
      >
        {/* QR Code Box dengan efek interaktif klik untuk Fullscreen */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsFullScreen(true)}
          onKeyDown={(e) => e.key === 'Enter' && setIsFullScreen(true)}
          title="Klik untuk memperbesar layar penuh (Fullscreen)"
          style={{
            position: 'relative',
            background: '#fff',
            padding: '12px',
            borderRadius: '14px',
            border: '2px solid var(--brand-200, #bbf7d0)',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 8px 22px rgba(22, 101, 52, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.06)';
          }}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code Presensi"
              style={{
                width: size,
                height: size,
                display: 'block',
                borderRadius: '8px',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div
              style={{
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                borderRadius: '8px',
                color: 'var(--muted)',
                fontSize: '0.82rem',
              }}
            >
              Membuat QR...
            </div>
          )}

          {/* Hint Overlay di bawah QR */}
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              color: 'var(--brand-800)',
              fontWeight: 600,
              background: 'var(--brand-50, #f0fdf4)',
              padding: '3px 10px',
              borderRadius: '20px',
            }}
          >
            <span>🔍 Klik untuk Layar Penuh</span>
          </div>
        </div>

        {/* PIN Token Presensi Box */}
        <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Kode Token PIN Presensi:
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px',
            }}
          >
            <code
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                letterSpacing: '1.5px',
                color: 'var(--brand-800)',
                background: '#f1f5f9',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                userSelect: 'all',
              }}
            >
              {tokenData || '—'}
            </code>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleCopy}
              style={{ padding: '6px 10px' }}
              title="Salin Kode Token"
            >
              {copied ? 'Tersalin!' : 'Salin'}
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODE FULLSCREEN ================= */}
      {isFullScreen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsFullScreen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            color: '#fff',
            animation: 'fadeIn 0.2s ease-out',
            cursor: 'zoom-out',
          }}
        >
          {/* Tombol Tutup Floating */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullScreen(false);
            }}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            title="Tutup Layar Penuh (ESC)"
          >
            <Icon name="x" size={24} />
          </button>

          {/* Container Konten Fullscreen */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              color: '#0f172a',
              borderRadius: '20px',
              padding: '28px 36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              maxWidth: '92vw',
              maxHeight: '92vh',
              textAlign: 'center',
              cursor: 'default',
            }}
          >
            <div style={{ marginBottom: '14px' }}>
              <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                🟢 Presensi Aktif
              </span>
              <h2 style={{ margin: '8px 0 2px', fontSize: '1.5rem', color: 'var(--brand-900)' }}>
                {title}
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
                Arahkan kamera HP ke layar untuk memindai QR code
              </p>
            </div>

            {/* Gambar QR Besar */}
            <div
              style={{
                background: '#fff',
                padding: '16px',
                borderRadius: '16px',
                border: '3px solid var(--brand-700)',
                margin: '10px 0 16px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
              }}
            >
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code Presensi Layar Penuh"
                  style={{
                    width: 'min(380px, 65vw)',
                    height: 'min(380px, 65vw)',
                    display: 'block',
                    borderRadius: '10px',
                    objectFit: 'contain',
                  }}
                />
              )}
            </div>

            {/* Token PIN Besar */}
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase' }}>
                Atau Masukkan Kode Token PIN:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                <code
                  style={{
                    fontSize: 'min(2rem, 6vw)',
                    fontWeight: 900,
                    letterSpacing: '3px',
                    color: 'var(--brand-800)',
                    background: '#f8fafc',
                    padding: '8px 20px',
                    borderRadius: '10px',
                    border: '2px solid #cbd5e1',
                    userSelect: 'all',
                  }}
                >
                  {tokenData}
                </code>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCopy}
                  style={{ padding: '10px 16px', fontSize: '0.9rem' }}
                >
                  {copied ? 'Tersalin!' : 'Salin Token'}
                </button>
              </div>
            </div>

            <p style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--muted)' }}>
              Klik di luar kotak atau tekan <strong>ESC</strong> untuk kembali ke dashboard
            </p>
          </div>
        </div>
      )}
    </>
  );
}
