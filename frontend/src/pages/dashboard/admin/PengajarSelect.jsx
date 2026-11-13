import { useEffect, useState } from 'react';
import api from '../../../services/api.js';

/**
 * Dropdown pengajar yang hanya menampilkan dosen TERSEDIA pada waktu yang dipilih
 * (berdasarkan jadwal kegiatan dosen & jadwal mengajar kelas lain).
 *
 * @param idKelas   kelas yang sedang dijadwalkan
 * @param waktu     body untuk /pengajar-tersedia, atau null jika tanggal/jam belum lengkap
 * @param value     id_pengguna terpilih (string)
 * @param onChange  (id: string) => void
 * @param error     pesan validasi
 */
function PengajarSelect({ idKelas, waktu, value, onChange, error, autoPilihTunggal = false }) {
  const [list, setList] = useState(null); // null = belum dimuat
  const [loading, setLoading] = useState(false);
  const [gagal, setGagal] = useState(false);
  const [lihatAlasan, setLihatAlasan] = useState(false);
  const kunci = waktu ? JSON.stringify(waktu) : '';

  useEffect(() => {
    if (!kunci) {
      setList(null);
      return undefined;
    }
    let batal = false;
    setLoading(true);
    // Debounce agar tidak memanggil API di setiap ketikan jam/tanggal
    const t = setTimeout(async () => {
      try {
        const res = await api.post(`/kelas/${idKelas}/pertemuan/pengajar-tersedia`, JSON.parse(kunci));
        if (!batal) {
          setList(res.data.data);
          setGagal(false);
        }
      } catch {
        if (!batal) setGagal(true);
      } finally {
        if (!batal) setLoading(false);
      }
    }, 300);
    return () => {
      batal = true;
      clearTimeout(t);
    };
  }, [idKelas, kunci]);

  const tersedia = (list ?? []).filter((p) => p.tersedia);
  const tidakTersedia = (list ?? []).filter((p) => !p.tersedia);
  const terpilihTidakTersedia = value && tidakTersedia.find((p) => String(p.id_pengguna) === String(value));

  // Kosongkan pilihan yang ternyata tidak tersedia setelah waktu diubah; pilih otomatis jika hanya satu.
  useEffect(() => {
    if (!list) return;
    if (terpilihTidakTersedia) onChange('');
    else if (!value && autoPilihTunggal && tersedia.length === 1) onChange(String(tersedia[0].id_pengguna), tersedia[0].nama_lengkap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const placeholder = !waktu
    ? 'Isi tanggal & jam dahulu'
    : loading && !list
      ? 'Memeriksa ketersediaan...'
      : tersedia.length
        ? 'Pilih pengajar'
        : 'Tidak ada pengajar tersedia';

  return (
    <>
      <select
        className="input input-plain select"
        value={value}
        onChange={(e) => onChange(e.target.value, tersedia.find((p) => String(p.id_pengguna) === e.target.value)?.nama_lengkap)}
        disabled={!waktu || !list || !tersedia.length}
        aria-busy={loading}
      >
        <option value="">{placeholder}</option>
        {tersedia.map((p) => (
          <option key={p.id_pengguna} value={p.id_pengguna}>
            {p.nama_lengkap}{p.sudah_isi_jadwal ? '' : ' · belum isi jadwal kegiatan'}
          </option>
        ))}
      </select>

      {error && <span className="field-error">{error}</span>}
      {gagal && <span className="field-error">Gagal memeriksa ketersediaan pengajar.</span>}
      {loading && list && <span className="field-hint">Memperbarui ketersediaan...</span>}

      {!loading && list && tidakTersedia.length > 0 && (
        <span className="field-hint">
          {tersedia.length} tersedia · {tidakTersedia.length} tidak tersedia pada waktu ini.{' '}
          <button type="button" className="link-btn" onClick={() => setLihatAlasan((v) => !v)}>
            {lihatAlasan ? 'Sembunyikan' : 'Lihat alasan'}
          </button>
        </span>
      )}
      {lihatAlasan && tidakTersedia.length > 0 && (
        <ul className="unavailable-list">
          {tidakTersedia.map((p) => (
            <li key={p.id_pengguna}>
              <strong>{p.nama_lengkap}</strong>
              {p.jumlah_bentrok > 1 && <span> ({p.jumlah_bentrok} tanggal bentrok)</span>}
              <ul>{p.alasan.map((a) => <li key={a}>{a}</li>)}</ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default PengajarSelect;
