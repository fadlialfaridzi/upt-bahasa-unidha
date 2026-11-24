import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { PageHeader } from '../../../components/dashboard/Widgets.jsx';

const EMPTY = {
  nama_sesi: '',
  batas_pendaftaran: '',
  tanggal: '',
  jam_mulai: '',
  jam_selesai: '',
  ruang: '',
  kuota_min: 10,
  kuota_maks: 24,
  tarif: 650000,
  status: 'terbuka',
};

const toDateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';

const toTimeInput = (value) => {
  if (!value) return '';
  const raw = new Date(value);
  if (!Number.isNaN(raw.getTime()) && String(value).includes('T')) {
    return raw.toISOString().slice(11, 16);
  }
  return String(value).slice(0, 5);
};

const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatTanggal = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
  : 'Belum ditentukan';

function Field({ label, error, hint, full, children }) {
  return (
    <div className={`field ${full ? 'field-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function ToeflSesiFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/toefl/sesi/${id}`)
      .then((res) => {
        const item = res.data.data;
        setForm({
          nama_sesi: item.nama_sesi,
          batas_pendaftaran: item.batas_pendaftaran ? new Date(item.batas_pendaftaran).toISOString().slice(0, 16) : '',
          tanggal: toDateInput(item.tanggal),
          jam_mulai: toTimeInput(item.jam_mulai),
          jam_selesai: toTimeInput(item.jam_selesai),
          ruang: item.ruang || '',
          kuota_min: item.kuota_min,
          kuota_maks: item.kuota_maks,
          tarif: Number(item.tarif),
          status: item.status,
        });
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Gagal memuat sesi'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (name) => (e) => {
    setForm((value) => ({ ...value, [name]: e.target.value }));
    setErrors((value) => ({ ...value, [name]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (form.nama_sesi.trim().length < 3 || form.nama_sesi.trim().length > 100) found.nama_sesi = 'Nama sesi 3-100 karakter';
    if (!Number.isInteger(Number(form.kuota_min)) || Number(form.kuota_min) < 1 || Number(form.kuota_min) > 24) found.kuota_min = 'Bilangan bulat 1-24';
    if (!Number.isInteger(Number(form.kuota_maks)) || Number(form.kuota_maks) < 1 || Number(form.kuota_maks) > 24) found.kuota_maks = 'Bilangan bulat 1-24';
    if (Number(form.kuota_min) > Number(form.kuota_maks)) found.kuota_maks = 'Tidak boleh kurang dari kuota minimum';
    if (form.tarif === '' || Number(form.tarif) < 0 || !Number.isFinite(Number(form.tarif))) found.tarif = 'Isi tarif yang valid';
    if (form.jam_mulai && form.jam_selesai && form.jam_mulai >= form.jam_selesai) found.jam_selesai = 'Harus setelah waktu mulai';
    return found;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      ...form,
      nama_sesi: form.nama_sesi.trim(),
      kuota_min: Number(form.kuota_min),
      kuota_maks: Number(form.kuota_maks),
      tarif: Number(form.tarif),
      batas_pendaftaran: form.batas_pendaftaran || null,
      tanggal: form.tanggal || null,
      jam_mulai: form.jam_mulai || null,
      jam_selesai: form.jam_selesai || null,
      ruang: form.ruang || null,
    };

    setSaving(true);
    try {
      const res = isEdit
        ? await api.put(`/toefl/sesi/${id}`, payload)
        : await api.post('/toefl/sesi', payload);
      toast.success(res.data.message);
      navigate('/dashboard/admin/toefl/sesi');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan sesi TOEFL');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="table-message">Memuat data sesi TOEFL...</p>;

  return (
    <>
      <Link to="/dashboard/admin/toefl/sesi" className="back-link">
        <Icon name="arrowLeft" size={18} /> Kembali ke Kelola Sesi
      </Link>
      <PageHeader
        eyebrow="TOEFL / Kelola sesi"
        title={isEdit ? 'Ubah Sesi TOEFL' : 'Tambah Sesi TOEFL'}
        subtitle="Lengkapi informasi ujian, jadwal, kuota, dan biaya pendaftaran."
      />

      <form id="toefl-sesi-form" className="toefl-form-layout" onSubmit={handleSubmit} noValidate>
        <div className="toefl-form-main">
          <section className="panel toefl-form-section">
            <header className="panel-head">
              <div className="toefl-section-number">01</div>
              <div>
                <h2 className="panel-title">Informasi sesi</h2>
                <p className="panel-sub">Nama dan identitas utama sesi TOEFL.</p>
              </div>
            </header>
            <div className="panel-body">
              <div className="form-grid">
                <Field label="Nama sesi" error={errors.nama_sesi} full>
                  <input className="input input-plain" value={form.nama_sesi} onChange={set('nama_sesi')} placeholder="Contoh: Sesi TOEFL - November" maxLength={100} autoFocus />
                </Field>
                <Field label="Jenis sesi" hint="Pendaftaran terbuka untuk peserta">
                  <input className="input input-plain" value="Sesi ujian" disabled />
                </Field>
                {isEdit && (
                  <Field label="Status sesi" hint="Status operasional sesi">
                    <select className="input input-plain select" value={form.status} onChange={set('status')}>
                      <option value="terbuka">Pendaftaran dibuka</option>
                      <option value="menunggu_override">Menunggu persetujuan</option>
                      <option value="ujian_dibuka">Ujian dibuka</option>
                      <option value="dijadwalkan">Terjadwal</option>
                      <option value="selesai">Selesai</option>
                      <option value="dibatalkan">Dibatalkan</option>
                    </select>
                  </Field>
                )}
              </div>
            </div>
          </section>

          <section className="panel toefl-form-section">
            <header className="panel-head">
              <div className="toefl-section-number">02</div>
              <div>
                <h2 className="panel-title">Jadwal dan lokasi ujian</h2>
                <p className="panel-sub">Tanggal boleh diisi kemudian jika sesi masih menunggu kuota.</p>
              </div>
            </header>
            <div className="panel-body">
              <div className="form-grid">
                <Field label="Tanggal ujian">
                  <input className="input input-plain" type="date" value={form.tanggal} onChange={set('tanggal')} />
                </Field>
                <Field label="Lokasi ujian">
                  <input className="input input-plain" value={form.ruang} onChange={set('ruang')} placeholder="Contoh: Laboratorium Bahasa" />
                </Field>
                <Field label="Waktu mulai" error={errors.jam_mulai}>
                  <input className="input input-plain" type="time" value={form.jam_mulai} onChange={set('jam_mulai')} />
                </Field>
                <Field label="Waktu selesai" error={errors.jam_selesai}>
                  <input className="input input-plain" type="time" value={form.jam_selesai} onChange={set('jam_selesai')} />
                </Field>
                <Field label="Batas pendaftaran" hint="Opsional">
                  <input className="input input-plain" type="datetime-local" value={form.batas_pendaftaran} onChange={set('batas_pendaftaran')} />
                </Field>
              </div>
            </div>
          </section>

          <section className="panel toefl-form-section">
            <header className="panel-head">
              <div className="toefl-section-number">03</div>
              <div>
                <h2 className="panel-title">Kuota dan pendaftaran</h2>
                <p className="panel-sub">Tentukan kuota minimum, maksimum, dan tarif peserta.</p>
              </div>
            </header>
            <div className="panel-body">
              <div className="form-grid">
                <Field label="Kuota minimum" error={errors.kuota_min} hint="Standar 8-10 peserta">
                  <input className="input input-plain" type="number" min="1" max="24" value={form.kuota_min} onChange={set('kuota_min')} />
                </Field>
                <Field label="Kuota maksimum" error={errors.kuota_maks} hint="Maksimal 24 peserta">
                  <input className="input input-plain" type="number" min="1" max="24" value={form.kuota_maks} onChange={set('kuota_maks')} />
                </Field>
                <Field label="Biaya ujian" error={errors.tarif} hint="Tarif per peserta">
                  <input className="input input-plain" type="number" min="0" step="1000" value={form.tarif} onChange={set('tarif')} />
                </Field>
              </div>
            </div>
          </section>
        </div>

        <aside className="toefl-form-side">
          <section className="panel preview-card">
            <header className="panel-head"><h2 className="panel-title">Ringkasan sesi</h2></header>
            <div className="panel-body">
              <span className="badge badge-muted">Draft informasi</span>
              <h3>{form.nama_sesi || 'Nama sesi TOEFL'}</h3>
              <dl className="preview-list">
                <div><dt>Tanggal ujian</dt><dd>{formatTanggal(form.tanggal)}</dd></div>
                <div><dt>Waktu</dt><dd>{form.jam_mulai || '-'} - {form.jam_selesai || '-'}</dd></div>
                <div><dt>Lokasi</dt><dd>{form.ruang || 'Belum ditentukan'}</dd></div>
                <div><dt>Kuota</dt><dd>{form.kuota_min} - {form.kuota_maks} peserta</dd></div>
                <div><dt>Biaya ujian</dt><dd>{rupiah(form.tarif)}</dd></div>
              </dl>
            </div>
          </section>
          <section className="notice toefl-rule-note">
            <Icon name="alert" size={18} />
            <div>
              <strong>Kebijakan kuota minimum</strong>
              <p>Sesi dapat dirilis ketika peserta terverifikasi mencapai kuota minimum. Jika perlu pengecualian, gunakan mekanisme override kuota.</p>
            </div>
          </section>
        </aside>
      </form>

      <div className="toefl-form-footer">
        <span>{isEdit ? 'Perubahan akan segera diterapkan.' : 'Sesi baru dibuat dengan status pendaftaran terbuka.'}</span>
        <div>
          <Link to="/dashboard/admin/toefl/sesi" className="btn btn-outline">Batal</Link>
          <button type="submit" form="toefl-sesi-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Buat sesi TOEFL'}
          </button>
        </div>
      </div>
    </>
  );
}

export default ToeflSesiFormPage;
