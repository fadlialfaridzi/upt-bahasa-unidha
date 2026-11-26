import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Modal from '../../../components/ui/Modal.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import QRCodeView from '../../../components/ui/QRCodeView.jsx';
import { formatTanggal, STATUS_PRESENSI, STATUS_WAKTU } from '../../../config/pelatihan.js';

export default function KelolaPertemuanModal({ kelas, onClose, onUpdated }) {
  const [activeTab, setActiveTab] = useState('pertemuan'); // 'pertemuan' | 'materi'
  const [loading, setLoading] = useState(true);
  const [dataKelas, setDataKelas] = useState(null);
  const [selectedPertemuanId, setSelectedPertemuanId] = useState(null);

  // State untuk materi
  const [judulMateri, setJudulMateri] = useState('');
  const [fileMateri, setFileMateri] = useState(null);
  const [uploadingMateri, setUploadingMateri] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/dosen/kelas/${kelas.id_kelas}/pertemuan`);
      const payload = res.data.data;
      setDataKelas(payload);

      // Default pilih pertemuan yang belum selesai atau pertemuan pertama
      if (!selectedPertemuanId && payload.pertemuan?.length > 0) {
        const nextP = payload.pertemuan.find((p) => p.status_pertemuan !== 'selesai') || payload.pertemuan[0];
        setSelectedPertemuanId(nextP.id_pertemuan);
      }
    } catch {
      toast.error('Gagal memuat detail pertemuan kelas');
    } finally {
      setLoading(false);
    }
  }, [kelas.id_kelas, selectedPertemuanId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const pertemuanList = dataKelas?.pertemuan || [];
  const currentIndex = pertemuanList.findIndex((p) => p.id_pertemuan === selectedPertemuanId);
  const selectedPertemuan = pertemuanList[currentIndex] || pertemuanList[0];

  // Handler Buka Presensi
  const handleBukaPresensi = async () => {
    if (!selectedPertemuan) return;
    setActionBusy(true);
    try {
      const res = await api.post(`/dosen/pertemuan/${selectedPertemuan.id_pertemuan}/buka-presensi`);
      toast.success(res.data.message || 'Sesi presensi QR berhasil dibuka!');
      await fetchDetail();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuka sesi presensi');
    } finally {
      setActionBusy(false);
    }
  };

  // Handler Tutup Presensi
  const handleTutupPresensi = async () => {
    if (!selectedPertemuan) return;
    setActionBusy(true);
    try {
      const res = await api.post(`/dosen/pertemuan/${selectedPertemuan.id_pertemuan}/tutup-presensi`);
      toast.success(res.data.message || 'Sesi presensi berhasil ditutup');
      await fetchDetail();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menutup sesi presensi');
    } finally {
      setActionBusy(false);
    }
  };

  // Handler Manual Presensi
  const handleManualPresensi = async (idPendaftaran, newStatus) => {
    if (!selectedPertemuan) return;
    setActionBusy(true);
    try {
      await api.post(`/dosen/pertemuan/${selectedPertemuan.id_pertemuan}/manual-presensi`, {
        id_pendaftaran: idPendaftaran,
        status: newStatus,
      });
      toast.success('Status presensi peserta diperbarui');
      await fetchDetail();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah presensi');
    } finally {
      setActionBusy(false);
    }
  };

  // Handler Upload Materi
  const handleUploadMateri = async (e) => {
    e.preventDefault();
    if (!judulMateri.trim()) {
      toast.warning('Silakan masukkan judul materi');
      return;
    }
    if (!fileMateri) {
      toast.warning('Silakan pilih file materi yang akan diunggah');
      return;
    }

    setUploadingMateri(true);
    try {
      const formData = new FormData();
      formData.append('judul', judulMateri);
      formData.append('file', fileMateri);

      await api.post(`/dosen/kelas/${kelas.id_kelas}/materi`, formData, {
        headers: { 'Content-Transfer-Encoding': 'multipart/form-data' },
      });
      toast.success('Materi berhasil diunggah!');
      setJudulMateri('');
      setFileMateri(null);
      const fileInput = document.getElementById('input-file-materi');
      if (fileInput) fileInput.value = '';
      await fetchDetail();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah materi');
    } finally {
      setUploadingMateri(false);
    }
  };

  // Handler Hapus Materi
  const handleDeleteMateri = async (idMateri, judul) => {
    if (!window.confirm(`Yakin ingin menghapus materi "${judul}"?`)) return;
    setActionBusy(true);
    try {
      await api.delete(`/dosen/materi/${idMateri}`);
      toast.success('Materi berhasil dihapus');
      await fetchDetail();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus materi');
    } finally {
      setActionBusy(false);
    }
  };

  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

  return (
    <Modal
      title={kelas.nama_kelas}
      subtitle="Kelola Pertemuan, Sesi Presensi QR, dan Dokumen Materi Pembelajaran"
      onClose={onClose}
      size="lg"
    >
      <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Sub Tabs Sederhana */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '2px solid var(--line)',
            marginBottom: '18px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('pertemuan')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'pertemuan' ? '3px solid var(--brand-700)' : '3px solid transparent',
              background: 'none',
              color: activeTab === 'pertemuan' ? 'var(--brand-800)' : 'var(--muted)',
              fontWeight: activeTab === 'pertemuan' ? 700 : 500,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="qr" size={17} />
            <span>Presensi & Pertemuan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('materi')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'materi' ? '3px solid var(--brand-700)' : '3px solid transparent',
              background: 'none',
              color: activeTab === 'materi' ? 'var(--brand-800)' : 'var(--muted)',
              fontWeight: activeTab === 'materi' ? 700 : 500,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="book" size={17} />
            <span>Materi Kelas ({dataKelas?.materi?.length || 0})</span>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
            <p>Memuat data kelas...</p>
          </div>
        ) : activeTab === 'pertemuan' ? (
          /* ================= TAB 1: PERTEMUAN & PRESENSI QR ================= */
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Pilihan Pertemuan Responsif (Dropdown + Tombol Navigasi) */}
            <div
              style={{
                background: '#f8fafc',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-900)', whiteSpace: 'nowrap' }}>
                Pilih Pertemuan:
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 240px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '6px 10px' }}
                  disabled={currentIndex <= 0}
                  onClick={() => setSelectedPertemuanId(pertemuanList[currentIndex - 1]?.id_pertemuan)}
                  title="Pertemuan Sebelumnya"
                >
                  <Icon name="arrowLeft" size={14} />
                </button>

                <select
                  className="input input-plain"
                  style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem' }}
                  value={selectedPertemuanId || ''}
                  onChange={(e) => setSelectedPertemuanId(Number(e.target.value))}
                >
                  {pertemuanList.map((p) => {
                    const isAktif = p.status_presensi === 'dibuka';
                    return (
                      <option key={p.id_pertemuan} value={p.id_pertemuan}>
                        Pertemuan {p.pertemuan_ke} ({p.hari}, {formatTanggal(p.tanggal)}) {isAktif ? '🟢 [Presensi Aktif]' : ''}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '6px 10px' }}
                  disabled={currentIndex >= pertemuanList.length - 1}
                  onClick={() => setSelectedPertemuanId(pertemuanList[currentIndex + 1]?.id_pertemuan)}
                  title="Pertemuan Berikutnya"
                >
                  <Icon name="arrowRight" size={14} />
                </button>
              </div>
            </div>

            {selectedPertemuan && (
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Rincian Singkat Pertemuan */}
                <div
                  style={{
                    background: '#fff',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--brand-900)' }}>
                        Pertemuan Ke-{selectedPertemuan.pertemuan_ke}
                      </strong>
                      <span className={`badge ${STATUS_WAKTU[selectedPertemuan.status_pertemuan]?.badge || 'badge-muted'}`}>
                        {STATUS_WAKTU[selectedPertemuan.status_pertemuan]?.label || selectedPertemuan.status_pertemuan}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>
                      📅 {selectedPertemuan.hari}, {formatTanggal(selectedPertemuan.tanggal)} · ⏰ {selectedPertemuan.jam_mulai}–{selectedPertemuan.jam_selesai} WIB
                      {selectedPertemuan.ruang && <span> · 📍 {selectedPertemuan.ruang}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Status Presensi:</span>
                    <span className={`badge ${STATUS_PRESENSI[selectedPertemuan.status_presensi]?.badge || 'badge-muted'}`}>
                      {STATUS_PRESENSI[selectedPertemuan.status_presensi]?.label || 'Belum Dibuka'}
                    </span>
                  </div>
                </div>

                {/* Sesi Presensi QR: Tampilan Bersih & Terpusat */}
                <div
                  style={{
                    background: selectedPertemuan.status_presensi === 'dibuka' ? '#f0fdf4' : '#f8fafc',
                    padding: '20px',
                    borderRadius: '12px',
                    border: selectedPertemuan.status_presensi === 'dibuka' ? '2px solid #86efac' : '1px solid var(--line)',
                    textAlign: 'center',
                  }}
                >
                  {selectedPertemuan.status_presensi === 'dibuka' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                        <strong style={{ color: '#15803d', fontSize: '0.95rem' }}>
                          Sesi Presensi QR Sedang DIBUKA
                        </strong>
                      </div>

                      {/* Komponen QR Code interaktif dengan Fullscreen */}
                      <QRCodeView
                        token={selectedPertemuan.token_qr}
                        title={`Pertemuan ${selectedPertemuan.pertemuan_ke} · ${kelas.nama_kelas}`}
                        size={170}
                      />

                      <div style={{ marginTop: '4px', width: '100%', maxWidth: '320px' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ width: '100%', borderColor: '#ef4444', color: '#dc2626', fontWeight: 600 }}
                          onClick={handleTutupPresensi}
                          disabled={actionBusy}
                        >
                          <Icon name="x" size={16} /> Tutup Sesi Presensi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '10px 0', maxWidth: '440px', margin: '0 auto' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: 'var(--brand-50, #f0fdf4)',
                          color: 'var(--brand-800)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 10px',
                        }}
                      >
                        <Icon name="qr" size={24} />
                      </div>
                      <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--brand-900)' }}>
                        {selectedPertemuan.status_presensi === 'ditutup' ? 'Sesi Presensi Ditutup' : 'Presensi Belum Dibuka'}
                      </h4>
                      <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Buka sesi presensi untuk menampilkan QR Code dan Token PIN yang dapat dipindai oleh peserta dari kamera handphone.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 600 }}
                        onClick={handleBukaPresensi}
                        disabled={actionBusy}
                      >
                        <Icon name="qr" size={18} />
                        <span>{selectedPertemuan.token_qr ? 'Buka Kembali Presensi QR' : 'Buka Presensi QR Sekarang'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Rekap Daftar Hadir Peserta */}
                <div
                  style={{
                    background: '#fff',
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--brand-900)' }}>
                      Daftar Kehadiran Peserta
                    </h4>
                    <span className="badge badge-accent" style={{ fontSize: '0.78rem' }}>
                      {selectedPertemuan.hadir_count} / {dataKelas?.peserta_terverifikasi?.length || 0} Hadir
                    </span>
                  </div>

                  {dataKelas?.peserta_terverifikasi?.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--muted)', textAlign: 'center', padding: '18px 0' }}>
                      Belum ada peserta terverifikasi di kelas ini.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                      {dataKelas?.peserta_terverifikasi?.map((p) => {
                        const presensiRecord = selectedPertemuan.presensi?.find((pr) => pr.id_pendaftaran === p.id_pendaftaran);
                        const currentStatus = presensiRecord?.status || 'alpha';

                        return (
                          <div
                            key={p.id_pendaftaran}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: currentStatus === 'hadir' ? '#f0fdf4' : currentStatus === 'izin' ? '#eff6ff' : '#fef2f2',
                              border: '1px solid var(--line)',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--brand-900)' }}>
                                {p.nama}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                                {p.nim || p.email}
                                {presensiRecord?.waktu_scan && (
                                  <span style={{ marginLeft: 6 }}>
                                    · {new Date(presensiRecord.waktu_scan).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Tombol Toggle Presensi Manual */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleManualPresensi(p.id_pendaftaran, 'hadir')}
                                disabled={actionBusy}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.72rem',
                                  borderRadius: '4px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: currentStatus === 'hadir' ? '#16a34a' : '#e2e8f0',
                                  color: currentStatus === 'hadir' ? '#fff' : '#475569',
                                  fontWeight: currentStatus === 'hadir' ? 700 : 500,
                                }}
                              >
                                Hadir
                              </button>
                              <button
                                type="button"
                                onClick={() => handleManualPresensi(p.id_pendaftaran, 'izin')}
                                disabled={actionBusy}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.72rem',
                                  borderRadius: '4px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: currentStatus === 'izin' ? '#2563eb' : '#e2e8f0',
                                  color: currentStatus === 'izin' ? '#fff' : '#475569',
                                  fontWeight: currentStatus === 'izin' ? 700 : 500,
                                }}
                              >
                                Izin
                              </button>
                              <button
                                type="button"
                                onClick={() => handleManualPresensi(p.id_pendaftaran, 'alpha')}
                                disabled={actionBusy}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.72rem',
                                  borderRadius: '4px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: currentStatus === 'alpha' ? '#dc2626' : '#e2e8f0',
                                  color: currentStatus === 'alpha' ? '#fff' : '#475569',
                                  fontWeight: currentStatus === 'alpha' ? 700 : 500,
                                }}
                              >
                                Alpha
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= TAB 2: MATERI PEMBELAJARAN ================= */
          <div style={{ display: 'grid', gap: '18px' }}>
            {/* Form Unggah Materi */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.94rem', color: 'var(--brand-900)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="upload" size={17} /> Unggah Materi Baru
              </h4>

              <form onSubmit={handleUploadMateri} style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Judul Materi:
                  </label>
                  <input
                    type="text"
                    className="input input-plain"
                    placeholder="Contoh: Modul 1 - Listening Practice"
                    value={judulMateri}
                    onChange={(e) => setJudulMateri(e.target.value)}
                    style={{ width: '100%', fontSize: '0.86rem' }}
                    disabled={uploadingMateri}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Pilih File (PDF, PPT, Word, Excel, ZIP, Gambar, Media s.d 25MB):
                  </label>
                  <input
                    id="input-file-materi"
                    type="file"
                    className="input input-plain"
                    onChange={(e) => setFileMateri(e.target.files?.[0] || null)}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                    disabled={uploadingMateri}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={uploadingMateri}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Icon name="upload" size={15} />
                    <span>{uploadingMateri ? 'Mengunggah...' : 'Unggah Materi'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* List Materi */}
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', color: 'var(--brand-900)' }}>
                Daftar Dokumen Materi ({dataKelas?.materi?.length || 0})
              </h4>

              {dataKelas?.materi?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', background: '#fff', borderRadius: '8px', border: '1px dashed var(--line)' }}>
                  Belum ada dokumen materi yang diunggah.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {dataKelas?.materi?.map((m) => {
                    const fileUrl = `${API_BASE}/${m.file_path.replace(/\\/g, '/')}`;
                    return (
                      <div
                        key={m.id_materi}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: '#fff',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Icon name="file" size={18} style={{ color: 'var(--brand-800)' }} />
                          <div>
                            <h5 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--brand-900)' }}>{m.judul}</h5>
                            <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                              {formatTanggal(m.tanggal_unggah)}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <Icon name="download" size={13} /> Unduh
                          </a>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ borderColor: '#ef4444', color: '#dc2626', padding: '4px 8px' }}
                            onClick={() => handleDeleteMateri(m.id_materi, m.judul)}
                            disabled={actionBusy}
                            title="Hapus Materi"
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
