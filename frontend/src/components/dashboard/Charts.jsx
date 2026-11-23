// Komponen grafik ringan (SVG/HTML, tanpa library) untuk dashboard pelatihan.
// Aturan visual (lihat skill dataviz): satu seri = satu hue (--viz-series), aksen hanya untuk penekanan,
// tanda tipis (bar <= 24px, garis 2px, titik r4 + cincin 2px), grid tipis solid, label secukupnya,
// tooltip saat hover/fokus, dan setiap grafik punya tampilan tabel (ChartCard).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';

/** Lebar elemen (responsif) via ResizeObserver. */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    setWidth(Math.floor(ref.current.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Nilai maksimum sumbu yang "bulat" (1, 2, 5 x 10^n). */
const niceMax = (v) => {
  if (v <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};

/** Kotak tooltip; konten berupa teks (bukan HTML) agar aman. */
function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <strong>{tip.value}</strong>
      {tip.label && <span>{tip.label}</span>}
      {tip.extra?.map((t) => <span key={t}>{t}</span>)}
    </div>
  );
}

/**
 * Kartu grafik dengan sakelar Grafik/Tabel.
 * @param table { columns: string[], rows: (string|number)[][] }
 */
export function ChartCard({ title, subtitle, icon, table, action, children, className = '' }) {
  const [tabel, setTabel] = useState(false);
  return (
    <section className={`panel chart-card ${className}`}>
      <header className="panel-head">
        <div className="panel-title-wrap">
          {icon && <span className="icon-tile"><Icon name={icon} /></span>}
          <div>
            <h2 className="panel-title">{title}</h2>
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
        </div>
        <div className="chart-card-actions">
          {action}
          {table && (
            <button type="button" className="chip-btn" onClick={() => setTabel((v) => !v)} aria-pressed={tabel}>
              <Icon name={tabel ? 'chart' : 'grid'} size={14} /> {tabel ? 'Grafik' : 'Tabel'}
            </button>
          )}
        </div>
      </header>
      {tabel && table ? (
        <div className="table-wrap chart-table">
          <table className="table">
            <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? 'num' : ''}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Garis tren mini (sparkline): seri abu-abu, titik terakhir beraksen. */
export function Sparkline({ values, labels = [], format = (v) => v, width = 132, height = 36, label }) {
  const [tip, setTip] = useState(null);
  const valid = values.map((v) => (v === null || v === undefined ? null : Number(v)));
  const ada = valid.filter((v) => v !== null);
  if (ada.length < 2) return <span className="spark-empty">Belum cukup data</span>;
  const max = Math.max(...ada, 1);
  const min = Math.min(...ada, 0);
  const pad = 5;
  const x = (i) => pad + (i * (width - pad * 2)) / (valid.length - 1);
  const y = (v) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const pts = valid.map((v, i) => (v === null ? null : [x(i), y(v)]));
  const d = pts.reduce((s, p, i) => (p ? `${s}${s && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : s), '');
  const lastIdx = valid.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop();

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(valid.length - 1, Math.round(((e.clientX - r.left - pad) / (r.width - pad * 2)) * (valid.length - 1))));
    if (valid[i] === null) return setTip(null);
    setTip({ i, x: (x(i) / width) * r.width, y: -6, value: format(valid[i]), label: labels[i] });
  };

  return (
    <span className="spark" style={{ width }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}
        onPointerMove={onMove} onPointerLeave={() => setTip(null)}>
        <path d={d} className="spark-line" />
        {tip && <circle cx={x(tip.i)} cy={y(valid[tip.i])} r="4" className="spark-dot spark-dot-hover" />}
        <circle cx={x(lastIdx)} cy={y(valid[lastIdx])} r="4" className="spark-dot" />
      </svg>
      <Tip tip={tip} />
    </span>
  );
}

/** Meter tunggal (rasio terhadap batas). */
export function MeterBar({ value, max = 100, tone = 'series', label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`viz-meter viz-meter-${tone}`} role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Grafik kolom satu seri (mis. pendaftaran per minggu). */
export function ColumnChart({ data, format = (v) => v, height = 190, label, emphasizeLast = true }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const left = 34;
  const bottom = 24;
  const top = 18;
  const plotW = Math.max(0, width - left - 6);
  const plotH = height - bottom - top;
  // Data hitungan (orang/pertemuan) -> sumbu bilangan bulat genap agar tick tengah tetap bulat
  const maxData = Math.max(...data.map((d) => d.value), 0);
  const max = maxData <= 10 ? Math.max(2, maxData + (maxData % 2)) : niceMax(maxData);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, band * 0.6);
  const ticks = [0, max / 2, max];
  const y = (v) => top + plotH - (v / max) * plotH;
  const iMax = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);

  const show = (i, el) => {
    const d = data[i];
    setTip({ x: left + band * i + band / 2, y: y(d.value) - 8, value: format(d.value), label: d.tip ?? d.label });
    if (el) el.classList.add('is-hover');
  };

  return (
    <div className="viz-wrap" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - 6} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-axis' : 'viz-grid'} />
              <text x={left - 6} y={y(t) + 4} className="viz-tick" textAnchor="end">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const h = Math.max(0, (d.value / max) * plotH);
            const cx = left + band * i + band / 2;
            const x0 = cx - barW / 2;
            const r = Math.min(4, h);
            const yTop = top + plotH - h;
            const path = h > 0
              ? `M${x0},${top + plotH}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x0 + barW - r}Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r}V${top + plotH}Z`
              : '';
            const tegas = emphasizeLast ? i === data.length - 1 : false;
            const beriLabel = d.value > 0 && (i === iMax || i === data.length - 1);
            return (
              <g key={d.label}>
                {path && <path d={path} className={tegas ? 'viz-bar viz-bar-accent' : 'viz-bar'} />}
                {beriLabel && <text x={cx} y={yTop - 5} className="viz-value" textAnchor="middle">{format(d.value)}</text>}
                {(band >= 46 || (data.length - 1 - i) % 2 === 0) && (
                  <text x={cx} y={height - 6} className="viz-tick" textAnchor="middle">{d.label}</text>
                )}
                <rect
                  x={left + band * i} y={top} width={band} height={plotH} className="viz-hit" tabIndex={0}
                  aria-label={`${d.tip ?? d.label}: ${format(d.value)}`}
                  onPointerEnter={() => show(i)} onFocus={() => show(i)}
                  onPointerLeave={() => setTip(null)} onBlur={() => setTip(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      <Tip tip={tip} />
    </div>
  );
}

/** Grafik garis satu seri dalam persen dengan garis ambang (mis. kehadiran per pertemuan). */
export function LineChart({ data, ambang, height = 210, label, format = (v) => `${v}%` }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const left = 42; // muat label "100%"
  const right = 12;
  const top = 26; // ruang untuk label nilai di atas titik 100%
  const bottom = 24;
  const plotW = Math.max(0, width - left - right);
  const plotH = height - top - bottom;
  const x = (i) => left + (data.length > 1 ? (i * plotW) / (data.length - 1) : plotW / 2);
  const y = (v) => top + plotH - (v / 100) * plotH;
  const pts = data.map((d, i) => (d.value === null ? null : [x(i), y(d.value)]));
  let line = '';
  pts.forEach((p, i) => { if (p) line += `${line && pts[i - 1] ? 'L' : 'M'}${p[0]},${p[1]}`; });
  const idx = pts.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  const area = idx.length > 1 ? `${line}L${x(idx[idx.length - 1])},${y(0)}L${x(idx[0])},${y(0)}Z` : '';
  const last = idx[idx.length - 1];

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - r.left - left) / (plotW || 1)) * (data.length - 1))));
    const d = data[i];
    setTip({ i, x: x(i), y: d.value === null ? top : y(d.value) - 10, value: d.value === null ? 'Belum ada presensi' : format(d.value), label: d.tip ?? d.label });
  };

  return (
    <div className="viz-wrap" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setTip(null)}>
          {[0, 50, 100].map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-axis' : 'viz-grid'} />
              <text x={left - 6} y={y(t) + 4} className="viz-tick" textAnchor="end">{t}%</text>
            </g>
          ))}
          {ambang !== undefined && (
            <g>
              <line x1={left} x2={width - right} y1={y(ambang)} y2={y(ambang)} className="viz-ref" />
              <text x={width - right} y={y(ambang) - 5} className="viz-ref-label" textAnchor="end">Ambang {ambang}%</text>
            </g>
          )}
          {area && <path d={area} className="viz-area" />}
          {line && <path d={line} className="viz-line" />}
          {tip && <line x1={x(tip.i)} x2={x(tip.i)} y1={top} y2={top + plotH} className="viz-crosshair" />}
          {pts.map((p, i) => p && (
            <circle key={i} cx={p[0]} cy={p[1]} r="4" className={`viz-dot ${data[i].value < ambang ? 'is-low' : ''}`} />
          ))}
          {last !== undefined && (
            <text x={x(last)} y={y(data[last].value) - 10} className="viz-value" textAnchor={last === data.length - 1 ? 'end' : 'middle'}>
              {format(data[last].value)}
            </text>
          )}
          {data.map((d, i) => (data.length <= 12 || i % 2 === 0) && (
            <text key={d.label} x={x(i)} y={height - 6} className="viz-tick" textAnchor="middle">{d.label}</text>
          ))}
        </svg>
      )}
      <Tip tip={tip} />
    </div>
  );
}

/**
 * Bar bersegmen tinggi: satu keseluruhan yang dibagi ke <= 6 bagian berurutan.
 * @param parts [{ key, label, value, color, detail }]
 */
export function SegmentedBar({ parts, label, format = (v) => v }) {
  const [tip, setTip] = useState(null);
  const total = parts.reduce((n, p) => n + p.value, 0);
  const ref = useRef(null);
  if (!total) return <p className="panel-note">Belum ada data.</p>;
  let acc = 0;
  return (
    <div className="segbar-wrap" ref={ref}>
      <div className="segbar" role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`}>
        {parts.filter((p) => p.value > 0).map((p) => {
          const pct = (p.value / total) * 100;
          const kiri = acc;
          acc += pct;
          return (
            <span
              key={p.key}
              className="segbar-part"
              style={{ width: `${pct}%`, background: p.color, color: p.ink ?? '#fff' }}
              tabIndex={0}
              aria-label={`${p.label}: ${format(p.value)} (${Math.round(pct)}%)`}
              onPointerEnter={() => setTip({ x: `${kiri + pct / 2}%`, y: -8, value: `${format(p.value)} · ${Math.round(pct)}%`, label: p.label, extra: p.detail ? [p.detail] : [] })}
              onFocus={() => setTip({ x: `${kiri + pct / 2}%`, y: -8, value: `${format(p.value)} · ${Math.round(pct)}%`, label: p.label })}
              onPointerLeave={() => setTip(null)}
              onBlur={() => setTip(null)}
            >
              {pct >= 14 && `${Math.round(pct)}%`}
            </span>
          );
        })}
      </div>
      <Tip tip={tip} />
      <ul className="segbar-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="swatch" style={{ background: p.color }} />
            <span className="segbar-legend-label">{p.label}</span>
            <strong>{format(p.value)}</strong>
            {p.detail && <small>{p.detail}</small>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Daftar meter per baris (mis. kehadiran per kelas) dengan penanda ambang. */
export function MeterList({ rows, ambang, emptyText = 'Belum ada data' }) {
  if (!rows.length) return <p className="panel-note">{emptyText}</p>;
  return (
    <ul className="meter-list">
      {rows.map((r) => {
        const rendah = r.value !== null && ambang !== undefined && r.value < ambang;
        return (
          <li key={r.key}>
            <div className="meter-list-head">
              <span className="meter-list-name">{r.label}</span>
              <strong className={rendah ? 'text-warning' : ''}>
                {rendah && <Icon name="alert" size={13} />} {r.value === null ? '—' : `${r.value}%`}
              </strong>
            </div>
            <div className={`viz-meter ${rendah ? 'viz-meter-accent' : 'viz-meter-series'}`} aria-label={`${r.label}: ${r.value ?? 'tidak ada data'}`}>
              <span style={{ width: `${r.value ?? 0}%` }} />
              {ambang !== undefined && <i style={{ left: `${ambang}%` }} title={`Ambang ${ambang}%`} />}
            </div>
            {r.sub && <small className="meter-list-sub">{r.sub}</small>}
          </li>
        );
      })}
    </ul>
  );
}

/** Cincin progres (meter melingkar) untuk satu rasio. */
export function ProgressRing({ value, max, size = 76, stroke = 8, center, label, tone = 'series' }) {
  const r = (size - stroke) / 2;
  const keliling = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={`ring ring-${tone}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeWidth={stroke}
        strokeDasharray={`${keliling * pct} ${keliling}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-text">{center}</text>
    </svg>
  );
}

/** Kalender panas (heat strip) per hari: makin gelap = makin padat. */
export function HeatStrip({ days, unit = 'pertemuan', onSelect, selected }) {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);
  const max = Math.max(...days.map((d) => d.jumlah), 1);
  const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const show = (d, el) => {
    const box = ref.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top - 6, value: `${d.jumlah} ${unit}`, label: `${d.hari}, ${d.labelTanggal}`, extra: d.ringkas });
  };
  return (
    <div className="heat-wrap" ref={ref}>
      <div className="heat-strip">
        {days.map((d) => (
          <button
            key={d.tanggal}
            type="button"
            className={`heat-cell lvl-${level(d.jumlah)} ${selected === d.tanggal ? 'is-selected' : ''} ${d.isToday ? 'is-today' : ''}`}
            onPointerEnter={(e) => show(d, e.currentTarget)}
            onFocus={(e) => show(d, e.currentTarget)}
            onPointerLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
            onClick={() => onSelect?.(d.tanggal)}
            aria-label={`${d.hari} ${d.labelTanggal}: ${d.jumlah} ${unit}`}
            aria-pressed={selected === d.tanggal}
          >
            <span className="heat-day">{d.hari.slice(0, 3)}</span>
            <strong>{d.tanggalPendek}</strong>
            <span className="heat-count">{d.jumlah || ''}</span>
          </button>
        ))}
      </div>
      <div className="heat-legend" aria-hidden="true">
        <span>Sepi</span>
        {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`heat-cell-swatch lvl-${l}`} />)}
        <span>Padat</span>
      </div>
      <Tip tip={tip} />
    </div>
  );
}

