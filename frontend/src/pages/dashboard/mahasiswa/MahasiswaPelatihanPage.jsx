import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../services/api.js';
import Icon from '../../../components/ui/Icon.jsx';
import { EmptyState, PageHeader } from '../../../components/dashboard/Widgets.jsx';
import { JENIS_PELATIHAN, TIPE_KELAS, formatRupiah, formatTanggal } from '../../../config/pelatihan.js';
import DaftarPelatihanModal from './DaftarPelatihanModal.jsx';
import UploadBuktiModal from './UploadBuktiModal.jsx';

const STATUS_PENDAFTARAN_BADGE = {
  menunggu_pembayaran: { label: 'Menunggu Pembayaran', badge: 'badge-warning' },
  terverifikasi: { label: 'Terverifikasi (Aktif)', badge: 'badge-success' },
  dibatalkan: { label: 'Dibatalkan', badge: 'badge-danger' },
};

const STATUS_CICILAN_BADGE = {
  belum_terbit: { label: 'Belum Terbit', badge: 'badge-muted' },
  menunggu_pembayaran: { label: 'Menunggu Pembayaran', badge: 'badge-warning' },
  menunggu_verifikasi: { label: 'Menunggu Validasi Admin', badge: 'badge-accent' },
  lunas: { label: 'Lunas', badge: 'badge-success' },
};

function MahasiswaPelatihanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(paramTab === 'tagihan' || paramTab === 'saya' ? 'saya' : 'katalog');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'tagihan' || t === 'saya') setActiveTab('saya');
    else if (t === 'katalog') setActiveTab('katalog');
  }, [searchParams]);

  const switchTab = (tabName) => {
    setActiveTab(tabName);
    setSearchParams(tabName === 'saya' ? { tab: 'tagihan' } : {});
  };
  const [kelasTersedia, setKelasTersedia] = useState([]);
  const [pendaftaranSaya, setPendaftaranSaya] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalDaftar, setModalDaftar] = useState(null); // kelas object
  const [modalUpload, setModalUpload] = useState(null); // { tagihan, cicilan? }

  // Filter & Search katalog
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resKatalog, resSaya] = await Promise.all([
        api.get('/pelatihan'),
        api.get('/pelatihan/my-pendaftaran'),
      ]);
      setKelasTersedia(resKatalog.data.data || []);
      setPendaftaranSaya(resSaya.data.data || []);
    } catch {
      toast.error('Gagal memuat data kelas pelatihan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler setelah sukses mendaftar kelas
  const handleDaftarSuccess = () => {
    setModalDaftar(null);
    loadData();
    setActiveTab('saya');
  };

  // Handler setelah sukses mengunggah bukti pembayaran
  const handleUploadSuccess = () => {
    setModalUpload(null);
    loadData();
  };

  const filteredKatalog = kelasTersedia.filter((k) => {
    const matchSearch =
      !search ||
      k.nama_kelas.toLowerCase().includes(search.toLowerCase()) ||
      k.pengajar?.some((p) => p.toLowerCase().includes(search.toLowerCase()));
    const matchJenis = !filterJenis || k.jenis_pelatihan === filterJenis;
    return matchSearch && matchJenis;
  });

  return (
    <>
      <PageHeader
        eyebrow="Portal Peserta / Pelatihan"
        title="Kelas Pelatihan Bahasa"
        subtitle="Pilih dan ikuti kelas pelatihan intensif atau kelola pendaftaran & pembayaran Anda."
      />

      {/* Tabs Navigasi */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--line)', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => switchTab('katalog')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'katalog' ? '3px solid var(--brand-700)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'katalog' ? 'var(--brand-800)' : 'var(--muted)',
            fontWeight: activeTab === 'katalog' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon name="book" size={18} />
          <span>Katalog Kelas Tersedia</span>
          <span className="badge badge-accent" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
            {kelasTersedia.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('saya')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'saya' ? '3px solid var(--brand-700)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'saya' ? 'var(--brand-800)' : 'var(--muted)',
            fontWeight: activeTab === 'saya' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon name="wallet" size={18} />
          <span>Pendaftaran & Pembayaran Saya</span>
          {pendaftaranSaya.length > 0 && (
            <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
              {pendaftaranSaya.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          <p>Memuat data kelas pelatihan...</p>
        </div>
      ) : activeTab === 'katalog' ? (
        /* ================= TAB 1: KATALOG KELAS ================= */
        <div>
          {/* Toolbar Filter */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <input
                type="text"
                className="input input-plain"
                placeholder="Cari nama kelas atau pengajar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <select
              className="input input-plain"
              style={{ width: 'auto' }}
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
            >
              <option value="">Semua Jenis Pelatihan</option>
              <option value="toefl_preparation">TOEFL Preparation</option>
              <option value="toefl">TOEFL</option>
              <option value="ielts">IELTS</option>
              <option value="conversation">Conversation</option>
            </select>
          </div>

          {filteredKatalog.length === 0 ? (
            <EmptyState
              icon="book"
              title="Tidak ada kelas pelatihan yang cocok"
              text="Coba ubah kata kunci pencarian atau filter jenis pelatihan."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
              {filteredKatalog.map((k) => (
                <div
                  key={k.id_kelas}
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                      <span className="badge badge-accent" style={{ fontSize: '0.75rem' }}>
                        {JENIS_PELATIHAN[k.jenis_pelatihan] || k.jenis_pelatihan}
                      </span>
                      <span className="badge badge-muted" style={{ fontSize: '0.72rem' }}>
                        {TIPE_KELAS[k.tipe_kelas] || k.tipe_kelas}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-900)', margin: '4px 0 10px', fontWeight: 700 }}>
                      {k.nama_kelas}
                    </h3>

                    <div style={{ display: 'grid', gap: '6px', fontSize: '0.84rem', color: 'var(--ink-2)', marginBottom: '14px' }}>
                      <div>📅 <strong>Pertemuan:</strong> {k.jumlah_pertemuan} kali</div>
                      {k.jam_sesi && <div>⏰ <strong>Waktu Sesi:</strong> {k.jam_sesi} WIB</div>}
                      {k.pengajar?.length > 0 && <div>👨‍🏫 <strong>Dosen PJ:</strong> {k.pengajar.join(', ')}</div>}
                      <div>
                        👥 <strong>Sisa Kuota:</strong>{' '}
                        <span style={{ fontWeight: 600, color: k.sisa_kuota <= 2 ? '#b91c1c' : '#15803d' }}>
                          {k.sisa_kuota} dari {k.kuota_maks} kursi
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block' }}>Biaya Pelatihan</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--brand-800)' }}>{formatRupiah(k.tarif)}</strong>
                    </div>

                    {k.sudah_terdaftar ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: '0.82rem' }}
                        onClick={() => setActiveTab('saya')}
                      >
                        <Icon name="check" size={14} /> Terdaftar
                      </button>
                    ) : k.sisa_kuota <= 0 ? (
                      <button type="button" className="btn btn-outline" disabled style={{ fontSize: '0.82rem' }}>
                        Kuota Penuh
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.85rem' }}
                        onClick={() => setModalDaftar(k)}
                      >
                        Daftar Kelas
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= TAB 2: PENDAFTARAN & TAGIHAN SAYA ================= */
        <div>
          {pendaftaranSaya.length === 0 ? (
            <EmptyState
              icon="wallet"
              title="Belum ada pendaftaran kelas"
              text="Anda belum mendaftar di kelas pelatihan manapun. Buka tab Katalog Kelas untuk melihat kelas yang tersedia."
            />
          ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
              {pendaftaranSaya.map((item) => {
                const statusBadge = STATUS_PENDAFTARAN_BADGE[item.status_pendaftaran] || { label: item.status_pendaftaran, badge: 'badge-muted' };
                const tagihan = item.tagihan;
                const isCicilan = tagihan?.is_cicilan;
                const skema = tagihan?.skema_angsuran;

                return (
                  <div
                    key={item.id_pendaftaran}
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      border: '1px solid var(--line)',
                      padding: '20px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Header Card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="badge badge-accent" style={{ fontSize: '0.74rem' }}>
                            {JENIS_PELATIHAN[item.kelas.jenis_pelatihan] || item.kelas.jenis_pelatihan}
                          </span>
                          <span className={`badge ${statusBadge.badge}`} style={{ fontSize: '0.75rem' }}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.25rem', color: 'var(--brand-900)', margin: '2px 0 4px', fontWeight: 700 }}>
                          {item.kelas.nama_kelas}
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          Terdaftar pada: {formatTanggal(item.tanggal_daftar)} · {item.kelas.jumlah_pertemuan} Pertemuan
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>Total Tagihan</span>
                        <strong style={{ fontSize: '1.3rem', color: 'var(--brand-800)' }}>
                          {formatRupiah(tagihan?.total_tagihan || item.kelas.tarif)}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', display: 'block', marginTop: '2px' }}>
                          Skema: <strong>{isCicilan ? `Cicilan ${skema?.jumlah_cicilan}x` : 'Bayar Lunas (1x)'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Informasi Tagihan & Status Pembayaran */}
                    {tagihan && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--brand-900)' }}>
                            Kode Tagihan: <span style={{ fontFamily: 'monospace', color: 'var(--brand-700)' }}>{tagihan.kode_tagihan}</span>
                          </span>
                        </div>

                        {/* Kasus 1: Skema Cicilan */}
                        {isCicilan && skema?.cicilan ? (
                          <div style={{ display: 'grid', gap: '10px' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                              Jadwal Pembayaran Cicilan (Maksimal 3x selama masa kelas):
                            </span>

                            {skema.cicilan.map((c) => {
                              const cicilanBadge = STATUS_CICILAN_BADGE[c.status] || { label: c.status, badge: 'badge-muted' };
                              const labelTermin =
                                c.cicilan_ke === 1
                                  ? 'Termin 1 (Diawal - Pertemuan 1)'
                                  : c.cicilan_ke === 2 && skema.jumlah_cicilan === 3
                                  ? 'Termin 2 (Ditengah)'
                                  : `Termin ${c.cicilan_ke} (Diakhir)`;

                              return (
                                <div
                                  key={c.id_cicilan}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--line)',
                                    background: c.status === 'lunas' ? '#f0fdf4' : c.status === 'menunggu_verifikasi' ? '#eff6ff' : '#f8fafc',
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <strong style={{ fontSize: '0.9rem', color: 'var(--brand-900)' }}>{labelTermin}</strong>
                                      <span className={`badge ${cicilanBadge.badge}`} style={{ fontSize: '0.72rem' }}>
                                        {cicilanBadge.label}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                                      Kode: <code style={{ color: 'var(--ink-2)' }}>{c.kode_termin}</code> · Jatuh Tempo: {formatTanggal(c.jatuh_tempo)}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <strong style={{ fontSize: '1rem', color: 'var(--brand-800)' }}>
                                      {formatRupiah(c.nominal)}
                                    </strong>

                                    {c.status === 'lunas' ? (
                                      <span style={{ color: '#15803d', fontSize: '0.82rem', fontWeight: 600 }}>✓ Lunas</span>
                                    ) : c.status === 'menunggu_verifikasi' ? (
                                      <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                        onClick={() => setModalUpload({ tagihan, cicilan: c })}
                                      >
                                        <Icon name="upload" size={14} /> Ganti Bukti
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                        onClick={() => setModalUpload({ tagihan, cicilan: c })}
                                      >
                                        <Icon name="upload" size={14} /> Unggah Bukti Bayar
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* Kasus 2: Bayar Lunas */
                          <div
                            style={{
                              padding: '14px',
                              borderRadius: '8px',
                              border: '1px solid var(--line)',
                              background: tagihan.status === 'lunas' ? '#f0fdf4' : tagihan.status === 'menunggu_verifikasi' ? '#eff6ff' : '#f8fafc',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '12px',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ fontSize: '0.92rem', color: 'var(--brand-900)' }}>Pembayaran Penuh (Lunas 1x)</strong>
                                <span className={`badge ${tagihan.status === 'lunas' ? 'badge-success' : tagihan.status === 'menunggu_verifikasi' ? 'badge-accent' : 'badge-warning'}`} style={{ fontSize: '0.72rem' }}>
                                  {tagihan.status === 'lunas' ? 'Lunas' : tagihan.status === 'menunggu_verifikasi' ? 'Menunggu Validasi Admin' : 'Menunggu Pembayaran'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                                Setoran tunai / transfer bank sebelum kelas dimulai.
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <strong style={{ fontSize: '1.1rem', color: 'var(--brand-800)' }}>
                                {formatRupiah(tagihan.total_tagihan)}
                              </strong>

                              {tagihan.status === 'lunas' ? (
                                <span style={{ color: '#15803d', fontSize: '0.85rem', fontWeight: 600 }}>✓ Lunas</span>
                              ) : tagihan.status === 'menunggu_verifikasi' ? (
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                                  onClick={() => setModalUpload({ tagihan })}
                                >
                                  <Icon name="upload" size={14} /> Ganti Bukti
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                                  onClick={() => setModalUpload({ tagihan })}
                                >
                                  <Icon name="upload" size={14} /> Unggah Bukti Bayar
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Rekening Bank info */}
                        <div style={{ marginTop: '14px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span>
                            🏦 <strong>Bank Nagari</strong> · No. Rek: <code style={{ color: 'var(--brand-800)', fontWeight: 700 }}>0102.0210.01234-5</code> a.n. <strong>UPT Bahasa UNIDHA</strong>
                          </span>
                          <span style={{ color: 'var(--muted)' }}>
                            *Pembayaran diverifikasi secara manual oleh admin setelah bukti diunggah.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Pendaftaran */}
      {modalDaftar && (
        <DaftarPelatihanModal
          kelas={modalDaftar}
          onClose={() => setModalDaftar(null)}
          onSuccess={handleDaftarSuccess}
        />
      )}

      {/* Modal Upload Bukti */}
      {modalUpload && (
        <UploadBuktiModal
          tagihan={modalUpload.tagihan}
          cicilan={modalUpload.cicilan}
          onClose={() => setModalUpload(null)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </>
  );
}

export default MahasiswaPelatihanPage;
