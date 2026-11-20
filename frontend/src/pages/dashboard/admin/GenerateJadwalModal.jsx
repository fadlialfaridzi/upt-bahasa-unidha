import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import {
  ATURAN_TIPE_KELAS,
  HARI,
  JENIS_BENTROK,
  PRESET_POLA_HARI,
  PRESET_SESI,
  formatTanggal,
  toDateInput,
  todayInput,
} from '../../../config/pelatihan.js';
import PengajarSelect from './PengajarSelect.jsx';

// Dua langkah: (1) atur pola jadwal & dosen PJ -> (2) pratinjau conflict checker -> simpan.
function GenerateJadwalModal({ kelas, sisa, onClose, onSaved }) {
  // Preset default sesuai aturan UPT Bahasa:
  // Kelas 1 = Senin, Rabu, Jumat (1, 3, 5); Sesi 1 = 09.00 - 11.00
  const [presetPola, setPresetPola] = useState('kelas_1'); // 'kelas_1' | 'kelas_2' | 'custom'
  const [presetSesi, setPresetSesi] = useState('sesi_1'); // 'sesi_1' | 'sesi_2' | 'custom'

  const [form, setForm] = useState({
    tanggal_mulai: toDateInput(kelas.tanggal_mulai) || todayInput(),
    hari: [1, 3, 5],
    jam_mulai: '09:00',
    jam_selesai: '11:00',
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
          hari: [...form.hari].sort((a, b) => a - b),
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
    const val = e.target.value;
    setForm((f) => ({ ...f, [name]: val }));
    setErrors((er) => ({ ...er, [name]: undefined }));

    if (name === 'jam_mulai' || name === 'jam_selesai') {
      const jMulai = name === 'jam_mulai' ? val : form.jam_mulai;
      const jSelesai = name === 'jam_selesai' ? val : form.jam_selesai;
      if (jMulai === '09:00' && jSelesai === '11:00') setPresetSesi('sesi_1');
      else if (jMulai === '13:30' && jSelesai === '15:30') setPresetSesi('sesi_2');
      else setPresetSesi('custom');
    }
  };

  // Handler preset pola hari
  const pilihPresetPola = (polaId) => {
    setPresetPola(polaId);
    const target = PRESET_POLA_HARI.find((p) => p.id === polaId);
    if (target) {
      setForm((f) => ({ ...f, hari: [...target.hari] }));
      setErrors((er) => ({ ...er, hari: undefined }));
    }
  };

  // Handler preset sesi jam
  const pilihPresetSesi = (sesiId) => {
    setPresetSesi(sesiId);
    const target = PRESET_SESI.find((s) => s.id === sesiId);
    if (target) {
      setForm((f) => ({ ...f, jam_mulai: target.jam_mulai, jam_selesai: target.jam_selesai }));
      setErrors((er) => ({ ...er, jam: undefined }));
    }
  };

  // Reguler: 2–3 hari per minggu; intensif: bebas
  const aturan = ATURAN_TIPE_KELAS[kelas.tipe_kelas] ?? ATURAN_TIPE_KELAS.intensif;
  const maksHari = aturan.maxPertemuanPerMinggu ?? 7;

  const toggleHari = (h) => {
    setForm((f) => {
      let baru = f.hari.includes(h) ? f.hari.filter((x) => x !== h) : f.hari.length >= maksHari ? f.hari : [...f.hari, h];
      baru.sort((a, b) => a - b);
      const str = baru.join(',');
      if (str === '1,3,5') setPresetPola('kelas_1');
      else if (str === '2,4,6') setPresetPola('kelas_2');
      else setPresetPola('custom');
      return { ...f, hari: baru };
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
    if (!form.id_pengajar) e.id_pengajar = 'Pilih Dosen Penanggung Jawab (PJ)';
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
    // Mode Strict: tidak boleh ada baris bentrok
    if (jumlahBentrok > 0 || adaBentrokDipilih) {
      toast.error('Mode Strict Aktif: Tidak dapat menyimpan jadwal karena terdapat bentrok!');
      return;
    }
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
      title="Penyusunan Jadwal & Plotting Dosen PJ"
      subtitle={`${kelas.nama_kelas} · target ${sisa} pertemuan`}
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        preview ? (
          <>
            <button type="button" className="btn btn-outline" onClick={() => setPreview(null)} disabled={busy}>
              <Icon name="arrowLeft" size={16} /> Ubah pengaturan
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={busy || !dipilih.length || adaBentrokDipilih || jumlahBentrok > 0}
            >
              {busy ? 'Menyimpan...' : `Simpan ${dipilih.length} pertemuan`}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button>
            <button type="submit" form="generate-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Memeriksa ketersediaan...' : 'Lihat Pratinjau Jadwal'} {!busy && <Icon name="arrowRight" size={16} />}
            </button>
          </>
        )
      }
    >
      {!preview ? (
        <form id="generate-form" className="form-grid" onSubmit={handlePreview} noValidate>
          {/* Preset Pola Hari */}
          <div className="field field-full">
            <span className="field-label">Pola Hari Pelatihan</span>
            <div className="preset-group" role="group" aria-label="Pilihan Pola Hari">
              {PRESET_POLA_HARI.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-btn ${presetPola === p.id ? 'active' : ''}`}
                  onClick={() => pilihPresetPola(p.id)}
                >
                  <Icon name="calendar" size={15} /> {p.label}
                </button>
              ))}
              <button
                type="button"
                className={`preset-btn ${presetPola === 'custom' ? 'active' : ''}`}
                onClick={() => setPresetPola('custom')}
              >
                Kustom (Pilih Hari Manual)
              </button>
            </div>

            {/* Day chip picker */}
            <div className="day-picker" role="group" aria-label="Hari pertemuan" style={{ marginTop: '8px' }}>
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

          {/* Preset Sesi Jam */}
          <div className="field field-full">
            <span className="field-label">Pilihan Sesi Pelatihan</span>
            <div className="preset-group" role="group" aria-label="Pilihan Sesi">
              {PRESET_SESI.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`preset-btn ${presetSesi === s.id ? 'active' : ''}`}
                  onClick={() => pilihPresetSesi(s.id)}
                >
                  <Icon name="clock" size={15} /> {s.label}
                </button>
              ))}
              <button
                type="button"
                className={`preset-btn ${presetSesi === 'custom' ? 'active' : ''}`}
                onClick={() => setPresetSesi('custom')}
              >
                Kustom (Jam Manual)
              </button>
            </div>
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

          {/* Dosen Penanggung Jawab (PJ) */}
          <div className="field field-full" style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)' }}>
            <span className="field-label" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-800)' }}>
              Dosen Penanggung Jawab (PJ) Kelas
            </span>
            <p className="field-hint" style={{ marginTop: '2px', marginBottom: '8px' }}>
              Dosen terpilih otomatis ditugaskan ke seluruh {form.jumlah || sisa} pertemuan kelas ini. Conflict checker otomatis memblokir (strict) dosen yang memiliki jadwal bentrok.
            </p>
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
            {errors.jumlah ? <span className="field-error">{errors.jumlah}</span> : <span className="field-hint">Maksimal {sisa} pertemuan</span>}
          </div>

          <div className="field">
            <span className="field-label">Ruang kelas</span>
            <input className="input input-plain" value={form.ruang} onChange={set('ruang')} placeholder="Contoh: Lab Bahasa 1 (opsional)" maxLength={50} />
          </div>
        </form>
      ) : (
        <>
          <div className={`alert ${jumlahBentrok ? 'alert-danger' : 'alert-success'}`} role="status">
            <Icon name={jumlahBentrok ? 'alert' : 'checkCircle'} size={18} />
            <div>
              {jumlahBentrok ? (
                <>
                  <strong>{jumlahBentrok} jadwal bentrok terdeteksi!</strong>
                  <p style={{ marginTop: '4px' }}>
                    Sesuai konfigurasi <strong>Strict Mode</strong>, jadwal yang bentrok diblokir dan tidak dapat disimpan. Silakan klik tombol &quot;Ubah pengaturan&quot; untuk memilih Dosen PJ atau waktu lain.
                  </p>
                </>
              ) : (
                <>
                  <strong>Bebas Bentrok!</strong> {preview.length} pertemuan siap disimpan dengan Dosen PJ: <strong>{namaPengajar}</strong>.
                </>
              )}
              <p className="alert-meta" style={{ marginTop: '6px' }}>
                Waktu: {form.jam_mulai}–{form.jam_selesai} · Ruang: {form.ruang || 'Belum ditentukan'} · Pengajar: {namaPengajar}
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
