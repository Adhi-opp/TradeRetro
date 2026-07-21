/**
 * Application-level layout shell.
 *
 * Preserves the existing `ide-shell` class used by the dashboard while
 * allowing future pages to provide a sidebar, topbar, and content region.
 */
export default function AppLayout({ sidebar = null, topbar = null, children, className = '', ...props }) {
  const classes = ['ide-shell', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {sidebar}
      {topbar}
      {children}
    </div>
  );
}
