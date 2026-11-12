import Icon from '../ui/Icon.jsx';

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return 'pagi';
  if (h < 15) return 'siang';
  if (h < 19) return 'sore';
  return 'malam';
};

export const firstName = (name = '') => name.split(' ')[0];

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function TempNotice() {
  return (
    <div className="notice" role="note">
      <Icon name="alert" size={18} />
      <p>
        <strong>Dashboard sementara.</strong> Ini masih kerangka tampilan. Angka dan daftar akan terisi setelah API
        disambungkan ke skema database baru.
      </p>
    </div>
  );
}

export function StatGrid({ items }) {
  return (
    <div className="stat-grid">
      {items.map((s) => (
        <div className="stat-card" key={s.label}>
          <div className="stat-top">
            <span className="icon-tile icon-tile-sm"><Icon name={s.icon} size={17} /></span>
            <span className="stat-label">{s.label}</span>
          </div>
          <p className="stat-value">{s.value ?? '—'}</p>
          <p className="stat-hint">{s.hint}</p>
        </div>
      ))}
    </div>
  );
}

export function Panel({ title, subtitle, icon, badge, footer, children }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-title-wrap">
          {icon && <span className="icon-tile"><Icon name={icon} /></span>}
          <div>
            <h2 className="panel-title">{title}</h2>
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
        </div>
        {badge && <span className="badge badge-muted">{badge}</span>}
      </header>
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  );
}

export function EmptyState({ icon = 'inbox', title = 'Belum ada data', text }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
    </div>
  );
}

export function SoonButton({ icon, children, variant = 'soft' }) {
  return (
    <button type="button" className={`btn btn-${variant} btn-block`} disabled title="Segera hadir">
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}
