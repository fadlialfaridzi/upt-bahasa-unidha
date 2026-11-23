// Komponen kecil dashboard pelatihan. Grafik ada di Charts.jsx.

/** Bilah progres dengan penanda ambang opsional (mis. 75% kehadiran). */
export function Meter({ value, max = 100, ambang, tone = 'brand', label }) {
  const pct = max > 0 && value !== null && value !== undefined ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`meter meter-${tone}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span className="meter-fill" style={{ width: `${pct}%` }} />
      {ambang !== undefined && <span className="meter-ambang" style={{ left: `${ambang}%` }} title={`Ambang ${ambang}%`} />}
    </div>
  );
}
