/**
 * Reusable dashboard grid row for performance panels.
 */
export default function PerformanceGrid({ children, variant = '5050', className = '' }) {
  const classes = ['ts-row', `ts-row-${variant}`, className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
