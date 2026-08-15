/**
 * Reusable skeleton block for chart loading placeholders.
 */
export default function SkeletonChart({ className = '', style, ...props }) {
  const classes = ['skeleton-chart', className].filter(Boolean).join(' ');
  return <div className={classes} style={style} {...props} />;
}
