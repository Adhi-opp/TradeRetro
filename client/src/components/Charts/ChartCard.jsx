/**
 * Reusable chart card shell.
 */
export default function ChartCard({ title, subtitle, actions, children, className = 'panel', ...props }) {
  return (
    <div className={className} {...props}>
      {(title || subtitle || actions) && (
        <div className="panel-title-row">
          {title && <span className="panel-title">{title}</span>}
          {subtitle && <span className="panel-sub">{subtitle}</span>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
