import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { ATURAN_TIPE_KELAS, HARI, JENIS_BENTROK, formatTanggal, toDateInput, todayInput } from '../../../config/pelatihan.js';
import PengajarSelect from './PengajarSelect.jsx';

// Dua langkah: (1) atur pola jadwal -> (2) pratinjau dengan tanda bentrok -> simpan baris terpilih.
function GenerateJadwalModal({ kelas, sisa, onClose, onSaved }) {
  const [form, setForm] = useState({
    tanggal_mulai: toDateInput(kelas.tanggal_mulai) || todayInput(),
    hari: [],
    jam_mulai: '09:00',
    jam_selesai: '10:40',
    ruang: '',
    id_pengajar: '',
    jumlah: sisa,
  });
  const [namaPengajar, setNamaPengajar] = useState('');

  // Pola lengkap -> cek ketersediaan pengajar untuk SEMUA tanggal yang akan dihasilkan
  const jumlahValid = Number.isInteger(Number(form.jumlah)) && Number(form.jumlah) >= 1 && Number(form.jumlah) <= sisa;
  const waktuPola =
    form.tanggal_mulai && form.hari.length && jumlahValid && form.jam_mulai && form.jam_selesai && form.jam_mulai < form.jam_selesai
      ? {
          tanggal_mulai: form.tanggal_mulai,
          hari: [...form.hari].sort(),
          jumlah: Number(form.jumlah),
          jam_mulai: form.jam_mulai,
          jam_selesai: form.jam_selesai,
        }
      : null;
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null); // null = langkah 1
  const [dipilih, setDipilih] = useState([]); // index baris preview yang akan disimpan
  const [busy, setBusy] = useState(false);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };
  // Reguler: 2–3 hari per minggu; intensif: bebas
  const aturan = ATURAN_TIPE_KELAS[kelas.tipe_kelas] ?? ATURAN_TIPE_KELAS.intensif;
  const maksHari = aturan.maxPertemuanPerMinggu ?? 7;
  const toggleHari = (h) => {
    setForm((f) => {
      if (f.hari.includes(h)) return { ...f, hari: f.hari.filter((x) => x !== h) };
      if (f.hari.length >= maksHari) return f; // batas reguler tercapai
      return { ...f, hari: [...f.hari, h] };
    });
    setErrors((er) => ({ ...er, hari: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.tanggal_mulai) e.tanggal_mulai = 'Wajib diisi';
    if (form.hari.length < aturan.minHariPerMinggu) {
      e.hari = aturan.maxPertemuanPerMinggu
        ? `Kelas reguler: pilih ${aturan.minHariPerMinggu} atau ${aturan.maxPertemuanPerMinggu} hari per minggu`
        : 'Pilih minimal satu hari';
    }
    if (!form.jam_mulai || !form.jam_selesai || form.jam_mulai >= form.jam_selesai) e.jam = 'Jam mulai harus sebelum jam selesai';
    if (!form.id_pengajar) e.id_pengajar = 'Pilih pengajar';
    const n = Number(form.jumlah);
    if (!Number.isInteger(n) || n < 1 || n > sisa) e.jumlah = `1–${sisa}`;
    return e;
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const res = await api.post(`/kelas/${kelas.id_kelas}/pertemuan/preview`, {
        ...form,
        id_pengajar: Number(form.id_pengajar),
        jumlah: Number(form.jumlah),
      });
      const rows = res.data.data;
      setPreview(rows);
      setDipilih(rows.map((r, i) => (r.bentrok.length ? null : i)).filter((i) => i !== null));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat pratinjau');
    } finally {
      setBusy(false);
    }
  };

  const jumlahBentrok = useMemo(() => (preview ?? []).filter((r) => r.bentrok.length).length, [preview]);
  const adaBentrokDipilih = dipilih.some((i) => preview?.[i]?.bentrok.length);
  const toggleBaris = (i) => setDipilih((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort((a, b) => a - b)));

  const handleSave = async () => {
    setBusy(true);
    try {
      const items = dipilih.map((i) => {
        const { bentrok, hari, ...row } = preview[i];
        return row;
      });
      const res = await api.post(`/kelas/${kelas.id_kelas}/pertemuan`, { items });
      toast.success(res.data.message);
      onSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan jadwal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Buat jadwal otomatis"
      subtitle={`${kelas.nama_kelas} · sisa ${sisa} pertemuan belum dijadwalkan`}
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        preview ? (
          <>
            <button type="button" className="btn btn-outline" onClick={() => setPreview(null)} disabled={busy}>
              <Icon name="arrowLeft" size={16} /> Ubah pengaturan
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy || !dipilih.length || adaBentrokDipilih}>
              {busy ? 'Menyimpan...' : `Simpan ${dipilih.length} pertemuan`}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button>
            <button type="submit" form="generate-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Memeriksa...' : 'Lihat pratinjau'} {!busy && <Icon name="arrowRight" size={16} />}
            </button>
          </>
        )
      }
    >
      {!preview ? (
        <form id="generate-form" className="form-grid" onSubmit={handlePreview} noValidate>
          <div className="field field-full">
            <span className="field-label">Hari pertemuan</span>
            <div className="day-picker" role="group" aria-label="Hari pertemuan">
              {HARI.map((h) => {
                const aktif = form.hari.includes(h.value);
                return (
                  <button
                    key={h.value}
                    type="button"
                    className={`day-chip ${aktif ? 'active' : ''}`}
                    aria-pressed={aktif}
                    disabled={!aktif && form.hari.length >= maksHari}
                    onClick={() => toggleHari(h.value)}
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
            {errors.hari ? <span className="field-error">{errors.hari}</span> : <span className="field-hint">{aturan.keterangan}</span>}
          </div>

          <div className="field">
            <span className="field-label">Mulai dari tanggal</span>
            <input className="input input-plain" type="date" value={form.tanggal_mulai} onChange={set('tanggal_mulai')} />
            {errors.tanggal_mulai && <span className="field-error">{errors.tanggal_mulai}</span>}
          </div>
          <div className="field">
            <span className="field-label">Jam mulai</span>
            <input className="input input-plain" type="time" value={form.jam_mulai} onChange={set('jam_mulai')} />
          </div>
          <div className="field">
            <span className="field-label">Jam selesai</span>
            <input className="input input-plain" type="time" value={form.jam_selesai} onChange={set('jam_selesai')} />
            {errors.jam && <span className="field-error">{errors.jam}</span>}
          </div>

          <div className="field field-span-2">
            <span className="field-label">Pengajar (tersedia di semua tanggal)</span>
            <PengajarSelect
              idKelas={kelas.id_kelas}
              waktu={waktuPola}
              value={form.id_pengajar}
              onChange={(v, nama) => {
                setForm((f) => ({ ...f, id_pengajar: v }));
                setNamaPengajar(nama ?? '');
                setErrors((er) => ({ ...er, id_pengajar: undefined }));
              }}
              error={errors.id_pengajar}
              autoPilihTunggal
            />
          </div>
          <div className="field">
            <span className="field-label">Jumlah pertemuan</span>
            <input className="input input-plain" type="number" min="1" max={sisa} value={form.jumlah} onChange={set('jumlah')} />
            {errors.jumlah ? <span className="field-error">{errors.jumlah}</span> : <span className="field-hint">Maksimal {sisa}</span>}
          </div>

          <div className="field field-full">
            <span className="field-label">Ruang</span>
            <input className="input input-plain" value={form.ruang} onChange={set('ruang')} placeholder="Ruang Bahasa 1 (opsional)" maxLength={50} />
            <span className="field-hint">Pengajar per pertemuan masih bisa diganti setelah jadwal dibuat.</span>
          </div>
        </form>
      ) : (
        <>
          <div className={`alert ${jumlahBentrok ? 'alert-danger' : 'alert-success'}`} role="status">
            <Icon name={jumlahBentrok ? 'alert' : 'checkCircle'} size={18} />
            <div>
              {jumlahBentrok
                ? <><strong>{jumlahBentrok} jadwal bentrok</strong> dan tidak dipilih. Ubah pengaturan atau simpan sisanya.</>
                : <><strong>Tidak ada bentrok.</strong> {preview.length} pertemuan siap disimpan.</>}
              <p className="alert-meta">
                {form.jam_mulai}–{form.jam_selesai} · {form.ruang || 'tanpa ruang'} · {namaPengajar}
              </p>
            </div>
          </div>
          <ul className="preview-list">
            {preview.map((r, i) => (
              <li key={r.tanggal} className={r.bentrok.length ? 'is-bentrok' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={dipilih.includes(i)}
                    disabled={r.bentrok.length > 0}
                    onChange={() => toggleBaris(i)}
                  />
                  <span className="preview-date">
                    <strong>{r.hari}, {formatTanggal(r.tanggal)}</strong>
                    <small>{r.jam_mulai}–{r.jam_selesai}</small>
                  </span>
                </label>
                {r.bentrok.length > 0 && (
                  <ul className="preview-bentrok">
                    {r.bentrok.map((b, j) => (
                      <li key={j}><span className="badge badge-danger">{JENIS_BENTROK[b.jenis]}</span> {b.pesan}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

export default GenerateJadwalModal;