/**
 * Kalender mingguan berbasis jam (Sen–Min x 07.00–18.00).
 * @param items [{ key, tanggal, jam_mulai, jam_selesai, title, sub, jenis: 'mengajar'|'kegiatan', status }]
 */
export function WeekTimeline({ days, items, startHour = 7, endHour = 18 }) {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);
  const span = (endHour - startHour) * 60;
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const pos = (s) => Math.min(100, Math.max(0, ((toMin(s) - startHour * 60) / span) * 100));
  const jam = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const [nowPct, setNowPct] = useState(null);

  // Blok yang jamnya bertumpuk di hari yang sama ditata berdampingan (lajur)
  const tataLajur = (list) => {
    const urut = [...list].sort((a, b) => toMin(a.jam_mulai) - toMin(b.jam_mulai));
    const hasil = [];
    let grup = [];
    let akhirGrup = -1;
    const tutupGrup = () => {
      const lajurAkhir = [];
      const posisi = grup.map((it) => {
        let l = lajurAkhir.findIndex((akhir) => akhir <= toMin(it.jam_mulai));
        if (l === -1) l = lajurAkhir.length;
        lajurAkhir[l] = toMin(it.jam_selesai);
        return { it, l };
      });
      posisi.forEach(({ it, l }) => hasil.push({ ...it, lajur: l, lajurTotal: lajurAkhir.length }));
      grup = [];
    };
    for (const it of urut) {
      if (grup.length && toMin(it.jam_mulai) >= akhirGrup) tutupGrup();
      grup.push(it);
      akhirGrup = Math.max(grup.length === 1 ? 0 : akhirGrup, toMin(it.jam_selesai));
    }
    if (grup.length) tutupGrup();
    return hasil;
  };

  useEffect(() => {
    const hitung = () => {
      const d = new Date();
      setNowPct(((d.getHours() * 60 + d.getMinutes() - startHour * 60) / span) * 100);
    };
    hitung();
    const t = setInterval(hitung, 60000);
    return () => clearInterval(t);
  }, [span, startHour]);

  const show = (it, el) => {
    const box = ref.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top - 6, value: `${it.jam_mulai}–${it.jam_selesai}`, label: it.title, extra: it.sub ? [it.sub] : [] });
  };

  return (
    <div className="timeline" ref={ref}>
      <div className="timeline-hours" aria-hidden="true">
        {jam.map((h) => <span key={h} style={{ top: `${((h - startHour) / (endHour - startHour)) * 100}%` }}>{String(h).padStart(2, '0')}.00</span>)}
      </div>
      <div className="timeline-grid">
        {days.map((d) => (
          <div key={d.tanggal} className={`timeline-day ${d.isToday ? 'is-today' : ''}`}>
            <p className="timeline-day-head"><strong>{d.label}</strong><span>{d.sub}</span></p>
            <div className="timeline-col">
              {jam.slice(1, -1).map((h) => <i key={h} className="timeline-line" style={{ top: `${((h - startHour) / (endHour - startHour)) * 100}%` }} />)}
              {d.isToday && nowPct !== null && nowPct >= 0 && nowPct <= 100 && <i className="timeline-now" style={{ top: `${nowPct}%` }} />}
              {tataLajur(items.filter((it) => it.tanggal === d.tanggal)).map((it) => {
                const atas = pos(it.jam_mulai);
                const tinggi = Math.max(6, pos(it.jam_selesai) - atas);
                const lebar = 100 / it.lajurTotal;
                return (
                  <div
                    key={it.key}
                    className={`timeline-block is-${it.jenis} ${it.status === 'selesai' ? 'is-done' : ''} ${it.lajurTotal > 1 ? 'is-split' : ''}`}
                    style={{
                      top: `${atas}%`,
                      height: `${tinggi}%`,
                      left: `calc(${it.lajur * lebar}% + 3px)`,
                      width: `calc(${lebar}% - 6px)`,
                      right: 'auto',
                    }}
                    tabIndex={0}
                    aria-label={`${it.title}, ${it.jam_mulai}–${it.jam_selesai}`}
                    onPointerEnter={(e) => show(it, e.currentTarget)}
                    onFocus={(e) => show(it, e.currentTarget)}
                    onPointerLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                  >
                    <span>{it.jam_mulai}</span>
                    <strong>{it.title}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Tip tip={tip} />
    </div>
  );
}
