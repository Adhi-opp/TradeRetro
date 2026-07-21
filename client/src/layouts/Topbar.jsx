/**
 * Reusable topbar shell.
 *
 * Accepts title, subtitle, optional navigation children, and actions while
 * preserving the dashboard's existing `ide-header` structure and classes.
 */
export default function Topbar({
  title,
  subtitle,
  actions,
  children,
  onTitleClick,
  titleButtonTitle,
  className = '',
  leftClassName = '',
  actionsClassName = '',
  ...props
}) {
  const headerClasses = ['ide-header', className].filter(Boolean).join(' ');
  const leftClasses = ['ide-header-left', leftClassName].filter(Boolean).join(' ');
  const actionClasses = ['ide-header-actions', actionsClassName].filter(Boolean).join(' ');

  const brand = onTitleClick ? (
    <button className="app-logo app-logo-btn" onClick={onTitleClick} title={titleButtonTitle}>
      {title && <h1>{title}</h1>}
      {subtitle && <span>{subtitle}</span>}
    </button>
  ) : (
    <div className="app-logo">
      {title && <h1>{title}</h1>}
      {subtitle && <span>{subtitle}</span>}
    </div>
  );

  return (
    <header className={headerClasses} {...props}>
      <div className={leftClasses}>
        {brand}
        {children}
      </div>

      {actions && (
        <div className={actionClasses}>
          {actions}
        </div>
      )}
    </header>
  );
}
