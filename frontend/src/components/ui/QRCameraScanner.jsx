import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Icon from './Icon.jsx';

export default function QRCameraScanner({ onScan, onClose }) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [statusText, setStatusText] = useState('Menyiapkan kamera...');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const uniqueId = useId().replace(/:/g, '');
  const scannerContainerId = `qr-reader-viewport-${uniqueId}`;
  const html5QrCodeRef = useRef(null);
  const hasScannedRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  // Helper aman untuk menghentikan scanner
  const safeStop = async (scanner) => {
    if (!scanner) return;
    try {
      const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
      // State 2 = SCANNING, 3 = PAUSED
      if (state === 2 || state === 3 || scanner.isScanning) {
        await scanner.stop();
      }
    } catch (err) {
      console.warn('Stop scanner ignored:', err);
    }
    try {
      scanner.clear();
    } catch {
      // ignore clear error
    }
  };

  // 1. Ambil daftar kamera yang tersedia saat mount
  useEffect(() => {
    let cancelled = false;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCamera = devices.find((d) => {
            const label = (d.label || '').toLowerCase();
            return label.includes('back') || label.includes('belakang') || label.includes('environment') || label.includes('rear');
          });
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          // Fallback menggunakan constraint facingMode environment langsung
          setSelectedCameraId('__facing_environment__');
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Jika getCameras gagal (misal browser butuh start dulu untuk prompt izin), coba facingMode langsung
        setSelectedCameraId('__facing_environment__');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Jalankan scanner saat selectedCameraId berubah (tahan React 18 StrictMode)
  useEffect(() => {
    if (!selectedCameraId) return undefined;

    let cancelled = false;
    hasScannedRef.current = false;
    setErrorMsg(null);
    setStatusText('Menyalakan kamera...');

    const qrScanner = new Html5Qrcode(scannerContainerId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
      verbose: false,
    });
    html5QrCodeRef.current = qrScanner;

    const cameraConfig =
      selectedCameraId === '__facing_environment__'
        ? { facingMode: 'environment' }
        : selectedCameraId;

    const scanConfig = {
      fps: 15,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const boxSize = Math.max(160, Math.floor(minEdge * 0.72));
        return { width: boxSize, height: boxSize };
      },
    };

    qrScanner
      .start(
        cameraConfig,
        scanConfig,
        (decodedText) => {
          if (cancelled || hasScannedRef.current) return;
          hasScannedRef.current = true;
          setStatusText('QR Terdeteksi! Memproses presensi...');
          setIsScanning(false);

          // Hentikan kamera terlebih dahulu sebelum memanggil callback
          safeStop(qrScanner).finally(() => {
            if (!cancelled) {
              onScanRef.current(decodedText);
            }
          });
        },
        () => {
          // Abaikan frame yang belum berisi QR
        }
      )
      .then(() => {
        if (cancelled) {
          safeStop(qrScanner);
          return;
        }
        setIsScanning(true);
        setStatusText('Kamera aktif — arahkan ke QR Code');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Start scanner error:', err);
        setIsScanning(false);
        const isHttpsIssue =
          window.location.protocol !== 'https:' &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1';
        setErrorMsg(
          isHttpsIssue
            ? 'Akses kamera di HP melalui jaringan LAN memerlukan koneksi HTTPS. Anda tetap bisa menggunakan tombol "Pilih Foto QR" atau input Token PIN manual di bawah.'
            : 'Gagal mengakses kamera. Pastikan izin kamera pada browser sudah diizinkan dan tidak dipakai aplikasi lain.'
        );
      });

    return () => {
      cancelled = true;
      setIsScanning(false);
      safeStop(qrScanner);
    };
  }, [selectedCameraId, scannerContainerId]);

  // 3. Fallback: scan QR langsung dari file gambar / foto kamera HP
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusText('Membaca QR dari gambar...');
    try {
      if (html5QrCodeRef.current) {
        await safeStop(html5QrCodeRef.current);
      }
      const fileScanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const decodedText = await fileScanner.scanFile(file, false);
      setStatusText('QR Terdeteksi! Memproses presensi...');
      onScanRef.current(decodedText);
    } catch {
      setErrorMsg('QR Code tidak terbaca pada gambar tersebut. Pastikan gambar jelas atau masukkan Token PIN manual.');
      setStatusText('Gagal membaca gambar QR');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        border: '2px solid var(--brand-700)',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        position: 'relative',
        maxWidth: '440px',
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isScanning ? '#16a34a' : errorMsg ? '#dc2626' : '#eab308',
              display: 'inline-block',
            }}
          />
          <strong style={{ fontSize: '0.92rem', color: 'var(--brand-900)' }}>
            {statusText}
          </strong>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={() => {
              safeStop(html5QrCodeRef.current);
              onClose();
            }}
            className="icon-btn"
            style={{ padding: '4px', cursor: 'pointer' }}
            title="Tutup Kamera"
          >
            <Icon name="x" size={18} />
          </button>
        )}
      </div>

      {/* Pilihan Kamera jika lebih dari 1 (misal depan & belakang HP) */}
      {cameras.length > 1 && (
        <div style={{ marginBottom: '10px' }}>
          <select
            className="input input-plain"
            style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px' }}
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
          >
            {cameras.map((c, i) => (
              <option key={c.id} value={c.id}>
                {c.label || `Kamera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Viewport Kamera Video (HARUS display: block agar html5-qrcode tidak rusak layoutnya) */}
      <div
        id={scannerContainerId}
        style={{
          width: '100%',
          minHeight: '240px',
          background: '#0f172a',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />

      {errorMsg && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.82rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Fallback Upload / Foto QR langsung dari kamera HP */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--brand-800)',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--line)',
            background: '#f8fafc',
          }}
        >
          <Icon name="upload" size={14} />
          <span>Scan dari Foto / Galeri</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleScanFile}
            style={{ display: 'none' }}
          />
        </label>

        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          Pastikan QR terlihat jelas di dalam kotak
        </span>
      </div>
    </div>
  );
}
