import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';

const STATUS = {
  terbuka: { label: 'Dibuka', badge: 'badge-success' },
  ujian_dibuka: { label: 'Ujian dibuka', badge: 'badge-accent' },
  dijadwalkan: { label: 'Terjadwal', badge: 'badge-success' },
  selesai: { label: 'Selesai', badge: 'badge-muted' },
  dibatalkan: { label: 'Batal', badge: 'badge-danger' },
};

const tanggal = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Belum ditentukan';

function ToeflKuotaPage() {
  const [list, setList] = useState([]);
  const [ringkasan, setRingkasan] = useState({ total_sesi: 0, total_terverifikasi: 0, kapasitas: 0, sesi_aktif: 0 });
  const [filter, setFilter] = useState({ q: '', status: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendaftar, setPendaftar] = useState([]);
  const [loadingPendaftar, setLoadingPendaftar] = useState(false);
  const [alasanPerubahan, setAlasanPerubahan] = useState('');
  const [form, setForm] = useState({ kuota_min: 10, kuota_maks: 24, batas_pendaftaran: '', status: 'terbuka' });

  const load = useCallback(async () => {
    setLoading(true);
    setGagal(false);
    try {
      const res = await api.get('/toefl/kuota', { params: { q: filter.q.trim() || undefined, status: filter.status || undefined } });
      setList(res.data.data);
      setRingkasan(res.data.ringkasan);
    } catch {
      setGagal(true);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(load, filter.q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, filter.q]);

  const selected = useMemo(() => list.find((item) => item.id_sesi === selectedId) || list[0] || null, [list, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id_sesi);
    setForm({
      kuota_min: selected.kuota_min,
      kuota_maks: selected.kuota_maks,
      batas_pendaftaran: selected.batas_pendaftaran ? new Date(selected.batas_pendaftaran).toISOString().slice(0, 16) : '',
      status: selected.status,
    });
    setAlasanPerubahan('');
  }, [selected]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoadingPendaftar(true);
    api.get(`/toefl/sesi/${selectedId}/pendaftar`)
      .then((res) => {
        if (active) setPendaftar(res.data.data);
      })
      .catch(() => {
        if (active) setPendaftar([]);
      })
      .finally(() => {
        if (active) setLoadingPendaftar(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const updateSelected = (event) => {
    const { name, value } = event.target;
    setForm((old) => ({ ...old, [name]: value }));
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.put(`/toefl/sesi/${selected.id_sesi}/kuota`, {
        ...form,
        kuota_min: Number(form.kuota_min),
        kuota_maks: Number(form.kuota_maks),
        alasan_perubahan: alasanPerubahan.trim(),
      });
      toast.success(res.data.message);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kuota');
    } finally {
      setSaving(false);
    }
  };

  const handleRilis = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.post(`/toefl/sesi/${selected.id_sesi}/rilis`);
      toast.success(res.data.message);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal merilis jadwal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="TOEFL / Administrasi ujian"
        title="Kelola Kuota Pendaftar TOEFL"
        subtitle="Atur kuota sesi dan pantau pendaftar terverifikasi untuk rilis jadwal."
      />

      {selected && selected.jumlah_tersisa === 0 && (
        <div className="notice notice-warning">
          <Icon name="alert" size={18} />
          <p><strong>{selected.nama_sesi} telah mencapai kuota maksimum.</strong> Pendaftaran tambahan tidak diterima sampai kuota disesuaikan.</p>
        </div>
      )}

      <div className="summary-row">
        <div className="summary-item"><strong>{ringkasan.total_sesi}</strong><span>Total kuota</span></div>
        <div className="summary-item"><strong>{ringkasan.total_terverifikasi}</strong><span>Pendaftar terverifikasi</span></div>
        <div className="summary-item"><strong>{ringkasan.kapasitas}</strong><span>Kapasitas maksimum</span></div>
        <div className="summary-item"><strong>{ringkasan.sesi_aktif}</strong><span>Pendaftaran dibuka</span></div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Kuota per sesi ujian</h2>
            <p className="panel-sub">Pilih satu sesi untuk mengubah kuota dan jadwal pendaftaran.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="toolbar">
            <div className="input-wrap toolbar-search">
              <Icon name="search" size={18} className="input-icon" />
              <input className="input" placeholder="Cari nama atau ruang sesi ujian" value={filter.q} onChange={(event) => setFilter((old) => ({ ...old, q: event.target.value }))} />
            </div>
            <select className="input input-plain select" value={filter.status} onChange={(event) => setFilter((old) => ({ ...old, status: event.target.value }))}>
              <option value="">Semua status</option>
              {Object.entries(STATUS).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}
            </select>
          </div>

          {loading ? <p className="table-message">Memuat kuota TOEFL...</p> : gagal ? (
            <div className="table-message"><p>Gagal memuat data kuota.</p><button type="button" className="btn btn-soft btn-sm" onClick={load}>Coba lagi</button></div>
          ) : list.length === 0 ? (
            <EmptyState icon="graduation" title="Belum ada sesi" text="Tambahkan sesi TOEFL terlebih dahulu." />
          ) : (
            <div className="table-wrap">
              <table className="table kuota-table">
                <thead><tr><th>Sesi ujian</th><th>Kuota & minimum</th><th>Pendaftar</th><th>Batas daftar</th><th>Status</th><th className="actions">Aksi</th></tr></thead>
                <tbody>
                  {list.map((item) => {
                    const persen = Math.min(100, Math.round((item.jumlah_terverifikasi / item.kuota_maks) * 100));
                    const status = STATUS[item.status] || STATUS.terbuka;
                    return (
                      <tr key={item.id_sesi} className={selected?.id_sesi === item.id_sesi ? 'row-selected' : ''} onClick={() => setSelectedId(item.id_sesi)}>
                        <td><p className="cell-title">{item.nama_sesi}</p><p className="cell-sub">{tanggal(item.tanggal)} · {item.ruang || 'Lokasi belum ditentukan'}</p></td>
                        <td><p><strong>{item.kuota_maks}</strong> peserta</p><p className="cell-sub">Minimum {item.kuota_min}</p></td>
                        <td><p><strong>{item.jumlah_terverifikasi}</strong> terverifikasi</p><div className="progress"><span style={{ width: `${persen}%` }} /></div><p className="cell-sub">{item.jumlah_menunggu} menunggu bayar</p></td>
                        <td className="nowrap">{tanggal(item.batas_pendaftaran)}</td>
                        <td><span className={`badge ${status.badge}`}>{status.label}</span></td>
                        <td className="actions"><button type="button" className="icon-action" onClick={() => setSelectedId(item.id_sesi)} aria-label={`Pilih ${item.nama_sesi}`}><Icon name="pencil" size={17} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {selected && (
        <>
          <form className="kuota-layout" onSubmit={handleSave}>
            <section className="panel kuota-editor">
            <header className="panel-head">
              <div className="panel-title-wrap">
                <div><h2 className="panel-title">Atur kuota sesi utama</h2><p className="panel-sub">{selected.nama_sesi}</p></div>
              </div>
              <span className={`badge ${(STATUS[selected.status] || STATUS.terbuka).badge}`}>{(STATUS[selected.status] || STATUS.terbuka).label}</span>
            </header>
            <div className="panel-body">
              <div className="form-grid kuota-form-grid">
                <div className="field"><span className="field-label">Kuota maksimum</span><input className="input input-plain" type="number" min="1" max="24" name="kuota_maks" value={form.kuota_maks} onChange={updateSelected} /></div>
                <div className="field"><span className="field-label">Kuota minimum</span><input className="input input-plain" type="number" min="1" max="24" name="kuota_min" value={form.kuota_min} onChange={updateSelected} /></div>
                <div className="field field-span-2"><span className="field-label">Batas pendaftaran</span><input className="input input-plain" type="datetime-local" name="batas_pendaftaran" value={form.batas_pendaftaran} onChange={updateSelected} /></div>
                <div className="field field-full"><span className="field-label">Status pendaftaran</span><select className="input input-plain select" name="status" value={form.status} onChange={updateSelected}><option value="terbuka">Dibuka</option><option value="ujian_dibuka">Ujian dibuka</option><option value="dijadwalkan">Terjadwal</option><option value="selesai">Selesai</option><option value="dibatalkan">Dibatalkan</option></select></div>
                <div className="field field-full"><span className="field-label">Alasan perubahan kuota</span><textarea className="input input-plain" rows="3" value={alasanPerubahan} onChange={(event) => setAlasanPerubahan(event.target.value)} placeholder="Contoh: Penyesuaian kapasitas ruang ujian" /></div>
              </div>
              <div className="kuota-actions">
                {selected.status !== 'dijadwalkan' && selected.status !== 'selesai' && selected.status !== 'dibatalkan' && (
                  <button type="button" className="btn btn-soft" onClick={handleRilis} disabled={saving}>Rilis jadwal</button>
                )}
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan perubahan'}</button>
              </div>
            </div>
          </section>

            <aside className="kuota-side">
            <section className="panel">
              <header className="panel-head"><h2 className="panel-title">Ketentuan pengelolaan</h2></header>
              <div className="panel-body rule-list">
                <p><strong>01</strong> Kuota maksimum ruang 22-24 peserta.</p>
                <p><strong>02</strong> Kuota minimum standar 8-10 peserta.</p>
                <p><strong>03</strong> Jadwal dirilis ketika kuota terverifikasi terpenuhi.</p>
              </div>
            </section>
            </aside>
          </form>

          <section className="panel kuota-pendaftar-panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Daftar pendaftar sesi</h2>
                <p className="panel-sub">{selected.jumlah_terverifikasi} terverifikasi · {selected.jumlah_menunggu} menunggu pembayaran · {selected.jumlah_tersisa} kuota tersisa</p>
              </div>
              <span className="badge badge-muted">{selected.jumlah_pendaftar} total</span>
            </header>
            <div className="panel-body">
              {loadingPendaftar ? (
                <p className="table-message">Memuat daftar pendaftar...</p>
              ) : pendaftar.length === 0 ? (
                <EmptyState icon="users" title="Belum ada pendaftar" text="Peserta yang mendaftar pada sesi ini akan tampil di sini." />
              ) : (
                <div className="table-wrap table-wrap-kuota-pendaftar">
                  <table className="table">
                    <thead><tr><th>Peserta</th><th>NIM / Prodi</th><th>Status pembayaran</th><th>Tanggal daftar</th></tr></thead>
                    <tbody>
                      {pendaftar.map((item) => (
                        <tr key={item.id_pendaftaran}>
                          <td><p className="cell-title">{item.pengguna.nama_lengkap}</p><p className="cell-sub">{item.pengguna.email}</p></td>
                          <td><p>{item.pengguna.nim || '-'}</p><p className="cell-sub">{item.pengguna.program_studi || '-'}</p></td>
                          <td><span className={`badge ${item.status === 'terverifikasi' ? 'badge-success' : item.status === 'dibatalkan' ? 'badge-danger' : 'badge-warning'}`}>{item.status === 'terverifikasi' ? 'Terverifikasi' : item.status === 'dibatalkan' ? 'Dibatalkan' : 'Menunggu pembayaran'}</span></td>
                          <td className="nowrap">{tanggal(item.tanggal_daftar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

    </>
  );
}

export default ToeflKuotaPage;
