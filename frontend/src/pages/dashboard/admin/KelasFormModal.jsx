import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import { ATURAN_TIPE_KELAS, JENIS_PELATIHAN, STATUS_KELAS, TIPE_KELAS, toDateInput, toOptions } from '../../../config/pelatihan.js';

const EMPTY = {
  nama_kelas: '',
  jenis_pelatihan: 'toefl_preparation',
  tipe_kelas: 'kelas',
  kuota_maks: 12,
  jumlah_pertemuan: 20,
  tarif: '',
  tanggal_mulai: '',
  kuesioner_mulai: '',
  kuesioner_selesai: '',
  status: 'dibuka',
};

const fromKelas = (k) => ({
  nama_kelas: k.nama_kelas,
  jenis_pelatihan: k.jenis_pelatihan,
  tipe_kelas: k.tipe_kelas,
  kuota_maks: k.kuota_maks,
  jumlah_pertemuan: k.jumlah_pertemuan,
  tarif: Number(k.tarif),
  tanggal_mulai: toDateInput(k.tanggal_mulai),
  kuesioner_mulai: toDateInput(k.kuesioner_mulai),
  kuesioner_selesai: toDateInput(k.kuesioner_selesai),
  status: k.status,
});

// Validasi sisi klien (backend tetap memvalidasi ulang).
const validate = (f, kelas) => {
  const e = {};
  const nama = f.nama_kelas.trim();
  if (nama.length < 3 || nama.length > 100) e.nama_kelas = 'Nama kelas 3–100 karakter';
  const kuota = Number(f.kuota_maks);
  if (!Number.isInteger(kuota) || kuota < 1 || kuota > 500) e.kuota_maks = 'Bilangan bulat 1–500';
  else if (kelas && kuota < kelas.jumlah_peserta) e.kuota_maks = `Minimal ${kelas.jumlah_peserta} (peserta terdaftar)`;
  const pertemuan = Number(f.jumlah_pertemuan);
  if (!Number.isInteger(pertemuan) || pertemuan < 1 || pertemuan > 100) e.jumlah_pertemuan = 'Bilangan bulat 1–100';
  else if (kelas && pertemuan < kelas.pertemuan_terjadwal) e.jumlah_pertemuan = `Minimal ${kelas.pertemuan_terjadwal} (sudah dijadwalkan)`;
  if (f.tarif === '' || Number(f.tarif) < 0 || !Number.isFinite(Number(f.tarif))) e.tarif = 'Isi tarif (0 jika gratis)';
  if (f.kuesioner_mulai && f.kuesioner_selesai && f.kuesioner_mulai > f.kuesioner_selesai) {
    e.kuesioner_selesai = 'Harus setelah tanggal mulai kuesioner';
  }
  return e;
};

function Field({ label, error, hint, children, full }) {
  return (
    <div className={`field ${full ? 'field-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function KelasFormModal({ kelas, onClose, onSaved }) {
  const isEdit = Boolean(kelas);
  const [form, setForm] = useState(isEdit ? fromKelas(kelas) : EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  // Reguler = 20 pertemuan tetap; intensif bebas
  const aturan = ATURAN_TIPE_KELAS[form.tipe_kelas];
  const jumlahTetap = aturan?.jumlahPertemuan ?? null;
  const setTipe = (e) => {
    const tipe = e.target.value;
    const tetap = ATURAN_TIPE_KELAS[tipe]?.jumlahPertemuan;
    setForm((f) => ({ ...f, tipe_kelas: tipe, ...(tetap ? { jumlah_pertemuan: tetap } : {}) }));
    setErrors((er) => ({ ...er, jumlah_pertemuan: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form, kelas);
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      ...form,
      nama_kelas: form.nama_kelas.trim(),
      kuota_maks: Number(form.kuota_maks),
      jumlah_pertemuan: Number(form.jumlah_pertemuan),
      tarif: Number(form.tarif),
      tanggal_mulai: form.tanggal_mulai || null,
      kuesioner_mulai: form.kuesioner_mulai || null,
      kuesioner_selesai: form.kuesioner_selesai || null,
    };
    if (!isEdit) delete payload.status;

    setSaving(true);
    try {
      const res = isEdit
        ? await api.put(`/kelas/${kelas.id_kelas}`, payload)
        : await api.post('/kelas', payload);
      toast.success(res.data.message);
      onSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kelas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Ubah kelas' : 'Buat kelas baru'}
      subtitle={isEdit ? kelas.nama_kelas : 'Pengajar dan jadwal pertemuan diatur di menu Plotting Jadwal.'}
      onClose={onClose}
      busy={saving}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="kelas-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Buat kelas'}
          </button>
        </>
      }
    >
      <form id="kelas-form" className="form-grid" onSubmit={handleSubmit} noValidate>
        <Field label="Nama kelas" error={errors.nama_kelas} full>
          <input
            className="input input-plain"
            value={form.nama_kelas}
            onChange={set('nama_kelas')}
            placeholder="Contoh: Persiapan TOEFL · Kelas A"
            maxLength={100}
            autoFocus
          />
        </Field>

        <Field label="Jenis pelatihan">
          <select className="input input-plain select" value={form.jenis_pelatihan} onChange={set('jenis_pelatihan')}>
            {toOptions(JENIS_PELATIHAN).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Tipe kelas" hint={aturan?.keterangan}>
          <div className="segmented" role="radiogroup" aria-label="Tipe kelas">
            {toOptions(TIPE_KELAS).map((o) => (
              <label key={o.value} className={form.tipe_kelas === o.value ? 'active' : ''}>
                <input
                  type="radio"
                  name="tipe_kelas"
                  value={o.value}
                  checked={form.tipe_kelas === o.value}
                  onChange={setTipe}
                />
                {o.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Kuota maksimal" error={errors.kuota_maks} hint="Jumlah peserta">
          <input className="input input-plain" type="number" min="1" max="500" value={form.kuota_maks} onChange={set('kuota_maks')} />
        </Field>

        <Field
          label="Jumlah pertemuan"
          error={errors.jumlah_pertemuan}
          hint={jumlahTetap ? 'Tetap untuk kelas reguler' : 'Sesuai kebutuhan peserta'}
        >
          <input
            className="input input-plain"
            type="number"
            min="1"
            max="100"
            value={form.jumlah_pertemuan}
            onChange={set('jumlah_pertemuan')}
            disabled={Boolean(jumlahTetap)}
          />
        </Field>

        <Field label="Tarif (Rp)" error={errors.tarif} hint="Per peserta">
          <input className="input input-plain" type="number" min="0" step="1000" value={form.tarif} onChange={set('tarif')} placeholder="500000" />
        </Field>

        <Field label="Tanggal mulai" hint="Opsional">
          <input className="input input-plain" type="date" value={form.tanggal_mulai} onChange={set('tanggal_mulai')} />
        </Field>

        <Field label="Kuesioner dibuka" hint="Opsional">
          <input className="input input-plain" type="date" value={form.kuesioner_mulai} onChange={set('kuesioner_mulai')} />
        </Field>

        <Field label="Kuesioner ditutup" error={errors.kuesioner_selesai} hint="Opsional">
          <input className="input input-plain" type="date" value={form.kuesioner_selesai} onChange={set('kuesioner_selesai')} />
        </Field>

        {isEdit && (
          <Field label="Status" hint={form.status === 'dibatalkan' ? 'Kelas tidak lagi menerima pendaftaran.' : undefined} full>
            <select className="input input-plain select" value={form.status} onChange={set('status')}>
              {toOptions(STATUS_KELAS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  );
}

export default KelasFormModal;
