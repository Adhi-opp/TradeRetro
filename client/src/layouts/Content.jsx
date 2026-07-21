/**
 * Scrollable content shell.
 *
 * Keeps the existing `ide-body` class, supports the full-width dashboard
 * variant through the `full` prop, and can opt into scrollable content.
 */
export default function Content({ children, full = false, scroll = false, className = '', style, ...props }) {
  const classes = ['ide-body', full ? 'ide-body-full' : '', className].filter(Boolean).join(' ');
  const contentStyle = scroll ? { overflow: 'auto', ...style } : style;

  return (
    <main className={classes} style={contentStyle} {...props}>
      {children}
    </main>
  );
}
