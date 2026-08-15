/**
 * Reusable sidebar shell for future application pages.
 *
 * The current dashboard does not render a sidebar, but this component supports
 * future navigation without coupling page content to sidebar implementation.
 */
export default function Sidebar({ children, className = '', ...props }) {
  const classes = ['app-sidebar', className].filter(Boolean).join(' ');

  return (
    <aside className={classes} {...props}>
      {children}
    </aside>
  );
}
