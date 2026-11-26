import Modal from '../../../components/ui/Modal.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { formatTanggal } from '../../../config/pelatihan.js';

export default function MateriMahasiswaModal({ kelas, materi = [], onClose }) {
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

  return (
    <Modal
      title={`Materi Pembelajaran: ${kelas.nama_kelas}`}
      subtitle="Unduh atau tinjau materi belajar, modul, dan bahan ajar yang telah diunggah oleh dosen pengajar."
      onClose={onClose}
      size="md"
    >
      <div style={{ display: 'grid', gap: '14px' }}>
        {materi.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--muted)', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--line)' }}>
            <Icon name="book" size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>Belum ada materi pembelajaran yang diunggah untuk kelas ini.</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Dosen pengajar akan mengunggah bahan ajar secara berkala sesuai pertemuan.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {materi.map((m) => {
              const fileUrl = `${API_BASE}/${m.file_path.replace(/\\/g, '/')}`;
              return (
                <div
                  key={m.id_materi}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'var(--brand-50, #eff6ff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--brand-800)',
                      }}
                    >
                      <Icon name="file" size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.94rem', color: 'var(--brand-900)', fontWeight: 600 }}>
                        {m.judul}
                      </h4>
                      <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                        Diunggah pada: {formatTanggal(m.tanggal_unggah)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      <Icon name="eye" size={14} /> Lihat
                    </a>
                    <a
                      href={fileUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      <Icon name="download" size={14} /> Unduh
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
