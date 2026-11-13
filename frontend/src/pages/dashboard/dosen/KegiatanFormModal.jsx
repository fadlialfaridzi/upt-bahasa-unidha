import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import { HARI, todayInput } from '../../../config/pelatihan.js';

const tambahBulan = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

const JENIS = [
  { value: 'rutin', label: 'Rutin mingguan' },
  { value: 'sekali', label: 'Sekali (tanggal tertentu)' },
];

function KegiatanFormModal({ kegiatan, onClose, onSaved }) {
  const isEdit = Boolean(kegiatan);
  const hariIni = todayInput();
  const [form, setForm] = useState(
    isEdit
      ? {
          judul: kegiatan.judul,
          jenis: kegiatan.jenis,
          hari: [kegiatan.hari],
          tanggal: kegiatan.tanggal_mulai,
          tanggal_mulai: kegiatan.tanggal_mulai,
          tanggal_selesai: kegiatan.tanggal_selesai,
          jam_mulai: kegiatan.jam_mulai,
          jam_selesai: kegiatan.jam_selesai,
        }
      : {
          judul: '',
          jenis: 'rutin',
          hari: [],
          tanggal: hariIni,
          tanggal_mulai: hariIni,
          tanggal_selesai: tambahBulan(hariIni, 6),
          jam_mulai: '08:00',
          jam_selesai: '10:00',
        }
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };
  const toggleHari = (h) => {
    setForm((f) => {
      if (isEdit) return { ...f, hari: [h] }; // saat ubah: satu hari per kegiatan
      return { ...f, hari: f.hari.includes(h) ? f.hari.filter((x) => x !== h) : [...f.hari, h] };
    });
    setErrors((er) => ({ ...er, hari: undefined }));
  };

  const validate = () => {
    const e = {};
    const judul = form.judul.trim();
    if (judul.length < 2 || judul.length > 100) e.judul = 'Isi nama kegiatan (2–100 karakter)';
    if (!form.jam_mulai || !form.jam_selesai || form.jam_mulai >= form.jam_selesai) e.jam = 'Jam mulai harus sebelum jam selesai';
    if (form.jenis === 'sekali') {
      if (!form.tanggal) e.tanggal = 'Wajib diisi';
    } else {
      if (!form.hari.length) e.hari = 'Pilih minimal satu hari';
      if (!form.tanggal_mulai || !form.tanggal_selesai) e.periode = 'Isi periode berlaku';
      else if (form.tanggal_mulai > form.tanggal_selesai) e.periode = 'Tanggal mulai harus sebelum tanggal selesai';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload =
      form.jenis === 'sekali'
        ? { jenis: 'sekali', judul: form.judul.trim(), tanggal: form.tanggal, jam_mulai: form.jam_mulai, jam_selesai: form.jam_selesai }
        : {
            jenis: 'rutin',
            judul: form.judul.trim(),
            hari: form.hari,
            tanggal_mulai: form.tanggal_mulai,
            tanggal_selesai: form.tanggal_selesai,
            jam_mulai: form.jam_mulai,
            jam_selesai: form.jam_selesai,
          };

    setSaving(true);
    try {
      const res = isEdit
        ? await api.put(`/kegiatan-dosen/${kegiatan.id_kegiatan}`, payload)
        : await api.post('/kegiatan-dosen', payload);
      toast.success(res.data.message);
      onSaved(res.data.data, res.data.pertemuan_terdampak ?? []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kegiatan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Ubah kegiatan' : 'Tambah kegiatan'}
      subtitle="Waktu saat Anda tidak bisa mengajar di UPT Bahasa"
      onClose={onClose}
      busy={saving}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="kegiatan-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Tambah kegiatan'}
          </button>
        </>
      }
    >
      <form id="kegiatan-form" className="form-grid" onSubmit={handleSubmit} noValidate>
        <div className="field field-full">
          <span className="field-label">Nama kegiatan</span>
          <input
            className="input input-plain"
            value={form.judul}
            onChange={set('judul')}
            placeholder="Contoh: Mengajar Basis Data (S1), Rapat prodi"
            maxLength={100}
            autoFocus
          />
          {errors.judul && <span className="field-error">{errors.judul}</span>}
        </div>

        <div className="field field-full">
          <span className="field-label">Jenis</span>
          <div className="segmented" role="radiogroup" aria-label="Jenis kegiatan">
            {JENIS.map((j) => (
              <label key={j.value} className={form.jenis === j.value ? 'active' : ''}>
                <input type="radio" name="jenis" value={j.value} checked={form.jenis === j.value} onChange={set('jenis')} />
                {j.label}
              </label>
            ))}
          </div>
        </div>

        {form.jenis === 'rutin' ? (
          <>
            <div className="field field-full">
              <span className="field-label">{isEdit ? 'Hari' : 'Setiap hari'}</span>
              <div className="day-picker" role="group" aria-label="Hari kegiatan">
                {HARI.map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    className={`day-chip ${form.hari.includes(h.value) ? 'active' : ''}`}
                    aria-pressed={form.hari.includes(h.value)}
                    onClick={() => toggleHari(h.value)}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              {errors.hari && <span className="field-error">{errors.hari}</span>}
            </div>
            <div className="field">
              <span className="field-label">Berlaku mulai</span>
              <input className="input input-plain" type="date" value={form.tanggal_mulai} onChange={set('tanggal_mulai')} />
            </div>
            <div className="field field-span-2">
              <span className="field-label">Berlaku sampai</span>
              <input className="input input-plain" type="date" value={form.tanggal_selesai} onChange={set('tanggal_selesai')} />
              {errors.periode ? <span className="field-error">{errors.periode}</span> : <span className="field-hint">Misalnya akhir semester. Maksimal 1 tahun.</span>}
            </div>
          </>
        ) : (
          <div className="field">
            <span className="field-label">Tanggal</span>
            <input className="input input-plain" type="date" value={form.tanggal} onChange={set('tanggal')} />
            {errors.tanggal && <span className="field-error">{errors.tanggal}</span>}
          </div>
        )}

        <div className="field">
          <span className="field-label">Jam mulai</span>
          <input className="input input-plain" type="time" value={form.jam_mulai} onChange={set('jam_mulai')} />
        </div>
        <div className="field">
          <span className="field-label">Jam selesai</span>
          <input className="input input-plain" type="time" value={form.jam_selesai} onChange={set('jam_selesai')} />
          {errors.jam && <span className="field-error">{errors.jam}</span>}
        </div>
      </form>
    </Modal>
  );
}

export default KegiatanFormModal;
