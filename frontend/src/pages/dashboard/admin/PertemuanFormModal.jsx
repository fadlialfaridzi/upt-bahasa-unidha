import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { todayInput } from '../../../config/pelatihan.js';
import PengajarSelect from './PengajarSelect.jsx';

function PertemuanFormModal({ kelas, pertemuan, onClose, onSaved }) {
  const isEdit = Boolean(pertemuan);
  const waktuTerkunci = isEdit && (pertemuan.status_presensi || pertemuan.jumlah_presensi > 0);
  const [form, setForm] = useState(
    isEdit
      ? {
          tanggal: pertemuan.tanggal,
          jam_mulai: pertemuan.jam_mulai,
          jam_selesai: pertemuan.jam_selesai,
          ruang: pertemuan.ruang ?? '',
          id_pengajar: String(pertemuan.pengajar.id_pengguna),
          topik: pertemuan.topik ?? '',
        }
      : { tanggal: todayInput(), jam_mulai: '09:00', jam_selesai: '10:40', ruang: '', id_pengajar: '', topik: '' }
  );
  const [errors, setErrors] = useState({});
  const [bentrok, setBentrok] = useState([]);
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
    setBentrok([]);
  };

  const waktuValid = Boolean(form.tanggal && form.jam_mulai && form.jam_selesai && form.jam_mulai < form.jam_selesai);

  const validate = () => {
    const e = {};
    if (!form.tanggal) e.tanggal = 'Wajib diisi';
    if (!form.jam_mulai || !form.jam_selesai) e.jam = 'Isi jam mulai dan selesai';
    else if (form.jam_mulai >= form.jam_selesai) e.jam = 'Jam mulai harus sebelum jam selesai';
    if (!form.id_pengajar) e.id_pengajar = 'Pilih pengajar';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = { ...form, id_pengajar: Number(form.id_pengajar) };
    setSaving(true);
    try {
      const res = isEdit
        ? await api.put(`/kelas/${kelas.id_kelas}/pertemuan/${pertemuan.id_pertemuan}`, payload)
        : await api.post(`/kelas/${kelas.id_kelas}/pertemuan`, payload);
      toast.success(res.data.message);
      onSaved(res.data.data);
    } catch (err) {
      const data = err.response?.data;
      if (data?.bentrok?.length) setBentrok(data.bentrok);
      else toast.error(data?.message || 'Gagal menyimpan pertemuan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? `Ubah pertemuan ${pertemuan.pertemuan_ke}` : 'Tambah pertemuan'}
      subtitle={kelas.nama_kelas}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="pertemuan-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Tambah pertemuan'}
          </button>
        </>
      }
    >
      {bentrok.length > 0 && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={18} />
          <div>
            <strong>Jadwal bentrok</strong>
            <ul>{bentrok.map((b, i) => <li key={i}>{b.pesan}</li>)}</ul>
          </div>
        </div>
      )}

      <form id="pertemuan-form" className="form-grid" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <span className="field-label">Tanggal</span>
          <input className="input input-plain" type="date" value={form.tanggal} onChange={set('tanggal')} disabled={waktuTerkunci} />
          {errors.tanggal && <span className="field-error">{errors.tanggal}</span>}
        </div>
        <div className="field">
          <span className="field-label">Jam mulai</span>
          <input className="input input-plain" type="time" value={form.jam_mulai} onChange={set('jam_mulai')} disabled={waktuTerkunci} />
        </div>
        <div className="field">
          <span className="field-label">Jam selesai</span>
          <input className="input input-plain" type="time" value={form.jam_selesai} onChange={set('jam_selesai')} disabled={waktuTerkunci} />
          {errors.jam && <span className="field-error">{errors.jam}</span>}
        </div>
        {waktuTerkunci && (
          <p className="field-hint field-full">Tanggal & jam terkunci karena presensi pertemuan ini sudah dibuka.</p>
        )}

        <div className="field">
          <span className="field-label">Ruang</span>
          <input className="input input-plain" value={form.ruang} onChange={set('ruang')} placeholder="Ruang Bahasa 1" maxLength={50} />
        </div>
        <div className="field field-span-2">
          <span className="field-label">Pengajar (yang tersedia)</span>
          <PengajarSelect
            idKelas={kelas.id_kelas}
            waktu={waktuValid ? { tanggal: form.tanggal, jam_mulai: form.jam_mulai, jam_selesai: form.jam_selesai, abaikan_id: pertemuan?.id_pertemuan } : null}
            value={form.id_pengajar}
            onChange={(v) => {
              setForm((f) => ({ ...f, id_pengajar: v }));
              setErrors((er) => ({ ...er, id_pengajar: undefined }));
              setBentrok([]);
            }}
            error={errors.id_pengajar}
          />
        </div>
        <div className="field field-full">
          <span className="field-label">Topik</span>
          <input className="input input-plain" value={form.topik} onChange={set('topik')} placeholder="Opsional, mis. Listening comprehension" maxLength={150} />
        </div>
      </form>
    </Modal>
  );
}

export default PertemuanFormModal;
