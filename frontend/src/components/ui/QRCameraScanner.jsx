// Pemindai QR presensi dengan alur izin kamera yang jelas:
// 1. Cek status izin (Permissions API) -> langsung aktif bila sudah diizinkan.
// 2. Bila belum, tampilkan penjelasan + tombol "Izinkan kamera" (permintaan izin dari klik pengguna).
// 3. Bila gagal, jelaskan sebabnya (diblokir overlay Android, ditolak, kamera dipakai, tanpa HTTPS) + "Coba lagi".
// 4. Selalu ada cadangan "Ambil foto QR" lewat aplikasi kamera HP (tidak butuh izin kamera browser).
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Icon from './Icon.jsx';

const FACING = '__facing_environment__';

/** Status izin kamera: 'granted' | 'denied' | 'prompt' | null (browser tidak mendukung Permissions API). */
async function statusIzinKamera() {
  try {
    const s = await navigator.permissions?.query({ name: 'camera' });
    return s ?? null;
  } catch {
    return null;
  }
}

/** Kelompokkan error kamera ke sebab yang bisa dijelaskan ke pengguna. */
function jenisGalat(err) {
  const nama = err?.name || '';
  const pesan = String(err?.message || err || '');
  if (nama === 'NotAllowedError' || nama === 'SecurityError' || /NotAllowed|Permission/i.test(pesan)) return 'ditolak';
  if (nama === 'NotFoundError' || nama === 'OverconstrainedError' || /NotFound|no camera|Requested device not found/i.test(pesan)) return 'tanpa-kamera';
  if (nama === 'NotReadableError' || nama === 'AbortError' || /NotReadable|Could not start video/i.test(pesan)) return 'dipakai';
  return 'galat';
}

function buatPesan(showManualHint) {
  return {
    terblokir: {
      judul: 'Permintaan izin kamera terhalang',
      isi: 'Browser tidak bisa menampilkan permintaan izin karena ada aplikasi lain yang tampil di atas layar.',
      langkah: [
        'Tutup balon chat / jendela mengambang (Messenger, WhatsApp, dll.), hentikan perekam layar, dan matikan filter layar / mode malam.',
        'Atau izinkan langsung: ketuk ikon gembok di samping alamat situs → Izin → Kamera → Izinkan.',
        'Lalu tekan "Coba lagi".',
      ],
    },
    ditolak: {
      judul: 'Izin kamera ditolak',
      isi: 'Situs ini tidak diberi izin memakai kamera.',
      langkah: [
        'Ketuk ikon gembok di samping alamat situs → Izin / Setelan situs → Kamera → Izinkan.',
        'Lalu tekan "Coba lagi" (atau muat ulang halaman).',
      ],
    },
    dipakai: {
      judul: 'Kamera sedang dipakai',
      isi: 'Kamera sedang digunakan aplikasi atau tab lain.',
      langkah: ['Tutup aplikasi kamera / panggilan video / tab lain yang memakai kamera, lalu tekan "Coba lagi".'],
    },
    'tanpa-kamera': {
      judul: 'Kamera tidak ditemukan',
      isi: 'Perangkat ini tidak memiliki kamera yang bisa dipakai browser.',
      langkah: [
        showManualHint
          ? 'Gunakan "Ambil foto QR" atau ketik token presensi secara manual.'
          : 'Gunakan tombol "Ambil foto QR" di bawah atau hubungi pengawas ujian.',
      ],
    },
    https: {
      judul: 'Kamera butuh alamat HTTPS',
      isi: 'Browser hanya mengizinkan kamera pada situs HTTPS (atau localhost).',
      langkah: [
        showManualHint
          ? 'Buka situs lewat alamat https://, atau gunakan "Ambil foto QR" / ketik token manual.'
          : 'Buka situs lewat alamat https://, atau gunakan tombol "Ambil foto QR" di bawah.',
      ],
    },
    galat: {
      judul: 'Kamera gagal dinyalakan',
      isi: 'Terjadi kendala saat menyalakan kamera.',
      langkah: [
        showManualHint
          ? 'Tekan "Coba lagi". Bila tetap gagal, gunakan "Ambil foto QR" atau ketik token manual.'
          : 'Tekan "Coba lagi". Bila tetap gagal, gunakan tombol "Ambil foto QR" di bawah.',
      ],
    },
  };
}

