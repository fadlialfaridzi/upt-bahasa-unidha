import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';

function TerjemahanPage() {
  const [form, setForm] = useState({ judulDokumen: '', bahasaAsal: '', bahasaTujuan: '', catatan: '' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (file) formData.append('dokumen', file);

      await api.post('/terjemahan/ajukan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Pengajuan terjemahan berhasil! Tim kami akan menghubungi Anda.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan terjemahan');
    } finally {
      setLoading(false);
    }
  };

  const bahasaOptions = ['Indonesia', 'Inggris', 'Arab', 'Mandarin', 'Jepang', 'Prancis', 'Jerman'];

  return (
    <div style={{ maxWidth: '700px', margin: '3rem auto', padding: '0 2rem' }}>
      <h1 style={{ color: '#1e3a5f', marginBottom: '0.5rem' }}>Jasa Penerjemahan Dokumen</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>Ajukan dokumen Anda untuk diterjemahkan oleh penerjemah tersertifikasi kami.</p>

      <div style={{ background: 'white', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Judul / Nama Dokumen *</label>
            <input
              type="text" name="judulDokumen" value={form.judulDokumen} onChange={handleChange} required
              placeholder="contoh: Ijazah S1, Transkrip Nilai"
              style={{ width: '100%', padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Bahasa Asal *</label>
              <select name="bahasaAsal" value={form.bahasaAsal} onChange={handleChange} required
                style={{ width: '100%', padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem' }}>
                <option value="">Pilih bahasa</option>
                {bahasaOptions.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Bahasa Tujuan *</label>
              <select name="bahasaTujuan" value={form.bahasaTujuan} onChange={handleChange} required
                style={{ width: '100%', padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem' }}>
                <option value="">Pilih bahasa</option>
                {bahasaOptions.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Upload Dokumen (PDF/Word, maks 10MB)</label>
            <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files[0])}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Catatan Tambahan</label>
            <textarea name="catatan" value={form.catatan} onChange={handleChange} rows={3}
              placeholder="Informasi tambahan yang perlu diketahui penerjemah..."
              style={{ width: '100%', padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem', resize: 'vertical' }}
            />
          </div>
          <button type="submit" disabled={loading}
            style={{ background: '#1e3a5f', color: 'white', padding: '0.9rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1rem' }}>
            {loading ? 'Mengirim...' : 'Ajukan Terjemahan'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TerjemahanPage;
