// Komponen materi ruang kelas: formulir unggah (dosen), kartu berkas, dan unduhan lewat API.
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import Icon from '../ui/Icon.jsx';

export const ukuranTeks = (b) => {
  if (b === null || b === undefined) return 'berkas tidak ditemukan';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
};

const KELOMPOK_EKS = {
  pdf: 'PDF', doc: 'DOC', docx: 'DOC', ppt: 'PPT', pptx: 'PPT', xls: 'XLS', xlsx: 'XLS',
  txt: 'TXT', jpg: 'IMG', jpeg: 'IMG', png: 'IMG', zip: 'ZIP', rar: 'ZIP', mp3: 'AUD', mp4: 'VID',
};

/** Unduh materi lewat API yang mengecek akses (bukan tautan publik). */
export async function unduhMateri(m) {
  const res = await api.get(`/materi/${m.id_materi}/unduh`, { responseType: 'blob', timeout: 0 });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = m.nama_file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Kartu berkas: label ekstensi berwarna, nama berkas, ukuran, tombol unduh (+ hapus untuk dosen). */
export function BerkasMateri({ m, onHapus }) {
  const [sibuk, setSibuk] = useState(false);
  const kelompok = KELOMPOK_EKS[m.ekstensi] || (m.ekstensi || 'file').toUpperCase().slice(0, 4);
  const unduh = async () => {
    setSibuk(true);
    try {
      await unduhMateri(m);
    } catch {
      toast.error('Gagal mengunduh materi');
    } finally {
      setSibuk(false);
    }
  };
  return (
    <div className="berkas">
      <span className={`materi-eks eks-${kelompok.toLowerCase()}`}>{kelompok}</span>
      <div className="materi-info">
        <strong>{m.judul}</strong>
        <span>{m.nama_file} · {ukuranTeks(m.ukuran)}</span>
      </div>
      <div className="action-group">
        <button type="button" className="btn btn-outline btn-sm" onClick={unduh} disabled={sibuk || m.ukuran === null}>
          <Icon name="download" size={14} /> {sibuk ? 'Mengunduh...' : 'Unduh'}
        </button>
        {onHapus && (
          <button type="button" className="icon-btn" onClick={() => onHapus(m)} aria-label={`Hapus ${m.judul}`}>
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Formulir unggah materi untuk dosen pengampu. */
export function FormUnggahMateri({ idKelas, batas, onSelesai }) {
  const [judul, setJudul] = useState('');
  const [file, setFile] = useState(null);
  const [progres, setProgres] = useState(null);
  const [error, setError] = useState('');
  const [seret, setSeret] = useState(false);
  const inputRef = useRef(null);

  const pilihFile = (f) => {
    setError('');
    if (!f) return;
    const eks = `.${f.name.split('.').pop().toLowerCase()}`;
    if (!batas.ekstensi.includes(eks)) return setError(`Tipe berkas ${eks} tidak didukung`);
    if (f.size > batas.maks_mb * 1024 * 1024) return setError(`Ukuran berkas maksimal ${batas.maks_mb} MB`);
    setFile(f);
    if (!judul.trim()) setJudul(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 150));
  };

  const kirim = async (e) => {
    e.preventDefault();
    if (!file) return setError('Pilih berkas materi');
    if (judul.trim().length < 3) return setError('Judul minimal 3 karakter');
    const form = new FormData();
    form.append('judul', judul.trim());
    form.append('file', file);
    setProgres(0);
    try {
      const res = await api.post(`/materi/kelas/${idKelas}`, form, {
        timeout: 0,
        onUploadProgress: (ev) => ev.total && setProgres(Math.round((ev.loaded / ev.total) * 100)),
      });
      toast.success(res.data.message);
      setJudul('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onSelesai();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengunggah materi');
    } finally {
      setProgres(null);
    }
  };

  const sibuk = progres !== null;
  return (
    <form className="materi-form-isi" onSubmit={kirim}>
      <label
        className={`dropzone${seret ? ' is-seret' : ''}${file ? ' is-terisi' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setSeret(true); }}
        onDragLeave={() => setSeret(false)}
        onDrop={(e) => { e.preventDefault(); setSeret(false); pilihFile(e.dataTransfer.files?.[0]); }}
      >
        <input ref={inputRef} type="file" accept={batas.ekstensi.join(',')} onChange={(e) => pilihFile(e.target.files?.[0])} disabled={sibuk} />
        <Icon name={file ? 'file' : 'upload'} size={26} />
        {file ? (
          <span><strong>{file.name}</strong> · {ukuranTeks(file.size)}<em>Klik untuk mengganti berkas</em></span>
        ) : (
          <span><strong>Pilih berkas</strong> atau seret ke sini<em>Maks. {batas.maks_mb} MB · PDF, Word, PowerPoint, Excel, gambar, ZIP, audio/video</em></span>
        )}
      </label>
      <div className="field">
        <label className="field-label" htmlFor="judul-materi">Judul materi</label>
        <input
          id="judul-materi"
          className="input"
          value={judul}
          maxLength={150}
          onChange={(e) => { setJudul(e.target.value); setError(''); }}
          placeholder="Contoh: Pertemuan 3 - Listening Part B"
          disabled={sibuk}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      {sibuk && (
        <div className="meter" role="progressbar" aria-valuenow={progres} aria-valuemin={0} aria-valuemax={100} aria-label="Progres unggah">
          <span className="meter-fill" style={{ width: `${progres}%` }} />
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={sibuk}>
        <Icon name="upload" size={16} /> {sibuk ? `Mengunggah ${progres}%` : 'Unggah & bagikan ke kelas'}
      </button>
      <p className="field-hint">Peserta kelas mendapat notifikasi saat materi diunggah.</p>
    </form>
  );
}