export default function QRCameraScanner({ onScan, onClose, showManualHint = true }) {
  // tahap: cek | minta | meminta | mulai | aktif | selesai | <kunci PESAN>
  const [tahap, setTahap] = useState('cek');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [errorFoto, setErrorFoto] = useState(null);
  const [percobaan, setPercobaan] = useState(0);

  const uniqueId = useId().replace(/:/g, '');
  const scannerContainerId = `qr-reader-viewport-${uniqueId}`;
  const html5QrCodeRef = useRef(null);
  const hasScannedRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const safeStop = async (scanner) => {
    if (!scanner) return;
    try {
      const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
      if (state === 2 || state === 3 || scanner.isScanning) await scanner.stop(); // 2 = SCANNING, 3 = PAUSED
    } catch {
      // abaikan
    }
    try {
      scanner.clear();
    } catch {
      // abaikan
    }
  };

  // 1. Cek konteks aman & status izin saat dibuka / saat "Coba lagi"
  useEffect(() => {
    let batal = false;
    let status = null;
    const onChange = () => {
      if (!batal && status?.state === 'granted') setTahap((t) => (['minta', 'ditolak', 'terblokir'].includes(t) ? 'mulai' : t));
    };
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setTahap('https');
        return;
      }
      status = await statusIzinKamera();
      if (batal) return;
      if (status?.state === 'granted') setTahap('mulai');
      else if (status?.state === 'denied') setTahap('ditolak');
      else setTahap('minta');
      // Bila pengguna mengizinkan lewat setelan situs, kamera langsung menyala
      status?.addEventListener?.('change', onChange);
    })();
    return () => {
      batal = true;
      status?.removeEventListener?.('change', onChange);
    };
  }, [percobaan]);

  /** Minta izin dari klik pengguna (wajib di beberapa browser agar dialog izin muncul). */
  const mintaIzin = async () => {
    setTahap('meminta');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      stream.getTracks().forEach((t) => t.stop());
      setTahap('mulai');
    } catch (err) {
      const jenis = jenisGalat(err);
      if (jenis === 'ditolak') {
        // Masih "prompt" setelah ditolak = dialog tidak sempat tampil (biasanya diblokir overlay di Android)
        const s = await statusIzinKamera();
        setTahap(s?.state === 'denied' ? 'ditolak' : 'terblokir');
      } else {
        setTahap(jenis);
      }
    }
  };

  // 2. Daftar kamera (label tersedia setelah izin diberikan)
  useEffect(() => {
    if (tahap !== 'mulai' || selectedCameraId) return undefined;
    let batal = false;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (batal) return;
        if (devices?.length) {
          setCameras(devices);
          const belakang = devices.find((d) => /back|belakang|environment|rear/i.test(d.label || ''));
          setSelectedCameraId(belakang ? belakang.id : devices[0].id);
        } else {
          setSelectedCameraId(FACING);
        }
      })
      .catch(() => !batal && setSelectedCameraId(FACING));
    return () => {
      batal = true;
    };
  }, [tahap, selectedCameraId]);

  // 3. Jalankan pemindai
  useEffect(() => {
    if (!['mulai', 'aktif'].includes(tahap) || !selectedCameraId) return undefined;
    let cancelled = false;
    hasScannedRef.current = false;

    const qrScanner = new Html5Qrcode(scannerContainerId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      verbose: false,
    });
    html5QrCodeRef.current = qrScanner;

    qrScanner
      .start(
        selectedCameraId === FACING ? { facingMode: 'environment' } : selectedCameraId,
        {
          fps: 15,
          qrbox: (w, h) => {
            const size = Math.max(160, Math.floor(Math.min(w, h) * 0.72));
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          if (cancelled || hasScannedRef.current) return;
          hasScannedRef.current = true;
          setTahap('selesai');
          safeStop(qrScanner).finally(() => !cancelled && onScanRef.current(decodedText));
        },
        () => {},
      )
      .then(() => {
        if (cancelled) safeStop(qrScanner);
        else setTahap('aktif');
      })
      .catch((err) => {
        if (!cancelled) setTahap(jenisGalat(err));
      });

    return () => {
      cancelled = true;
      safeStop(qrScanner);
    };
    // tahap sengaja tidak menjadi dependensi agar perubahan 'mulai' -> 'aktif' tidak memulai ulang kamera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId, scannerContainerId, tahap === 'mulai' || tahap === 'aktif']);

  const cobaLagi = useCallback(() => {
    safeStop(html5QrCodeRef.current);
    setSelectedCameraId('');
    setErrorFoto(null);
    setPercobaan((n) => n + 1);
  }, []);

  // 4. Cadangan: foto QR lewat aplikasi kamera HP (tidak memerlukan izin kamera browser)
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorFoto(null);
    try {
      if (html5QrCodeRef.current) await safeStop(html5QrCodeRef.current);
      const fileScanner = new Html5Qrcode(scannerContainerId, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      const decodedText = await fileScanner.scanFile(file, false);
      setTahap('selesai');
      onScanRef.current(decodedText);
    } catch {
      setErrorFoto(
        showManualHint
          ? 'QR tidak terbaca pada foto. Foto ulang lebih dekat dan pastikan QR tidak buram, atau ketik token manual.'
          : 'QR tidak terbaca pada foto. Foto ulang lebih dekat dan pastikan QR tidak buram.',
      );
    } finally {
      e.target.value = '';
    }
  };

  const tampilVideo = tahap === 'mulai' || tahap === 'aktif';
  const pesanMap = buatPesan(showManualHint);
  const info = pesanMap[tahap];
  const statusText = {
    cek: 'Memeriksa izin kamera...',
    minta: 'Kamera belum diizinkan',
    meminta: 'Menunggu izin kamera...',
    mulai: 'Menyalakan kamera...',
    aktif: 'Kamera aktif — arahkan ke QR',
    selesai: 'QR terdeteksi, memproses presensi...',
  }[tahap] ?? info?.judul;
  const warnaTitik = tahap === 'aktif' ? 'is-aktif' : info ? 'is-galat' : 'is-tunggu';

  return (
    <div className="qr-scan">
      <div className="qr-scan-head">
        <span className={`qr-scan-titik ${warnaTitik}`} aria-hidden="true" />
        <strong aria-live="polite">{statusText}</strong>
        {onClose && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              safeStop(html5QrCodeRef.current);
              onClose();
            }}
            aria-label="Tutup pemindai"
          >
            <Icon name="x" size={18} />
          </button>
        )}
      </div>

      {tahap === 'aktif' && cameras.length > 1 && (
        <select className="input select-sm qr-scan-kamera" value={selectedCameraId} onChange={(e) => setSelectedCameraId(e.target.value)} aria-label="Pilih kamera">
          {cameras.map((c, i) => <option key={c.id} value={c.id}>{c.label || `Kamera ${i + 1}`}</option>)}
        </select>
      )}

      {/* Wadah video html5-qrcode: selalu ada di DOM (juga dipakai untuk membaca foto) */}
      <div id={scannerContainerId} className="qr-scan-video" style={{ display: tampilVideo ? 'block' : 'none' }} />

      {(tahap === 'minta' || tahap === 'meminta') && (
        <div className="qr-scan-izin">
          <span className="qr-scan-ikon"><Icon name="camera" size={28} /></span>
          <p>Izinkan browser memakai kamera untuk memindai QR presensi.</p>
          <button type="button" className="btn btn-primary" onClick={mintaIzin} disabled={tahap === 'meminta'}>
            <Icon name="camera" size={16} /> {tahap === 'meminta' ? 'Menunggu izin...' : 'Izinkan kamera'}
          </button>
          <small>Jika muncul pesan <em>"Situs tidak dapat meminta izin Anda"</em>, tutup dulu balon chat, perekam layar, atau filter layar.</small>
        </div>
      )}

      {info && (
        <div className="qr-scan-galat" role="alert">
          <strong>{info.judul}</strong>
          <p>{info.isi}</p>
          <ol>{info.langkah.map((l) => <li key={l}>{l}</li>)}</ol>
          {tahap !== 'https' && tahap !== 'tanpa-kamera' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={cobaLagi}>
              <Icon name="refresh" size={14} /> Coba lagi
            </button>
          )}
        </div>
      )}

      {tahap === 'cek' && <p className="qr-scan-cek">Memeriksa izin kamera...</p>}

      <div className="qr-scan-foto">
        <label className={`btn btn-sm ${info ? 'btn-primary' : 'btn-outline'}`}>
          <Icon name="camera" size={14} /> Ambil foto QR
          <input type="file" accept="image/*" capture="environment" onChange={handleScanFile} hidden />
        </label>
        <span>Memakai aplikasi kamera HP, tidak perlu izin kamera browser.</span>
      </div>
      {errorFoto && <p className="field-error">{errorFoto}</p>}
    </div>
  );
}
